import { useMemo } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { Users, ChevronRight, Calendar } from 'lucide-react'
import { useGames } from '../../hooks/useGames'
import { useTeamPhotos } from '../../lib/useTeamPhotos'
import { SkeletonGameGrid } from '../../components/Skeleton'
import { type Club, displayName } from '../../lib/ClubContext'
import { type Match } from '../../components/types'

function slugify(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-+/g, '-')
}

function extractTeamId(fullTeamName: string, clubName: string, fallbackEscalao: string): string {
    const upperTeam = fullTeamName.toUpperCase()
    const upperClub = clubName.toUpperCase()
    let suffix = upperTeam
        .replace(new RegExp(upperClub.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '')
        .replace(/^[\s\-–—/]+/, '')
        .replace(/[\s\-–—/]+$/, '')
        .trim()
    if (!suffix || suffix.length < 2) suffix = fallbackEscalao || fullTeamName
    return suffix
}

function detectGender(teamName: string, escalao: string): 'M' | 'F' | null {
    const upper = (teamName + ' ' + (escalao || '')).toUpperCase()
    if (/\bFEMININ[OA]S?\b/.test(upper)) return 'F'
    if (/\bMASCULIN[OA]S?\b/.test(upper)) return 'M'
    return null
}

function formatShortDate(dateStr: string) {
    const d = new Date(dateStr)
    return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })
}

function fpbCoverPhoto(clubId: number): string {
    return `https://sav2.fpb.pt/uploads/clubes/capa/CLU_capa${clubId}.jpg`
}

