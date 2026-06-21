import { HashRouter, Routes, Route } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { useState, useEffect, lazy, Suspense } from 'react'
import Layout from './Layout'
import ClubLayout from './pages/club/ClubLayout'
import Landing from './pages/Landing'
import Home from './pages/Home'
import ClubHome from './pages/club/ClubHome'
import ClubGames from './pages/club/ClubGames'
import Standings from './pages/Standings'
import AssociationCompetitions from './pages/AssociationCompetitions'
import CompetitionPhases from './pages/CompetitionPhases'
import About from './pages/About'
import Settings from './pages/Settings'
import Privacy from './pages/Privacy'
import Install from './pages/Install'
import SearchPage from './pages/SearchPage'
import Following from './pages/Following'
import ClubsPage from './pages/ClubsPage'
import ProfilePage from './pages/ProfilePage'
import Leagues from './pages/Leagues'
import Ranking from './pages/Ranking'
import CompetitionDetail from './pages/CompetitionDetail'
import ClubTeams from './pages/club/ClubTeams'
import ClubTeamDetail from './pages/club/ClubTeamDetail'
import AthletePage from './pages/Athlete'
import NotFound from './pages/NotFound'
import { AdminRoute } from './components/AdminRoute'
import { AdminLayout } from './pages/admin/AdminLayout'
import Dashboard from './pages/admin/Dashboard'
import ClubesAdmin from './pages/admin/ClubesAdmin'
import PavilionsAdmin from './pages/admin/PavilionsAdmin'
import UsersAdmin from './pages/admin/UsersAdmin'
import GamesAdmin from './pages/admin/GamesAdmin'
import CompetitionsAdmin from './pages/admin/CompetitionsAdmin'
import ScrapeAdmin from './pages/admin/ScrapeAdmin'
import CalendarAdmin from './pages/admin/CalendarAdmin'
import NotificationsAdmin from './pages/admin/NotificationsAdmin'
import PostsAdmin from './pages/admin/PostsAdmin'
import { ClubProvider } from './lib/ClubContext'
import { AuthProvider } from './lib/AuthContext'
import SplashScreen from './components/SplashScreen'
import { LoadingSpinner } from './components/LoadingSpinner'

// Lazy-load heavy pages (leaflet, recharts) — only loaded when visited
const Game = lazy(() => import('./pages/Game'))
const Mapa = lazy(() => import('./pages/Mapa'))
const PavilionPage = lazy(() => import('./pages/PavilionPage'))

const PageFallback = () => <LoadingSpinner />

// Smart landing: /inicio on mobile, original landing on desktop
function SmartLanding() {
    const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
    useEffect(() => {
        const handler = () => setIsMobile(window.innerWidth < 768)
        window.addEventListener('resize', handler)
        return () => window.removeEventListener('resize', handler)
    }, [])
    return isMobile ? <Home /> : <Landing />
}

function App() {
    const [splashDone, setSplashDone] = useState(() => sessionStorage.getItem('dribly_splash_shown') === '1')



    return (
        <HelmetProvider>
        <HashRouter>
            <AuthProvider>
            <ClubProvider>
                {!splashDone && <SplashScreen onDone={() => { sessionStorage.setItem('dribly_splash_shown', '1'); setSplashDone(true) }} />}
                <Suspense fallback={<PageFallback />}>
                <Routes>
                    <Route path="/" element={<Layout />}>
                        <Route index element={<SmartLanding />} />
                        <Route path="inicio" element={<Home />} />
                        <Route path="clube/:slug" element={<ClubLayout />}>
                            <Route index element={<ClubHome />} />
                            <Route path="home" element={<ClubHome />} />
                            <Route path="games" element={<ClubGames />} />
                            <Route path="team" element={<ClubTeams />} />
                            <Route path="team/:teamId" element={<ClubTeamDetail />} />
                        </Route>
                        <Route path="jogo/:slug" element={<Game />} />
                        <Route path="classificacoes" element={<Standings />} />
                        <Route path="classificacoes/:associationId" element={<AssociationCompetitions />} />
                        <Route path="classificacoes/:associationId/:competitionId" element={<CompetitionPhases />} />
                        <Route path="pesquisa" element={<SearchPage />} />
                        <Route path="seguidos" element={<Following />} />
                        <Route path="perfil" element={<ProfilePage />} />
                        <Route path="clubes" element={<ClubsPage />} />
                        <Route path="ligas" element={<Leagues />} />
                        <Route path="ranking" element={<Ranking />} />
                        <Route path="mapa" element={<Mapa />} />
                        <Route path="pavilhao/:recintoId" element={<PavilionPage />} />
                        <Route path="competicao/:competitionId" element={<CompetitionDetail />} />
                        <Route path="atleta/:id" element={<AthletePage />} />
                        <Route path="sobre" element={<About />} />
                        <Route path="definicoes" element={<Settings />} />
                        <Route path="privacidade" element={<Privacy />} />
                        <Route path="instalar" element={<Install />} />
                        <Route path="*" element={<NotFound />} />
                    </Route>

                    {/* Admin — separate layout, Clerk-role protected */}
                    <Route path="/admin" element={<AdminRoute />}>
                        <Route element={<AdminLayout />}>
                            <Route index element={<Dashboard />} />
                            <Route path="clubes" element={<ClubesAdmin />} />
                            <Route path="pavilhoes" element={<PavilionsAdmin />} />
                            <Route path="utilizadores" element={<UsersAdmin />} />
                            <Route path="jogos" element={<GamesAdmin />} />
                            <Route path="competicoes" element={<CompetitionsAdmin />} />
                            <Route path="scrape" element={<ScrapeAdmin />} />
                            <Route path="calendario" element={<CalendarAdmin />} />
                            <Route path="notificacoes" element={<NotificationsAdmin />} />
                            <Route path="posts" element={<PostsAdmin />} />
                        </Route>
                    </Route>
                </Routes>
                </Suspense>
            </ClubProvider>
            </AuthProvider>
        </HashRouter>
        </HelmetProvider>
    )
}

export default App
