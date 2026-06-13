import { useState, useCallback, type ReactNode } from 'react'
import { supabase } from './supabase'
import { ClubContext, type Club } from './useClub'

// Re-export for backward compatibility — all existing imports from './ClubContext' still work.
// eslint-disable-next-line react-refresh/only-export-components
export { useClub, displayName, type Club, type ClubContextType } from './useClub'

const CLUBS_CACHE_KEY = 'dribly_clubs_cache_v2'

function loadCachedClubs(): Club[] {
    try {
        const raw = localStorage.getItem(CLUBS_CACHE_KEY)
        if (raw) {
            const clubs = JSON.parse(raw) as Club[]
            // Invalidate cache if new fields are missing (e.g., elo_rating added later)
            if (clubs.length > 0 && clubs[0].elo_rating === undefined) {
                localStorage.removeItem(CLUBS_CACHE_KEY)
                return []
            }
            return clubs
        }
    } catch { /* ignore */ }
    return []
}

function saveClubsCache(clubs: Club[]) {
    try { localStorage.setItem(CLUBS_CACHE_KEY, JSON.stringify(clubs)) } catch { /* ignore */ }
}

export function ClubProvider({ children }: { children: ReactNode }) {
    const [selectedClub, setSelectedClub] = useState<Club | null>(null)
    const [clubs, setClubs] = useState<Club[]>(() => loadCachedClubs())
    const [clubsFetched, setClubsFetched] = useState(false)

    const loadClubs = useCallback(async () => {
        if (clubsFetched) return
        const { data } = await supabase
            .from('clubs')
            .select('id, name, short_name, slug, search_name, logo_url, logo_secondary, primary_color, priority, elo_rating')
            .order('name')
        if (data) {
            // Sort by display name (short_name || name) so the card label matches the sort
            const sorted = (data as Club[]).sort((a, b) => {
                const da = (a.short_name || a.name).toLowerCase()
                const db = (b.short_name || b.name).toLowerCase()
                return da.localeCompare(db)
            })
            setClubsFetched(true)
            setClubs(sorted)
            saveClubsCache(sorted)
        }
    }, [clubsFetched])

    const getClubBySlug = useCallback(async (slug: string): Promise<Club | null> => {
        const cached = clubs.find(c => c.slug === slug)
        if (cached) return cached
        const { data } = await supabase
            .from('clubs')
            .select('id, name, short_name, slug, search_name, logo_url, logo_secondary, primary_color, priority, elo_rating')
            .eq('slug', slug)
            .single()
        if (data) {
            setClubs(prev => [...prev, data as Club])
            return data as Club
        }
        return null
    }, [clubs])

    return (
        <ClubContext.Provider value={{
            selectedClub,
            setSelectedClub,
            clubs,
            loadClubs,
            getClubBySlug,
        }}>
            {children}
        </ClubContext.Provider>
    )
}