const GENERO_CONFIG: Record<string, { label: string; className: string }> = {
    M: { label: 'Masculino', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    F: { label: 'Feminino', className: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400' },
}

interface TeamEntry {
    teamId: string
    slug: string
    escalao: string
    genero: 'M' | 'F' | null
    wins: number
    losses: number
    draws: number
    total: number
    pct: number | null
    lastGame: Match | null
    competition: string
}

function ClubTeams() {
    const { club } = useOutletContext<{ club: Club }>()
    const { games: allGames, loading } = useGames('2025/2026', club.id, club.name)
    const games = allGames || []
    const clubNameUpper = club.name.toUpperCase()
    const coverPhoto = fpbCoverPhoto(club.id)
    const { photos: teamPhotos } = useTeamPhotos(club.id, club.name)

    const teams = useMemo(() => {
        const teamMap = new Map<string, Match[]>()
        games.forEach(g => {
            let fullTeamName = ''
            if (g.equipa_casa.toUpperCase().includes(clubNameUpper)) {
                fullTeamName = g.equipa_casa
            } else if (g.equipa_fora.toUpperCase().includes(clubNameUpper)) {
                fullTeamName = g.equipa_fora
            }
            if (!fullTeamName) return
            const teamId = extractTeamId(fullTeamName, club.name, g.escalao || '')
            if (!teamMap.has(teamId)) teamMap.set(teamId, [])
            teamMap.get(teamId)!.push(g)
        })

        const entries: TeamEntry[] = []
        teamMap.forEach((teamGames, teamId) => {
            const escalao = teamGames[0]?.escalao || ''
            const finished = teamGames.filter(g => g.status === 'FINALIZADO')
            const lastGame = finished.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())[0] || null

            let wins = 0, losses = 0, draws = 0
            finished.forEach(g => {
                const clubHome = g.equipa_casa.toUpperCase().includes(clubNameUpper)
                if (g.resultado_casa === null || g.resultado_fora === null) return
                if (g.resultado_casa === g.resultado_fora) { draws++; return }
                if (clubHome ? g.resultado_casa > g.resultado_fora : g.resultado_fora > g.resultado_casa) wins++
                else losses++
            })

            const total = wins + losses + draws
            const pct = total > 0 ? Math.round(wins / (wins + losses) * 100) : null

            const competitions = [...new Set(teamGames.map(g => g.competicao).filter(Boolean))]
            const mainComp = competitions[0] || ''

            entries.push({
                teamId,
                slug: slugify(teamId),
                escalao,
                genero: detectGender(teamId, escalao),
                wins, losses, draws, total, pct,
                lastGame,
                competition: mainComp,
            })
        })

        entries.sort((a, b) => a.teamId.localeCompare(b.teamId))
        return entries
    }, [games, clubNameUpper, club.name])

    if (loading) {
        return (
            <div className="max-w-xl mx-auto px-3 pt-4">
                <SkeletonGameGrid days={3} count={2} />
            </div>
        )
    }

    if (teams.length === 0) {
        return (
            <div className="max-w-xl mx-auto px-3 py-20 text-center">
                <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-4">
                    <Users size={28} className="text-zinc-400" />
                </div>
                <p className="text-sm font-medium text-zinc-500">Nenhuma equipa encontrada</p>
                <p className="text-xs text-zinc-400 mt-1">Os dados podem ainda não estar disponíveis.</p>
            </div>
        )
    }

    return (
        <div className="max-w-xl mx-auto space-y-4 pb-20 px-3">
            <div className="pt-3 pb-1">
                <h2 className="text-xl font-black text-zinc-900 dark:text-white">Equipas</h2>
                <p className="text-xs text-zinc-500 mt-1">{teams.length} equipas de {displayName(club)} na época 2025/2026</p>
            </div>

            <div className="grid grid-cols-3 gap-2">
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3 text-center shadow-sm">
                    <p className="text-2xl font-black text-dribly-purple">{teams.length}</p>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Equipas</p>
                </div>
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3 text-center shadow-sm">
                    <p className="text-2xl font-black text-zinc-900 dark:text-white">{teams.reduce((s, t) => s + t.total, 0)}</p>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Jogos</p>
                </div>
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3 text-center shadow-sm">
                    <p className="text-2xl font-black text-green-600 dark:text-green-400">{teams.reduce((s, t) => s + t.wins, 0)}</p>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Vitórias</p>
                </div>
            </div>

            <Link
                to={`/clube/${club.slug}/team`}
                className="block bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden hover:shadow-md hover:border-dribly-purple/30 dark:hover:border-dribly-purple/30 transition-all duration-200"
            >
                <div className="relative h-36 bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    <img
                        src={coverPhoto}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                        <p className="text-white text-sm font-black drop-shadow-md">{club.name}</p>
                        <p className="text-white/80 text-xs">{teams.length} equipas · Época 2025/2026</p>
                    </div>
                </div>
            </Link>

            <div className="space-y-2.5">
                {teams.map(team => {
                    // Build comprehensive lookup keys
                    const norm = (s: string) => s.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()
                    const clubNorm = norm(club.name)
                    const keys = [
                        team.teamId, team.teamId.toLowerCase(), team.teamId.toUpperCase(), norm(team.teamId),
                    ]
                    // Without gender
                    const noGender = team.teamId.replace(/\s+(MASCULINO|FEMININO|Masculino|Feminino)\s*$/i, '').trim()
                    if (noGender && noGender !== team.teamId) {
                        keys.push(noGender, noGender.toLowerCase(), noGender.toUpperCase(), norm(noGender))
                    }
                    // Individual words of teamId
                    for (const w of team.teamId.split(/\s+/)) {
                        if (w.length > 2) { keys.push(w, w.toLowerCase(), w.toUpperCase(), norm(w)) }
                    }
                    // Club name as fallback (most FPB competition pages show club-level names)
                    keys.push(club.name, club.name.toLowerCase(), clubNorm)
                    // Individual words of club name
                    for (const w of club.name.split(/\s+/)) {
                        if (w.length > 2) { keys.push(w, w.toLowerCase(), w.toUpperCase(), norm(w)) }
                    }

                    let photoUrl: string | undefined
                    for (const k of keys) {
                        if (teamPhotos[k]) { photoUrl = teamPhotos[k]; break }
                    }
                    return (
                        <Link
                            key={team.teamId}
                            to={`/clube/${club.slug}/team/${team.slug}`}
                            className="block bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden hover:shadow-md hover:border-dribly-purple/30 dark:hover:border-dribly-purple/30 transition-all duration-200"
                        >
                            {photoUrl && (
                                <div className="relative h-32 bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                                    <img
                                        src={photoUrl}
                                        alt=""
                                        className="absolute inset-0 w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                                </div>
                            )}
                            <div className="p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white truncate">
                                            {team.teamId}
                                        </h3>
                                        <div className="flex items-center gap-1.5 mt-1">
                                            {team.escalao && (
                                                <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
                                                    {team.escalao}
                                                </span>
                                            )}
                                            {team.genero ? (
                                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${GENERO_CONFIG[team.genero].className}`}>
                                                    {GENERO_CONFIG[team.genero].label}
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
                                                    Indefinido
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <ChevronRight size={16} className="text-zinc-400 shrink-0 mt-1" />
                                </div>

                                {team.total > 0 ? (
                                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                                        <div className="flex items-center gap-4">
                                            <div>
                                                <span className="text-base font-black text-zinc-900 dark:text-white">{team.total}</span>
                                                <span className="text-[10px] text-zinc-500 ml-0.5">J</span>
                                            </div>
                                            <div>
                                                <span className="text-base font-black text-green-600 dark:text-green-400">{team.wins}</span>
                                                <span className="text-[10px] text-green-600/70 dark:text-green-400/70 ml-0.5">V</span>
                                            </div>
                                            <div>
                                                <span className="text-base font-black text-red-500">{team.losses}</span>
                                                <span className="text-[10px] text-red-500/70 ml-0.5">D</span>
                                            </div>
                                            {team.pct !== null && (
                                                <span className="text-xs font-bold text-zinc-500">{team.pct}%</span>
                                            )}
                                        </div>
                                        <div className="flex-1" />
                                        {team.lastGame && (
                                            <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                                                <Calendar size={11} />
                                                <span>{formatShortDate(team.lastGame.data)}</span>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                                        <Calendar size={12} className="text-zinc-400" />
                                        <span className="text-xs text-zinc-400 italic">Sem jogos ainda esta época</span>
                                    </div>
                                )}
                            </div>
                        </Link>
                    )
                })}
            </div>
        </div>
    )
}

export default ClubTeams
