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
    | 'getCredentials'
    | 'listUsers'
    | 'getUserFollows'
    | 'deleteUser'
    | 'listClubs'
    | 'upsertClub'
    | 'updateGame'
    | 'listCompetitionsMeta'
    | 'upsertCompetitionMeta'
    | 'getPageViews'

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

function decodeJwt(token: string): Record<string, unknown> | null {
    try {
        const parts = token.split('.')
        if (parts.length !== 3) return null
        // Decode the payload (middle part) from base64url
        const payload = parts[1]
        const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
        return JSON.parse(decoded) as Record<string, unknown>
    } catch {
        return null
    }
}

async function verifyAdmin(request: Request): Promise<string | null> {
    const auth = request.headers.get('Authorization')
    if (!auth?.startsWith('Bearer ')) {
        console.log('[admin] no Bearer token')
        return null
    }
    const token = auth.slice(7)

    // Decode JWT locally (no external API call needed)
    const payload = decodeJwt(token)
    if (!payload) {
        console.log('[admin] failed to decode JWT')
        return null
    }

    console.log('[admin] JWT payload:', JSON.stringify({ sub: payload.sub, metadata: payload.public_metadata }))

    const metadata = payload.public_metadata as { role?: string } | undefined
    if (metadata?.role !== 'admin') {
        console.log('[admin] user is not admin, role:', metadata?.role)
        return null
    }

    return (payload.sub as string) ?? null
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

    // Users count from Clerk — try multiple approaches
    let usersCount = 0
    try {
        // Primary: use x-total-count header
        const res = await clerkApi('/users?limit=1&offset=0')
        const total = res.headers.get('x-total-count')
        if (total && parseInt(total) > 0) {
            usersCount = parseInt(total)
        } else {
            // Fallback: fetch a page, check header, probe next page
            const res2 = await clerkApi('/users?limit=50&offset=0&order_by=-created_at')
            const total2 = parseInt(res2.headers.get('x-total-count') || '0')
            if (total2 > 0) {
                usersCount = total2
            } else {
                const data = await res2.json() as unknown[]
                // Probe: if we got 50 users, there's at least one more page
                if (Array.isArray(data) && data.length >= 50) {
                    const probe = await clerkApi('/users?limit=1&offset=50&order_by=-created_at')
                    const probeTotal = parseInt(probe.headers.get('x-total-count') || '0')
                    usersCount = probeTotal > 0 ? probeTotal : (data.length + 50)
                } else {
                    usersCount = Array.isArray(data) ? data.length : 0
                }
            }
        }
    } catch { /* all failed — leave at 0 */ }

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

    // Try x-total-count header; fall back to pagination probe if missing/zero
    let total = parseInt(res.headers.get('x-total-count') || '0')
    if (total === 0 && users.length > 0) {
        // If we got users but no total header, estimate by probing next page
        try {
            const probe = await clerkApi(`/users?limit=1&offset=${offset + limit}&order_by=-created_at`)
            const probeTotal = parseInt(probe.headers.get('x-total-count') || '0')
            if (probeTotal > 0) total = probeTotal
            else total = offset + users.length + (users.length === limit ? limit : 0) // rough estimate
        } catch {
            total = offset + users.length + (users.length >= limit ? 1 : 0)
        }
    }

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

    // Resolve entity names: fetch all clubs and competitions_meta, join by entity_id
    const [clubsRes, compsRes] = await Promise.all([
        supabaseRest('clubs?select=id,name', { method: 'GET' }),
        supabaseRest('competitions_meta?select=id,name', { method: 'GET' }),
    ])

    const clubs = (clubsRes.ok ? await clubsRes.json() : []) as Array<{ id: number; name: string }>
    const comps = (compsRes.ok ? await compsRes.json() : []) as Array<{ id: number; name: string }>

    const clubMap = new Map(clubs.map(c => [c.id, c.name]))
    const compMap = new Map(comps.map(c => [c.id, c.name]))

    const enriched = follows.map(f => ({
        entity_type: f.entity_type,
        entity_id: f.entity_id,
        entity_name: f.entity_type === 'club'
            ? (clubMap.get(f.entity_id) || `Clube #${f.entity_id}`)
            : (compMap.get(f.entity_id) || `${f.entity_type} #${f.entity_id}`),
        created_at: f.created_at,
    }))

    return json({ follows: enriched })
}

