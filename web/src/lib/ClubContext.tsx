import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { supabase } from './supabase'
import { useAuth } from './AuthContext'

export interface Club {
    id: number
    name: string
    short_name: string | null
    slug: string
    search_name: string
    logo_url: string | null
    logo_secondary: string | null
    primary_color: string | null
    priority: number | null
}

/** Display name: short_name if available, otherwise name. */
export function displayName(club: Club): string {
    return club.short_name || club.name
}

interface ClubContextType {
    selectedClub: Club | null
    setSelectedClub: (club: Club | null) => void
    favoriteClub: Club | null
    setFavoriteClub: (club: Club | null) => void
    clubs: Club[]
    loadClubs: () => Promise<void>
    getClubBySlug: (slug: string) => Promise<Club | null>
}

const ClubContext = createContext<ClubContextType | null>(null)

const FAVORITE_KEY = 'dribly_favorite_club'
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
    const [favoriteClub, setFavoriteClubState] = useState<Club | null>(null)
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

    const { user } = useAuth()
    const setFavoriteClub = useCallback((club: Club | null) => {
        setFavoriteClubState(club)
        if (club) {
            localStorage.setItem(FAVORITE_KEY, JSON.stringify(club))
            if (user) {
                supabase.from('user_favorites').upsert({ user_id: user.id, club_id: club.id }, { onConflict: 'user_id' }).then(()=>{}, ()=>{})
            }
        } else {
            localStorage.removeItem(FAVORITE_KEY)
            if (user) {
                supabase.from('user_favorites').delete().eq('user_id', user.id).then(()=>{}, ()=>{})
            }
        }
    }, [user])

    // Load favorite: Supabase first (if logged in), then localStorage
    useEffect(() => {
        if (user) {
            supabase.from('user_favorites').select('club_id').eq('user_id', user.id).single().then(({data}) => {
                if (data?.club_id) {
                    // Find club in already-loaded clubs or fetch it
                    const found = clubs.find(c => c.id === data.club_id)
                    if (found) {
                        setFavoriteClubState(found)
                        localStorage.setItem(FAVORITE_KEY, JSON.stringify(found))
                    } else {
                        supabase.from('clubs').select('*').eq('id', data.club_id).single().then(({data:cd}) => {
                            if (cd) { setFavoriteClubState(cd as Club); localStorage.setItem(FAVORITE_KEY, JSON.stringify(cd)) }
                        }, ()=>{})
                    }
                }
            }, () => {
                // Fallback to localStorage
                try {
                    const stored = localStorage.getItem(FAVORITE_KEY)
                    if (stored) setFavoriteClubState(JSON.parse(stored) as Club)
                } catch {}
            })
        } else {
            try {
                const stored = localStorage.getItem(FAVORITE_KEY)
                if (stored) setFavoriteClubState(JSON.parse(stored) as Club)
            } catch {}
        }
    }, [user, clubs])

    return (
        <ClubContext.Provider value={{
            selectedClub,
            setSelectedClub,
            favoriteClub,
            setFavoriteClub,
            clubs,
            loadClubs,
            getClubBySlug,
        }}>
            {children}
        </ClubContext.Provider>
    )
}

export function useClub(): ClubContextType {
    const ctx = useContext(ClubContext)
    if (!ctx) throw new Error('useClub must be used within ClubProvider')
    return ctx
}
