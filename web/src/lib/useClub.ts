import { createContext, useContext } from 'react'

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
    elo_rating: number | null
}

/** Display name: short_name if available, otherwise full name. */
export function displayName(club: Club): string {
    return club.short_name || club.name
}

export interface ClubContextType {
    selectedClub: Club | null
    setSelectedClub: (club: Club | null) => void
    clubs: Club[]
    loadClubs: () => Promise<void>
    getClubBySlug: (slug: string) => Promise<Club | null>
}

export const ClubContext = createContext<ClubContextType | null>(null)

export function useClub(): ClubContextType {
    const ctx = useContext(ClubContext)
    if (!ctx) throw new Error('useClub must be used within ClubProvider')
    return ctx
}
