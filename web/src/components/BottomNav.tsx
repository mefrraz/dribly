import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { MapPin, Building2, Heart, BarChart2, Trophy, Grid3X3, Settings2, User, Shield } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'

function BottomNav() {
    const location = useLocation()
    const path = location.pathname
    const { user } = useAuth()
    const [showMore, setShowMore] = useState(false)

    const isActive = (route: string) => {
        if (route === '/' && path === '/') return true
        if (route !== '/' && path.startsWith(route)) return true
        return false
    }

    const moreItems = [
        ...(user ? [
            { to: '/seguidos', icon: Heart, label: 'Seguidos' },
            { to: '/perfil', icon: User, label: 'Conta' },
        ] : []),
        { to: '/ranking', icon: BarChart2, label: 'Ranking' },
        { to: '/clubes', icon: Building2, label: 'Clubes' },
        { to: '/classificacoes', icon: BarChart2, label: 'Classificações' },
        { to: '/definicoes', icon: Settings2, label: 'Definições' },
        { to: '/privacidade', icon: Shield, label: 'Privacidade' },
    ]

    return (
        <>
            {/* More menu overlay */}
            {showMore && (
                <div className="fixed inset-0 z-40" onClick={() => setShowMore(false)}>
                    <div className="absolute bottom-[5.5rem] left-3 right-3 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200 dark:border-white/10 rounded-2xl shadow-2xl p-4 animate-in slide-in-from-bottom-4 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="grid grid-cols-3 gap-2">
                            {moreItems.map(item => {
                                const Icon = item.icon
                                const active = isActive(item.to)
                                return (
                                    <Link
                                        key={item.to}
                                        to={item.to}
                                        onClick={() => setShowMore(false)}
                                        className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl transition-colors active:scale-[0.97] ${
                                            active ? 'bg-dribly-purple/10 text-dribly-purple' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5'
                                        }`}
                                    >
                                        <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
                                        <span className="text-[10px] font-semibold">{item.label}</span>
                                    </Link>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom nav bar */}
            <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border-t border-zinc-200 dark:border-white/10 pb-safe md:hidden" aria-label="Navegação principal">
                <div className="flex items-center justify-around h-16">
                    <Link to="/" className={`flex flex-col items-center justify-center w-full h-full gap-1 ${isActive('/') ? 'text-dribly-purple' : 'text-zinc-400 dark:text-zinc-500'}`} {...(isActive('/') ? { 'aria-current': 'page' as const } : {})}>
                        <Building2 size={18} strokeWidth={isActive('/') ? 2.5 : 2} aria-hidden="true" />
                        <span className="text-[10px] font-medium">Início</span>
                    </Link>

                    <Link to="/ligas" className={`flex flex-col items-center justify-center w-full h-full gap-1 ${isActive('/ligas') ? 'text-dribly-purple' : 'text-zinc-400 dark:text-zinc-500'}`} {...(isActive('/ligas') ? { 'aria-current': 'page' as const } : {})}>
                        <Trophy size={18} strokeWidth={isActive('/ligas') ? 2.5 : 2} aria-hidden="true" />
                        <span className="text-[10px] font-medium">Ligas</span>
                    </Link>

                    <Link to="/mapa" className={`flex flex-col items-center justify-center w-full h-full gap-1 ${isActive('/mapa') ? 'text-dribly-purple' : 'text-zinc-400 dark:text-zinc-500'}`} {...(isActive('/mapa') ? { 'aria-current': 'page' as const } : {})}>
                        <MapPin size={18} strokeWidth={isActive('/mapa') ? 2.5 : 2} aria-hidden="true" />
                        <span className="text-[10px] font-medium">Mapa</span>
                    </Link>

                    <button onClick={() => setShowMore(!showMore)} className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${showMore ? 'text-dribly-purple' : 'text-zinc-400 dark:text-zinc-500'}`}>
                        <Grid3X3 size={18} strokeWidth={showMore ? 2.5 : 2} />
                        <span className="text-[10px] font-medium">Mais</span>
                    </button>
                </div>
            </nav>
        </>
    )
}

export default BottomNav
