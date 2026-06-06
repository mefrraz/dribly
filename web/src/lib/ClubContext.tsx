import { useState, useCallback, type ReactNode } from 'react'
import { supabase } from './supabase'
import { ClubContext, type Club } from './useClub'

// Re-export for backward compatibility — all existing imports from './ClubContext' still work.
// eslint-disable-next-line react-refresh/only-export-components
export { useClub, displayName, type Club, type ClubContextType } from './useClub'

const CLUBS_CACHE_KEY = 'dribly_clubs_cache'

function loadCachedClubs(): Club[] {
    try {
        const raw = localStorage.getItem(CLUBS_CACHE_KEY)
        if (raw) return JSON.parse(raw) as Club[]
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
            .select('id, name, short_name, slug, search_name, logo_url, logo_secondary, primary_color, priority')
            .order('name')
        if (data) {
            setClubsFetched(true)
            setClubs(data as Club[])
            saveClubsCache(data as Club[])
        }
    }, [clubsFetched])

    const getClubBySlug = useCallback(async (slug: string): Promise<Club | null> => {
        const cached = clubs.find(c => c.slug === slug)
        if (cached) return cached
        const { data } = await supabase
            .from('clubs')
            .select('id, name, short_name, slug, search_name, logo_url, logo_secondary, primary_color, priority')
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
