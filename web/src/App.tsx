import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { useState } from 'react'
import Layout from './Layout'
import ClubLayout from './pages/club/ClubLayout'
import Landing from './pages/Landing'
import ClubHome from './pages/club/ClubHome'
import ClubGames from './pages/club/ClubGames'
import Game from './pages/Game'
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
import Mapa from './pages/Mapa'
import PavilionPage from './pages/PavilionPage'
import ClubTeams from './pages/club/ClubTeams'
import ClubTeamDetail from './pages/club/ClubTeamDetail'
import NotFound from './pages/NotFound'
import { ClubProvider } from './lib/ClubContext'
import { AuthProvider } from './lib/AuthContext'
import SplashScreen from './components/SplashScreen'

function App() {
    const [splashDone, setSplashDone] = useState(() => sessionStorage.getItem('dribly_splash_shown') === '1')

    return (
        <HelmetProvider>
        <BrowserRouter>
            <AuthProvider>
            <ClubProvider>
                {!splashDone && <SplashScreen onDone={() => { sessionStorage.setItem('dribly_splash_shown', '1'); setSplashDone(true) }} />}
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
                        <Route path="game/:slug" element={<Game />} />
                        <Route path="standings" element={<Standings />} />
                        <Route path="standings/:associationId" element={<AssociationCompetitions />} />
                        <Route path="standings/:associationId/:competitionId" element={<CompetitionPhases />} />
                        <Route path="search" element={<SearchPage />} />
                        <Route path="seguidos" element={<Following />} />
                        <Route path="perfil" element={<ProfilePage />} />
                        <Route path="clubes" element={<ClubsPage />} />
                        <Route path="ligas" element={<Leagues />} />
                        <Route path="mapa" element={<Mapa />} />
                        <Route path="pavilhao/:recintoId" element={<PavilionPage />} />
                        <Route path="competicao/:competitionId" element={<CompetitionDetail />} />
                        <Route path="about" element={<About />} />
                        <Route path="install" element={<Install />} />
                        <Route path="*" element={<NotFound />} />
                    </Route>
                </Routes>
            </ClubProvider>
            </AuthProvider>
        </BrowserRouter>
        </HelmetProvider>
    )
}

export default App
