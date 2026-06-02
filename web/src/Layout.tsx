import { useState, useEffect, useCallback } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { Sun, Moon, Instagram, Github, Info, BarChart2, Home, Search, LogIn, Heart, Trophy, Building2, MapPin } from 'lucide-react'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ToastContainer } from './components/Toast'
import PWAInstallBanner from './components/PWAInstallBanner'
import BottomNav from './components/BottomNav'
import { SearchModal } from './components/SearchModal'
import { AuthModal } from './components/AuthModal'
import { OnboardingTour, type TourTrigger } from './components/OnboardingTour'
import { PostOnboardingSuggestions } from './components/PostOnboardingSuggestions'
import { useAuth } from './lib/AuthContext'

function Layout() {
    const [theme, setTheme] = useState(() => localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'))
    const [searchOpen, setSearchOpen] = useState(false)
    const [authOpen, setAuthOpen] = useState(false)
    const [onboardingTrigger, setOnboardingTrigger] = useState<TourTrigger | null>(null)
    const [showSuggestions, setShowSuggestions] = useState(false)
    const location = useLocation()
    const { user } = useAuth()

    const handleAuthSuccess = useCallback((method: 'signin' | 'signup') => {
        if (method === 'signup') {
            setTimeout(() => {
                setOnboardingTrigger(method as TourTrigger)
            }, 500)
        }
    }, [])

    useEffect(() => { window.scrollTo(0, 0) }, [location.pathname])

    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark')
        } else {
            document.documentElement.classList.remove('dark')
        }
        localStorage.setItem('theme', theme)
    }, [theme])
    // Follow system preference when user hasn't set a preference
    useEffect(() => {
        const mq = window.matchMedia('(prefers-color-scheme: dark)')
        const handler = (e: MediaQueryListEvent) => {
            const saved = localStorage.getItem('theme')
            if (!saved) setTheme(e.matches ? 'dark' : 'light')
        }
        mq.addEventListener('change', handler)
        return () => mq.removeEventListener('change', handler)
    }, [])

    const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark')

    function isActive(path: string) {
        if (path === '/') return location.pathname === '/'
        return location.pathname.startsWith(path)
    }

    const navPill = 'hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all'
    const navPillActive = 'bg-dribly-purple text-white shadow-sm'
    const navPillInactive = 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5 hover:text-zinc-700 dark:hover:text-zinc-200'
    const navIcon = 'p-2 rounded-full transition-colors'

    return (
        <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 transition-colors duration-300 flex flex-col font-sans">

            <nav className="sticky top-0 z-50 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-white/10 shadow-sm pt-safe">
                <div className="max-w-5xl mx-auto px-4 h-14 sm:h-16">
                    <div className="flex items-center h-full gap-2 sm:gap-3">
                        <div className="relative flex items-center h-full w-full">
                        {/* LEFT: Logo + desktop nav pills */}
                        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                            <Link to="/" className="flex items-center gap-2 sm:gap-2.5 shrink-0 mr-1">
                                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center overflow-hidden">
                                    <img src="/logo.svg" alt="Dribly" className="w-full h-full object-contain" />
                                </div>
                                <span className="flex items-baseline font-bold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
                                    Dribly<span className="text-dribly-purple">.</span>
                                </span>
                            </Link>
                            <div className="hidden sm:flex items-center gap-1 ml-1">
                                <Link to="/" className={`${navPill} ${isActive('/') ? navPillActive : navPillInactive}`}>
                                    <Home size={14} /> Início
                                </Link>
                                {user && (
                                    <Link to="/seguidos" data-tour="seguidos-nav" className={`${navPill} ${isActive('/seguidos') ? navPillActive : navPillInactive}`}>
                                        <Heart size={14} /> Seguidos
                                    </Link>
                                )}
                                <Link to="/clubes" className={`${navPill} ${isActive('/clubes') ? navPillActive : navPillInactive}`}>
                                    <Building2 size={14} /> Clubes
                                </Link>
                                <Link to="/ligas" className={`${navPill} ${isActive('/ligas') ? navPillActive : navPillInactive}`}>
                                    <Trophy size={14} /> Ligas
                                </Link>
                                <Link to="/mapa" className={`${navPill} ${isActive('/mapa') ? navPillActive : navPillInactive}`}>
                                    <MapPin size={14} /> Mapa
                                </Link>
                                <Link to="/standings" className={`${navPill} ${isActive('/standings') ? navPillActive : navPillInactive}`}>
                                    <BarChart2 size={14} /> Classificações
                                </Link>
                            </div>
                        </div>

                        {/* Center spacer on mobile */}
                        <div className="absolute left-1/2 -translate-x-1/2 sm:hidden z-10" />

                        {/* RIGHT: Search + Club selector (desktop) + About + Theme */}
                        <div className="flex items-center gap-1 ml-auto">
                            <button onClick={() => setSearchOpen(true)} className="hidden sm:flex items-center gap-1.5 px-2 py-1.5 rounded-full text-xs font-bold transition-all text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5 hover:text-zinc-700 dark:hover:text-zinc-200">
                                <Search size={14} />
                            </button>

                            <Link to="/about" className={`hidden sm:flex ${navIcon} ${isActive('/about') ? 'text-dribly-purple bg-dribly-purple/10' : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5'}`} aria-label="Sobre">
                                <Info size={17} />
                            </Link>
                            <Link to="/about" className={`sm:hidden ${navIcon} ${isActive('/about') ? 'text-dribly-purple bg-dribly-purple/10' : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5'}`} aria-label="Sobre">
                                <Info size={18} />
                            </Link>
                            {user ? (
                                <Link to="/perfil"
                                    className={`${navIcon} text-dribly-purple bg-dribly-purple/10`}
                                    aria-label="Perfil">
                                    <div className="w-7 h-7 rounded-full bg-dribly-purple text-white flex items-center justify-center">
                                        <span className="text-[11px] font-bold">{user.email?.charAt(0).toUpperCase()}</span>
                                    </div>
                                </Link>
                            ) : (
                                <button
                                    onClick={() => setAuthOpen(true)}
                                    className={`${navIcon} text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5`}
                                    aria-label="Iniciar sessão">
                                    <LogIn size={17} />
                                </button>
                            )}
                            <button onClick={toggleTheme} className={`${navIcon} text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5`} aria-label="Tema">
                                {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
                            </button>
                        </div>

                    </div>
                    </div>
                </div>
            </nav>

            <main className="flex-grow pt-4 md:pt-6 pb-24">
                <ErrorBoundary>
                    <Outlet />
                </ErrorBoundary>
            </main>

            <footer className="hidden md:block bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-white/10 py-8">
                <div className="max-w-5xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-zinc-500">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-zinc-900 dark:text-white">Dribly</span>
                        <span className="text-zinc-400">•</span>
                        <span>&copy; {new Date().getFullYear()}</span>
                    </div>
                    <div className="flex gap-4">
                        <a href="https://www.instagram.com/dribly" target="_blank" rel="noopener noreferrer" className="hover:text-dribly-purple transition-colors">
                            <Instagram size={20} />
                        </a>
                        <a href="https://github.com/mefrraz/dribly" target="_blank" rel="noopener noreferrer" className="hover:text-dribly-purple transition-colors">
                            <Github size={20} />
                        </a>
                    </div>
                </div>
            </footer>

            <BottomNav />
            <PWAInstallBanner />
            <ToastContainer />
            <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
            <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} onAuthSuccess={handleAuthSuccess} />
            {onboardingTrigger && (
                <OnboardingTour
                    key={onboardingTrigger}
                    trigger={onboardingTrigger}
                    onComplete={() => {
                        setOnboardingTrigger(null)
                        setShowSuggestions(true)
                    }}
                />
            )}
            {showSuggestions && (
                <PostOnboardingSuggestions
                    onComplete={() => setShowSuggestions(false)}
                />
            )}
        </div>
    )
}

export default Layout