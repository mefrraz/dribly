import { useAuth as useClerkAuth } from '@clerk/clerk-react'

// ── Types ──────────────────────────────────────────────

export interface AdminUser {
    id: string
    email: string | null
    username: string | null
    created_at: number
    last_sign_in_at: number | null
    is_admin: boolean
}

export interface AdminFollow {
    entity_type: string
    entity_id: number
    created_at: string
}

export interface AdminClub {
    id: number
    name: string
    short_name: string | null
    slug: string
    search_name: string
    primary_color: string | null
    logo_url: string | null
    logo_secondary: string | null
    priority: number | null
}

export interface AdminCompetitionMeta {
    id: number
    name: string
    abrev: string
    gradient_from: string | null
    gradient_to: string | null
    logo_url: string | null
}

export interface AdminGame {
    slug: string
    data: string
    hora: string | null
    equipa_casa: string
    equipa_fora: string
    resultado_casa: number | null
    resultado_fora: number | null
    escalao: string | null
    competicao: string | null
    local: string | null
    status: string
}

export interface AdminStats {
    clubs: number
    users: number
    follows: number
    games: number
}

export interface AdminCredentials {
    supabaseUrl: string
    supabaseServiceRoleKey: string
}

// ── API client ─────────────────────────────────────────

async function callAdmin<T>(
    action: string,
    payload: Record<string, unknown> | undefined,
    getToken: () => Promise<string | null>,
): Promise<T> {
    const token = await getToken()
    console.log('[adminApi] token obtained:', token ? `${token.substring(0, 20)}... (${token.length} chars)` : 'NULL')
    if (!token) throw new Error('Not authenticated')

    const res = await fetch('/api/admin', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action, payload }),
    })

    if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error || `Admin API error ${res.status}`)
    }

    return res.json() as Promise<T>
}

// ── Hook ────────────────────────────────────────────────

export function useAdminApi() {
    const { getToken } = useClerkAuth()
    // Use supabase template — includes public_metadata in the JWT
    const getAdminToken = () => getToken({ template: 'supabase' })

    return {
        getStats: () =>
            callAdmin<AdminStats>('getStats', undefined, getAdminToken),

        getCredentials: () =>
            callAdmin<AdminCredentials>('getCredentials', undefined, getAdminToken),

        listUsers: (limit = 50, offset = 0) =>
            callAdmin<{ users: AdminUser[]; total: number }>(
                'listUsers',
                { limit, offset },
                getAdminToken,
            ),

        getUserFollows: (userId: string) =>
            callAdmin<{ follows: AdminFollow[] }>(
                'getUserFollows',
                { userId },
                getAdminToken,
            ),

        deleteUser: (userId: string) =>
            callAdmin<{ ok: boolean; errors?: string[] }>(
                'deleteUser',
                { userId },
                getAdminToken,
            ),

        listClubs: () =>
            callAdmin<{ clubs: AdminClub[] }>('listClubs', undefined, getAdminToken),

        upsertClub: (club: Partial<AdminClub> & { id: number }) =>
            callAdmin<{ ok: boolean; club: AdminClub }>(
                'upsertClub',
                { club },
                getAdminToken,
            ),

        updateGame: (slug: string, updates: Record<string, unknown>) =>
            callAdmin<{ ok: boolean }>(
                'updateGame',
                { slug, updates },
                getAdminToken,
            ),

        listCompetitionsMeta: () =>
            callAdmin<{ competitions: AdminCompetitionMeta[] }>(
                'listCompetitionsMeta',
                undefined,
                getAdminToken,
            ),

        upsertCompetitionMeta: (
            comp: Partial<AdminCompetitionMeta> & { id: number },
        ) =>
            callAdmin<{ ok: boolean; competition: AdminCompetitionMeta }>(
                'upsertCompetitionMeta',
                { competition: comp },
                getAdminToken,
            ),
    }
}
