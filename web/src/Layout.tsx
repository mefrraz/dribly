import { useState, useEffect, useCallback } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { Sun, Moon, Instagram, Github, Info, BarChart2, Home as HomeIcon, Search, LogIn, Heart, Trophy, Building2, MapPin, Shield, TrendingUp, Sparkles } from 'lucide-react'
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
    const navigate = useNavigate()
    const { user } = useAuth()
    const { user: clerkUser } = useUser()
    const isAdmin = clerkUser?.publicMetadata?.role === 'admin'
    const isMapaPage = location.pathname === '/mapa'

    // ── Deep link from notification click ──
    useEffect(() => {
        const handler = (event: MessageEvent) => {
            if (event.data?.type === 'NOTIFICATION_CLICK' && event.data?.url) {
                const url = new URL(event.data.url)
                // Extract pathname + search from full URL for react-router
                const target = url.pathname + url.search
                navigate(target)
            }
        }
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', handler)
            return () => navigator.serviceWorker.removeEventListener('message', handler)
        }
    }, [navigate])

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
                            <Link to="/" className="flex items-center shrink-0 mr-1">
                                <span className="flex items-baseline font-black text-base sm:text-xl text-zinc-900 dark:text-zinc-100 tracking-tight">
                                    Dribly<span className="text-dribly-purple">.</span>
                                </span>
                            </Link>
                            <div className="hidden sm:flex items-center gap-1 ml-1">
                                <Link to="/" className={`${navPill} ${isActive('/') ? navPillActive : navPillInactive}`}>
                                    <HomeIcon size={14} /> Início
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
                            <Link to="/inicio" className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-dribly-purple/10 text-dribly-purple hover:bg-dribly-purple/20 transition-colors">
                                <Sparkles size={13} /> Novo
                            </Link>

                            <Link to="/inicio" className={`sm:hidden flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-dribly-purple/10 text-dribly-purple hover:bg-dribly-purple/20 transition-colors`}>
                                <Sparkles size={13} /> Novo
                            </Link>
                            <Link to="/sobre" className={`${navIcon} ${isActive('/sobre') ? 'text-dribly-purple bg-dribly-purple/10' : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5'}`} aria-label="Sobre">
                                <Info size={17} />
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
                            <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M6.167 8a.83.83 0 0 0-.83.83c0 .459.372.84.83.831a.831.831 0 0 0 0-1.661m1.843 3.647c.315 0 1.403-.038 1.976-.611a.23.23 0 0 0 0-.306.213.213 0 0 0-.306 0c-.353.363-1.126.487-1.67.487-.545 0-1.308-.124-1.671-.487a.213.213 0 0 0-.306 0 .213.213 0 0 0 0 .306c.564.563 1.652.61 1.977.61zm.992-2.807c0 .458.373.83.831.83s.83-.381.83-.83a.831.831 0 0 0-1.66 0z"/>
                                <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0m-3.828-1.165c-.315 0-.602.124-.812.325-.801-.573-1.9-.945-3.121-.993l.534-2.501 1.738.372a.83.83 0 1 0 .83-.869.83.83 0 0 0-.744.468l-1.938-.41a.2.2 0 0 0-.153.028.2.2 0 0 0-.086.134l-.592 2.788c-1.24.038-2.358.41-3.17.992-.21-.2-.496-.324-.81-.324a1.163 1.163 0 0 0-.478 2.224q-.03.17-.029.353c0 1.795 2.091 3.256 4.669 3.256s4.668-1.451 4.668-3.256c0-.114-.01-.238-.029-.353.401-.181.688-.592.688-1.069 0-.65-.525-1.165-1.165-1.165"/>
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