import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { useState, lazy, Suspense } from 'react'
import Layout from './Layout'
import ClubLayout from './pages/club/ClubLayout'
import Landing from './pages/Landing'
import ClubHome from './pages/club/ClubHome'
import ClubGames from './pages/club/ClubGames'
import Standings from './pages/Standings'
import AssociationCompetitions from './pages/AssociationCompetitions'
import CompetitionPhases from './pages/CompetitionPhases'
import About from './pages/About'
import Install from './pages/Install'
import SearchPage from './pages/SearchPage'
import Following from './pages/Following'
import ClubsPage from './pages/ClubsPage'
import ProfilePage from './pages/ProfilePage'
import Leagues from './pages/Leagues'
import CompetitionDetail from './pages/CompetitionDetail'
import ClubTeams from './pages/club/ClubTeams'
import ClubTeamDetail from './pages/club/ClubTeamDetail'
import AthletePage from './pages/Athlete'
import NotFound from './pages/NotFound'
import { AdminRoute } from './components/AdminRoute'
import { AdminLayout } from './pages/admin/AdminLayout'
import Dashboard from './pages/admin/Dashboard'
import ClubesAdmin from './pages/admin/ClubesAdmin'
import UsersAdmin from './pages/admin/UsersAdmin'
import GamesAdmin from './pages/admin/GamesAdmin'
import CompetitionsAdmin from './pages/admin/CompetitionsAdmin'
import { ClubProvider } from './lib/ClubContext'
import { AuthProvider } from './lib/AuthContext'
import SplashScreen from './components/SplashScreen'
import { LoadingSpinner } from './components/LoadingSpinner'

// Lazy-load heavy pages (leaflet, recharts) — only loaded when visited
const Game = lazy(() => import('./pages/Game'))
const Mapa = lazy(() => import('./pages/Mapa'))
const PavilionPage = lazy(() => import('./pages/PavilionPage'))

const PageFallback = () => <LoadingSpinner />

function App() {
    const [splashDone, setSplashDone] = useState(() => sessionStorage.getItem('dribly_splash_shown') === '1')

    return (
        <HelmetProvider>
        <BrowserRouter>
            <AuthProvider>
            <ClubProvider>
                {!splashDone && <SplashScreen onDone={() => { sessionStorage.setItem('dribly_splash_shown', '1'); setSplashDone(true) }} />}
                <Suspense fallback={<PageFallback />}>
                <Routes>
                    <Route path="/" element={<Layout />}>
                        <Route index element={<Landing />} />
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
                        <Route path="mapa" element={<Mapa />} />
                        <Route path="pavilhao/:recintoId" element={<PavilionPage />} />
                        <Route path="competicao/:competitionId" element={<CompetitionDetail />} />
                        <Route path="atleta/:id" element={<AthletePage />} />
                        <Route path="sobre" element={<About />} />
                        <Route path="instalar" element={<Install />} />
                        <Route path="*" element={<NotFound />} />
                    </Route>

                    {/* Admin — separate layout, Clerk-role protected */}
                    <Route path="/admin" element={<AdminRoute />}>
                        <Route element={<AdminLayout />}>
                            <Route index element={<Dashboard />} />
                            <Route path="clubes" element={<ClubesAdmin />} />
                            <Route path="utilizadores" element={<UsersAdmin />} />
                            <Route path="jogos" element={<GamesAdmin />} />
                            <Route path="competicoes" element={<CompetitionsAdmin />} />
                        </Route>
                    </Route>
                </Routes>
                </Suspense>
            </ClubProvider>
            </AuthProvider>
        </BrowserRouter>
        </HelmetProvider>
    )
}

export default App
