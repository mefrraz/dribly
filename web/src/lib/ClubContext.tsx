import { useState, useCallback, type ReactNode } from 'react'
import { ClubContext, type Club } from './useClub'

// Re-export for backward compatibility
// eslint-disable-next-line react-refresh/only-export-components
export { useClub, displayName, type Club, type ClubContextType } from './useClub'

const CLUBS_CACHE_KEY = 'dribly_clubs_cache_v3'
const BOUNCE_CLUBS_URL = 'https://bounce.dribly.pt/api/clubs'

function loadCachedClubs(): Club[] {
    try {
        const raw = localStorage.getItem(CLUBS_CACHE_KEY)
        if (raw) {
            const clubs = JSON.parse(raw) as Club[]
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
        try {
            const res = await fetch(BOUNCE_CLUBS_URL)
            if (!res.ok) throw new Error('HTTP ' + res.status)
            const data = await res.json()
            if (Array.isArray(data)) {
                const sorted = (data as Club[]).sort((a, b) => {
                    const da = (a.short_name || a.name).toLowerCase()
                    const db = (b.short_name || b.name).toLowerCase()
                    return da.localeCompare(db)
                })
                setClubsFetched(true)
                setClubs(sorted)
                saveClubsCache(sorted)
            }
        } catch { /* Bounce unavailable, use cache */ }
    }, [clubsFetched])

    const getClubBySlug = useCallback(async (slug: string): Promise<Club | null> => {
        const cached = clubs.find(c => c.slug === slug)
        if (cached) return cached
        // Fallback: try Bounce
        try {
            const res = await fetch(BOUNCE_CLUBS_URL)
            if (res.ok) {
                const data = await res.json()
                if (Array.isArray(data)) {
                    const found = (data as Club[]).find(c => c.slug === slug)
                    if (found) {
                        setClubs(prev => [...prev, found])
                        return found
                    }
                }
            }
        } catch { /* ignore */ }
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
