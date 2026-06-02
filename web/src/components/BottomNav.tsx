import { Link, useLocation } from 'react-router-dom'
import { MapPin, Building2, Heart, Star, Trophy } from 'lucide-react'
import { useClub } from '../lib/ClubContext'
import { useAuth } from '../lib/AuthContext'

interface BottomNavProps {
    onOpenSearch: () => void
}

function BottomNav({ onOpenSearch }: BottomNavProps) {
    const location = useLocation()
    const path = location.pathname
    const { favoriteClub, selectedClub } = useClub()
    const { user } = useAuth()
    const activeClub = selectedClub || favoriteClub

    const isActive = (route: string) => {
        if (route === '/' && path === '/') return true
        if (route !== '/' && path.startsWith(route)) return true
        return false
    }

    const clubHomePath = activeClub ? `/clube/${activeClub.slug}/home` : '#'

    const handleClubClick = (e: React.MouseEvent) => {
        if (!activeClub) {
            e.preventDefault()
            onOpenSearch()
        }
    }

    // Build all possible nav items, show based on login state
    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border-t border-zinc-200 dark:border-white/10 pb-safe md:hidden">
            <div className="flex items-center justify-around h-16">
                <Link to="/" className={`flex flex-col items-center justify-center w-full h-full gap-1 ${isActive('/') ? 'text-dribly-purple' : 'text-zinc-400 dark:text-zinc-500'}`}>
                    <Building2 size={18} strokeWidth={isActive('/') ? 2.5 : 2} />
                    <span className="text-[10px] font-medium">Início</span>
                </Link>

                {user ? (
                    <>
                        <Link to={clubHomePath} onClick={handleClubClick}
                            className={`flex flex-col items-center justify-center w-full h-full gap-1 ${isActive(`/clube/${activeClub?.slug}/home`) ? 'text-dribly-purple' : 'text-zinc-400 dark:text-zinc-500'}`}>
                            <Star size={18} strokeWidth={isActive(`/clube/${activeClub?.slug}/home`) ? 2.5 : 2} />
                            <span className="text-[10px] font-medium">Meu Clube</span>
                        </Link>
                        <Link to="/seguidos"
                            className={`flex flex-col items-center justify-center w-full h-full gap-1 ${isActive('/seguidos') ? 'text-dribly-purple' : 'text-zinc-400 dark:text-zinc-500'}`}>
                            <Heart size={18} strokeWidth={isActive('/seguidos') ? 2.5 : 2} />
                            <span className="text-[10px] font-medium">Seguidos</span>
                        </Link>
                    </>
                ) : (
                    <>
                        <Link to="/clubes"
                            className={`flex flex-col items-center justify-center w-full h-full gap-1 ${isActive('/clubes') ? 'text-dribly-purple' : 'text-zinc-400 dark:text-zinc-500'}`}>
                            <Building2 size={18} strokeWidth={isActive('/clubes') ? 2.5 : 2} />
                            <span className="text-[10px] font-medium">Clubes</span>
                        </Link>
                        <Link to="/ligas"
                            className={`flex flex-col items-center justify-center w-full h-full gap-1 ${isActive('/ligas') ? 'text-dribly-purple' : 'text-zinc-400 dark:text-zinc-500'}`}>
                            <Trophy size={18} strokeWidth={isActive('/ligas') ? 2.5 : 2} />
                            <span className="text-[10px] font-medium">Ligas</span>
                        </Link>
                    </>
                )}

                <Link to="/mapa"
                    className={`flex flex-col items-center justify-center w-full h-full gap-1 ${isActive('/mapa') ? 'text-dribly-purple' : 'text-zinc-400 dark:text-zinc-500'}`}>
                    <MapPin size={18} strokeWidth={isActive('/mapa') ? 2.5 : 2} />
                    <span className="text-[10px] font-medium">Mapa</span>
                </Link>
            </div>
        </div>
    )
}

export default BottomNav
