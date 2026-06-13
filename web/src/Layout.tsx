import { useState, useEffect, useCallback } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { Sun, Moon, Instagram, Github, Info, BarChart2, Home, Search, LogIn, Heart, Trophy, Building2, MapPin, Shield, TrendingUp } from 'lucide-react'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ToastContainer } from './components/Toast'
import PWAInstallBanner from './components/PWAInstallBanner'
import BottomNav from './components/BottomNav'
import { SearchModal } from './components/SearchModal'
import { AuthModal } from './components/AuthModal'
import { OnboardingTour, type TourTrigger } from './components/OnboardingTour'
import { PostOnboardingSuggestions } from './components/PostOnboardingSuggestions'
import { useAuth } from './lib/AuthContext'
import { useUser } from '@clerk/clerk-react'

// ── Page view beacon (once per session per page) ──────

const VIEWED_KEY = 'dribly_viewed_pages'
declare const __GIT_HASH__: string

function trackPageView() {
    const today = new Date().toISOString().split('T')[0]
    const raw = localStorage.getItem(VIEWED_KEY)
    const viewed: string[] = raw ? JSON.parse(raw) : []
    // Already tracked today → skip
    if (viewed.includes(today)) return
    // Fire beacon (fire-and-forget)
    fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'trackPageView' }),
    }).catch(() => {})
    // Mark today as tracked
    viewed.push(today)
    // Keep only last 7 days to avoid localStorage bloat
    while (viewed.length > 7) viewed.shift()
    localStorage.setItem(VIEWED_KEY, JSON.stringify(viewed))
}