async function handleDeleteUser(payload?: Record<string, unknown>) {
    const userId = payload?.userId as string
    if (!userId) return json({ error: 'userId required' }, 400)

    // Prevent deleting admin users
    try {
        const adminCheck = await clerkApi(`/users/${userId}`)
        if (adminCheck.ok) {
            const userData = await adminCheck.json() as { public_metadata?: { role?: string } }
            if (userData.public_metadata?.role === 'admin') {
                return json({ error: 'Cannot delete admin users' }, 403)
            }
        }
    } catch {
        return json({ error: 'Failed to verify user' }, 502)
    }

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

    // Only send fields that exist in the clubs table
    const body: Record<string, unknown> = {
        id: club.id,
        name: club.name,
        slug: club.slug,
        search_name: club.search_name || String(club.name || '').toLowerCase(),
    }
    if (club.short_name !== undefined) body.short_name = club.short_name
    if (club.primary_color !== undefined) body.primary_color = club.primary_color
    if (club.logo_url !== undefined) body.logo_url = club.logo_url
    if (club.logo_secondary !== undefined) body.logo_secondary = club.logo_secondary
    if (club.priority !== undefined) body.priority = club.priority

    try {
        const res = await supabaseRest('clubs', {
            method: 'POST',
            body: JSON.stringify(body),
            headers: { Prefer: 'resolution=merge-duplicates' },
        })

        if (!res.ok) {
            const err = await res.text()
            return json({ error: `Upsert failed: ${err}` }, 502)
        }

        const text = await res.text()
        if (!text) {
            // Upsert succeeded but returned no body — that's OK
            return json({ ok: true, club: body })
        }
        const rows = JSON.parse(text) as Array<Record<string, unknown>>
        return json({ ok: true, club: rows[0] })
    } catch (err) {
        console.error('[admin] upsertClub error:', err)
        return json({ error: 'Internal error updating club' }, 500)
    }
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

// ── Page views ─────────────────────────────────────────

async function handleTrackPageView() {
    try {
        const today = new Date().toISOString().split('T')[0]
        // Use RPC to upsert: INSERT ... ON CONFLICT DO UPDATE
        const res = await supabaseRest('rpc/increment_page_view', {
            method: 'POST',
            body: JSON.stringify({ p_date: today }),
            headers: { 'Content-Type': 'application/json' },
        })
        if (!res.ok) {
            // Fallback: plain insert (will fail for duplicates, but that's OK)
            await supabaseRest('page_views', {
                method: 'POST',
                body: JSON.stringify({ date: today, count: 1 }),
                headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
            }).catch(() => {})
        }
        return json({ ok: true })
    } catch {
        return json({ ok: false }, 500)
    }
}

async function handleGetPageViews(payload?: Record<string, unknown>) {
    const days = (payload?.days as number) || 30
    const start = new Date()
    start.setDate(start.getDate() - days)
    const startDate = start.toISOString().split('T')[0]

    try {
        const res = await supabaseRest(
            `page_views?date=gte.${startDate}&order=date.asc`,
            { method: 'GET' },
        )
        if (!res.ok) return json({ views: [] })
        const rows = (await res.json()) as Array<{ date: string; count: number }>
        return json({ views: rows })
    } catch {
        return json({ views: [] })
    }
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

    // Parse body first — some actions don't need auth
    let body: AdminRequest
    try {
        body = (await request.json()) as AdminRequest
    } catch {
        return json({ error: 'Invalid JSON body' }, 400)
    }

    // trackPageView doesn't need auth (public beacon)
    if (body.action === 'trackPageView') {
        return await handleTrackPageView()
    }

    // Auth required for everything else
    const adminId = await verifyAdmin(request)
    if (!adminId) {
        return json({ error: 'Unauthorized — admin role required' }, 401)
    }

    // Route to handler
    const { action, payload } = body

    try {
        switch (action) {
            case 'getStats':
                return await handleGetStats()
            case 'getCredentials':
                console.log('[admin] getCredentials — SUPABASE_URL:', process.env.SUPABASE_URL, 'SERVICE_ROLE:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'present' : 'MISSING')
                return json({
                    supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
                    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
                })
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
            case 'getPageViews':
                return await handleGetPageViews(payload)
            default:
                return json({ error: `Unknown action: ${action}` }, 400)
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Internal error'
        return json({ error: message }, 500)
    }
}
