/**
 * Admin API — Vercel Edge Function
 *
 * All actions require a valid Clerk session token + admin role.
 * Uses Clerk Backend API for user management and Supabase
 * service_role key for database writes.
 *
 * Required env vars:
 *   CLERK_SECRET_KEY          — Clerk Backend API secret
 *   SUPABASE_URL              — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — Supabase service_role key
 */

export const config = { runtime: 'edge' }

// ── Types ──────────────────────────────────────────────

type AdminAction =
    | 'getStats'
    | 'listUsers'
    | 'getUserFollows'
    | 'deleteUser'
    | 'listClubs'
    | 'upsertClub'
    | 'updateGame'
    | 'listCompetitionsMeta'
    | 'upsertCompetitionMeta'

interface AdminRequest {
    action: AdminAction
    payload?: Record<string, unknown>
}

// ── Helpers ────────────────────────────────────────────

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
        },
    })
}

function clerkApi(path: string, init?: RequestInit) {
    return fetch(`https://api.clerk.com/v1${path}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
            'Content-Type': 'application/json',
            ...(init?.headers as Record<string, string> | undefined),
        },
    })
}

function supabaseRest(table: string, init?: RequestInit) {
    return fetch(
        `${process.env.SUPABASE_URL}/rest/v1/${table}`,
        {
            ...init,
            headers: {
                apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
                Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json',
                Prefer: 'return=representation',
                ...(init?.headers as Record<string, string> | undefined),
            },
        },
    )
}

// ── Auth guard ─────────────────────────────────────────

async function verifyAdmin(request: Request): Promise<string | null> {
    const auth = request.headers.get('Authorization')
    if (!auth?.startsWith('Bearer ')) return null
    const token = auth.slice(7)

    try {
        // Verify session token via Clerk Backend API
        const res = await clerkApi('/tokens/verify', {
            method: 'POST',
            body: JSON.stringify({ token }),
        })

        if (!res.ok) return null

        const data = (await res.json()) as {
            id?: string
            public_metadata?: { role?: string }
        }

        if (data.public_metadata?.role !== 'admin') return null
        return data.id ?? null
    } catch {
        return null
    }
}

// ── Action handlers ────────────────────────────────────

async function handleGetStats() {
    // Count clubs, users, games, follows in parallel
    const [clubsRes, gamesRes, followsRes] = await Promise.all([
        supabaseRest('clubs', { method: 'GET', headers: { Prefer: 'count=exact', Range: '0-0' } }),
        supabaseRest('games_2025_2026', { method: 'GET', headers: { Prefer: 'count=exact', Range: '0-0' } }),
        supabaseRest('user_follows', { method: 'GET', headers: { Prefer: 'count=exact', Range: '0-0' } }),
    ])

    const clubsCount = parseInt(clubsRes.headers.get('content-range')?.split('/')[1] || '0')
    const gamesCount = parseInt(gamesRes.headers.get('content-range')?.split('/')[1] || '0')
    const followsCount = parseInt(followsRes.headers.get('content-range')?.split('/')[1] || '0')

    // Users count from Clerk
    let usersCount = 0
    try {
        const clerkUsers = await clerkApi('/users?limit=1')
        const total = clerkUsers.headers.get('x-total-count')
        if (total) usersCount = parseInt(total)
    } catch { /* ignore */ }

    return json({
        clubs: clubsCount,
        users: usersCount,
        follows: followsCount,
        games: gamesCount,
    })
}

async function handleListUsers(payload?: Record<string, unknown>) {
    const limit = (payload?.limit as number) || 50
    const offset = (payload?.offset as number) || 0

    const res = await clerkApi(
        `/users?limit=${limit}&offset=${offset}&order_by=-created_at`,
    )

    if (!res.ok) return json({ error: 'Failed to fetch users from Clerk' }, 502)

    const users = (await res.json()) as Array<{
        id: string
        email_addresses: Array<{ email_address: string }>
        username: string | null
        created_at: number
        last_sign_in_at: number | null
        public_metadata: Record<string, unknown>
    }>

    const total = parseInt(res.headers.get('x-total-count') || '0')

    const mapped = users.map((u) => ({
        id: u.id,
        email: u.email_addresses?.[0]?.email_address ?? null,
        username: u.username,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        is_admin: u.public_metadata?.role === 'admin',
    }))

    return json({ users: mapped, total })
}

async function handleGetUserFollows(payload?: Record<string, unknown>) {
    const userId = payload?.userId as string
    if (!userId) return json({ error: 'userId required' }, 400)

    const res = await supabaseRest(
        `user_follows?user_id=eq.${encodeURIComponent(userId)}&select=*`,
        { method: 'GET' },
    )

    if (!res.ok) return json({ error: 'Failed to fetch follows' }, 502)

    const follows = (await res.json()) as Array<{
        entity_type: string
        entity_id: number
        created_at: string
    }>

    return json({ follows })
}

async function handleDeleteUser(payload?: Record<string, unknown>) {
    const userId = payload?.userId as string
    if (!userId) return json({ error: 'userId required' }, 400)

    const errors: string[] = []

    // 1. Delete user data from Supabase
    try {
        await supabaseRest(
            `user_follows?user_id=eq.${encodeURIComponent(userId)}`,
            { method: 'DELETE' },
        )
    } catch {
        errors.push('Failed to delete user_follows')
    }

    try {
        await supabaseRest(
            `user_favorites?user_id=eq.${encodeURIComponent(userId)}`,
            { method: 'DELETE' },
        )
    } catch {
        errors.push('Failed to delete user_favorites')
    }

    // 2. Delete user from Clerk
    try {
        const clerkRes = await clerkApi(`/users/${userId}`, { method: 'DELETE' })
        if (!clerkRes.ok) {
            errors.push(`Clerk delete failed: ${clerkRes.status}`)
        }
    } catch {
        errors.push('Failed to delete from Clerk')
    }

    if (errors.length > 0) {
        return json({ ok: false, errors }, 500)
    }

    return json({ ok: true })
}

async function handleListClubs() {
    const res = await supabaseRest(
        'clubs?select=*&order=name.asc&limit=500',
        { method: 'GET' },
    )

    if (!res.ok) return json({ error: 'Failed to fetch clubs' }, 502)

    const clubs = (await res.json()) as Array<Record<string, unknown>>
    return json({ clubs })
}

async function handleUpsertClub(payload?: Record<string, unknown>) {
    const club = payload?.club as Record<string, unknown>
    if (!club?.id) return json({ error: 'club.id required' }, 400)

    // Upsert: use POST with Prefer: resolution=merge-duplicates
    const res = await supabaseRest('clubs', {
        method: 'POST',
        body: JSON.stringify({
            id: club.id,
            name: club.name,
            short_name: club.short_name || null,
            slug: club.slug,
            search_name: club.search_name || (club.name as string)?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
            primary_color: club.primary_color || null,
            logo_url: club.logo_url || null,
            logo_secondary: club.logo_secondary || null,
            priority: club.priority || null,
        }),
        headers: { Prefer: 'resolution=merge-duplicates' },
    })

    if (!res.ok) {
        const err = await res.text()
        return json({ error: `Upsert failed: ${err}` }, 502)
    }

    const rows = (await res.json()) as Array<Record<string, unknown>>
    return json({ ok: true, club: rows[0] })
}

async function handleUpdateGame(payload?: Record<string, unknown>) {
    const slug = payload?.slug as string
    const updates = payload?.updates as Record<string, unknown>
    if (!slug || !updates) return json({ error: 'slug and updates required' }, 400)

    // PATCH the game row
    const res = await supabaseRest(
        `games_2025_2026?slug=eq.${encodeURIComponent(slug)}`,
        {
            method: 'PATCH',
            body: JSON.stringify(updates),
        },
    )

    if (!res.ok) {
        const err = await res.text()
        return json({ error: `Update failed: ${err}` }, 502)
    }

    return json({ ok: true })
}

async function handleListCompetitionsMeta() {
    const res = await supabaseRest(
        'competitions_meta?select=*&order=name.asc',
        { method: 'GET' },
    )

    if (!res.ok) return json({ error: 'Failed to fetch competitions meta' }, 502)

    const comps = (await res.json()) as Array<Record<string, unknown>>
    return json({ competitions: comps })
}

async function handleUpsertCompetitionMeta(payload?: Record<string, unknown>) {
    const comp = payload?.competition as Record<string, unknown>
    if (!comp?.id) return json({ error: 'competition.id required' }, 400)

    const res = await supabaseRest('competitions_meta', {
        method: 'POST',
        body: JSON.stringify({
            id: comp.id,
            name: comp.name,
            abrev: comp.abrev || '',
            gradient_from: comp.gradient_from || null,
            gradient_to: comp.gradient_to || null,
            logo_url: comp.logo_url || null,
        }),
        headers: { Prefer: 'resolution=merge-duplicates' },
    })

    if (!res.ok) {
        const err = await res.text()
        return json({ error: `Upsert failed: ${err}` }, 502)
    }

    const rows = (await res.json()) as Array<Record<string, unknown>>
    return json({ ok: true, competition: rows[0] })
}

// ── Router ─────────────────────────────────────────────

export default async function handler(request: Request) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
        })
    }

    if (request.method !== 'POST') {
        return json({ error: 'POST only' }, 405)
    }

    // Auth
    const adminId = await verifyAdmin(request)
    if (!adminId) {
        return json({ error: 'Unauthorized — admin role required' }, 401)
    }

    // Parse body
    let body: AdminRequest
    try {
        body = (await request.json()) as AdminRequest
    } catch {
        return json({ error: 'Invalid JSON body' }, 400)
    }

    // Route to handler
    const { action, payload } = body

    try {
        switch (action) {
            case 'getStats':
                return await handleGetStats()
            case 'listUsers':
                return await handleListUsers(payload)
            case 'getUserFollows':
                return await handleGetUserFollows(payload)
            case 'deleteUser':
                return await handleDeleteUser(payload)
            case 'listClubs':
                return await handleListClubs()
            case 'upsertClub':
                return await handleUpsertClub(payload)
            case 'updateGame':
                return await handleUpdateGame(payload)
            case 'listCompetitionsMeta':
                return await handleListCompetitionsMeta()
            case 'upsertCompetitionMeta':
                return await handleUpsertCompetitionMeta(payload)
            default:
                return json({ error: `Unknown action: ${action}` }, 400)
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Internal error'
        return json({ error: message }, 500)
    }
}