function Layout() {
    const [theme, setTheme] = useState(() => localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'))
    const [searchOpen, setSearchOpen] = useState(false)
    const [authOpen, setAuthOpen] = useState(false)
    const [onboardingTrigger, setOnboardingTrigger] = useState<TourTrigger | null>(null)
    const [showSuggestions, setShowSuggestions] = useState(false)
    const location = useLocation()
    const { user } = useAuth()
    const { user: clerkUser } = useUser()
    const isAdmin = clerkUser?.publicMetadata?.role === 'admin'
    const isMapaPage = location.pathname === '/mapa'

    const handleAuthSuccess = useCallback((method: 'signin' | 'signup') => {
        if (method === 'signup') {
            setTimeout(() => {
                setOnboardingTrigger(method as TourTrigger)
            }, 500)
        }
    }, [])

    useEffect(() => { window.scrollTo(0, 0) }, [location.pathname])

    // Track page view (once per day)
    useEffect(() => { trackPageView() }, [location.pathname])

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
                                <Link to="/ranking" className={`${navPill} ${isActive('/ranking') ? navPillActive : navPillInactive}`}>
                                    <TrendingUp size={14} /> Ranking
                                </Link>
                                <Link to="/classificacoes" className={`${navPill} ${isActive('/classificacoes') ? navPillActive : navPillInactive}`}>
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

                            <Link to="/sobre" className={`hidden sm:flex ${navIcon} ${isActive('/sobre') ? 'text-dribly-purple bg-dribly-purple/10' : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5'}`} aria-label="Sobre">
                                <Info size={17} />
                            </Link>
                            <Link to="/sobre" className={`sm:hidden ${navIcon} ${isActive('/sobre') ? 'text-dribly-purple bg-dribly-purple/10' : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5'}`} aria-label="Sobre">
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
                            {isAdmin && (
                                <Link to="/admin" className={`${navIcon} text-dribly-purple hover:bg-dribly-purple/10`} aria-label="Admin" title="Painel de administração">
                                    <Shield size={17} />
                                </Link>
                            )}
                        </div>

                    </div>
                    </div>
                </div>
            </nav>

            <main className="flex-grow pt-4 md:pt-6 pb-24 page-fade-in">
                <ErrorBoundary>
                    <Outlet />
                </ErrorBoundary>
            </main>

            {!isMapaPage && (
            <footer className="hidden md:block bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-white/10 py-8">
                <div className="max-w-5xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-zinc-500">
                    <div className="flex items-center gap-2">
                        <Link to="/" className="font-bold text-zinc-900 dark:text-white hover:text-dribly-purple transition-colors">Dribly</Link>
                        <span className="text-zinc-400">•</span>
                        <span>&copy; {new Date().getFullYear()}</span>
                        <span className="text-zinc-400">•</span>
                        <Link to="/privacidade" className="hover:text-dribly-purple transition-colors">Privacidade</Link>
                        <span className="text-zinc-400">•</span>
                        <span className="text-xs text-zinc-400 font-mono">{__GIT_HASH__}</span>
                    </div>
                    <div className="flex gap-4">
                        <a href="https://www.instagram.com/dribly" target="_blank" rel="noopener noreferrer" className="hover:text-dribly-purple transition-colors">
                            <Instagram size={20} />
                        </a>
                        <a href="https://www.reddit.com/user/frraz_me" target="_blank" rel="noopener noreferrer" className="hover:text-dribly-purple transition-colors">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547.8-3.747c.007-.06.091-.101.154-.067.654.374 1.38.64 2.146.744.064.009.104.1.065.152a3.3 3.3 0 0 1-.74.88c-.05.04-.15.01-.18-.04-.013-.02-.02-.04-.02-.06l-.4-1.43-1.12 4.8zm-5.07.303c1.93.008 3.49.287 4.82.83a5.5 5.5 0 0 1 2.11 1.63c.47.598.74 1.323.74 2.133 0 .717-.2 1.382-.6 1.94-.39.558-.94.98-1.6 1.25.2 2.09-1.18 4.26-4.76 4.26-2.95 0-4.44-1.56-4.87-3.18a.06.06 0 0 1 .04-.08c.5-.1 2.27-.52 2.65-.63a.05.05 0 0 1 .07.03c.16.69.7 1.86 2.14 1.86 1.3 0 2.08-.78 2.3-1.63a3.3 3.3 0 0 1-1.91-.67.08.08 0 0 1-.02-.11c.28-.4.68-1.26.86-1.8a.04.04 0 0 1 .04-.03c1.53-.09 2.74-.35 3.7-.71.3-.14.54-.35.69-.62.15-.27.2-.54.2-.81 0-.6-.2-1.09-.59-1.47-.4-.38-.95-.64-1.59-.78a7.2 7.2 0 0 0-3.82.08c-.64.2-1.1.46-1.32.61-.02.02-.06.02-.08 0-.22-.15-.68-.41-1.32-.6a7.2 7.2 0 0 0-1.93-.24zm-3.58.41c-.2.5-.46.97-.78 1.1-.27.13-.6.06-1-.18-.4-.24-.85-.37-1.23-.25-.4.13-.59.53-.48 1.02.05.24.24.42.39.54.04.02.05.1 0 .13-.57-.22-.96-.6-.96-1.1 0-.83.58-1.38 1.42-1.48.61-.08 1.27.18 1.79.37.06.02.08.04.08.08 0 .04-.02.07-.06.09a4.6 4.6 0 0 0-.46.28c-.05.02-.1 0-.12-.03a3.6 3.6 0 0 1-.4-.34c-.01-.02-.03-.03-.04-.03zm11.71.68c.4-.4.96-.3 1.3 0 .03.03.07.04.1.01a5 5 0 0 0 .5-.72c.03-.06.01-.12-.05-.15-.88-.42-1.9-.6-2.83-.44-.1.02-.13.12-.09.2a3.8 3.8 0 0 1 .36 1.03c.02.07.1.1.16.06z"/>
                            </svg>
                        </a>
                        <a href="https://github.com/mefrraz/dribly" target="_blank" rel="noopener noreferrer" className="hover:text-dribly-purple transition-colors">
                            <Github size={20} />
                        </a>
                    </div>
                </div>
            </footer>
            )}

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