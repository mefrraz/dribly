import { NavLink, Outlet, Link } from 'react-router-dom'
import { LayoutDashboard, Building2, Users, Calendar, CalendarDays, Trophy, RefreshCw, ArrowLeft, MapPin } from 'lucide-react'

const NAV_ITEMS = [
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/admin/clubes', label: 'Clubes', icon: Building2 },
    { to: '/admin/pavilhoes', label: 'Pavilhões', icon: MapPin },
    { to: '/admin/utilizadores', label: 'Utilizadores', icon: Users },
    { to: '/admin/jogos', label: 'Jogos', icon: Calendar },
    { to: '/admin/calendario', label: 'Calendário', icon: CalendarDays },
    { to: '/admin/scrape', label: 'Scraper', icon: RefreshCw },
    { to: '/admin/competicoes', label: 'Competições', icon: Trophy },
]

export function AdminLayout() {
    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-[#09090b]">
            {/* Top bar */}
            <div className="sticky top-0 z-40 bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
                <div className="max-w-6xl mx-auto px-4 h-12 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link
                            to="/"
                            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                            title="Voltar ao Dribly"
                        >
                            <ArrowLeft size={18} />
                        </Link>
                        <span className="text-sm font-bold text-zinc-900 dark:text-white">
                            Admin
                        </span>
                    </div>
                    <nav className="flex items-center gap-1">
                        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
                            <NavLink
                                key={to}
                                to={to}
                                end={end}
                                className={({ isActive }) =>
                                    `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                        isActive
                                            ? 'bg-dribly-purple text-white'
                                            : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/5'
                                    }`
                                }
                            >
                                <Icon size={14} />
                                <span className="hidden sm:inline">{label}</span>
                            </NavLink>
                        ))}
                    </nav>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-6xl mx-auto px-4 py-6 pb-24">
                <Outlet />
            </div>
        </div>
    )
}
