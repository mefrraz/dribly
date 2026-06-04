import { useMemo } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { Users, ChevronRight, TrendingUp, Target, Activity } from 'lucide-react'
import { useGames } from '../../hooks/useGames'
import { SkeletonGameGrid } from '../../components/Skeleton'
import { type Club, displayName } from '../../lib/ClubContext'
import { type Match } from '../../components/types'

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

interface TeamEntry {
    teamId: string
    escalao: string
    wins: number
    losses: number
    draws: number
    total: number
    pct: number | null
    lastResult: 'W' | 'L' | 'D' | null
    lastGame: Match | null
}

function ClubTeams() {
    const { club } = useOutletContext<{ club: Club }>()
    const { games: allGames, loading } = useGames('2025/2026', club.id, club.name)
    const games = allGames || []
    const clubNameUpper = club.name.toUpperCase()

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

            let lastResult: 'W' | 'L' | 'D' | null = null
            if (lastGame && lastGame.resultado_casa !== null && lastGame.resultado_fora !== null) {
                const home = lastGame.equipa_casa.toUpperCase().includes(clubNameUpper)
                if (lastGame.resultado_casa === lastGame.resultado_fora) lastResult = 'D'
                else if (home ? lastGame.resultado_casa > lastGame.resultado_fora : lastGame.resultado_fora > lastGame.resultado_casa) lastResult = 'W'
                else lastResult = 'L'
            }

            entries.push({ teamId, escalao, wins, losses, draws, total, pct, lastResult, lastGame })
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
                <div className="glass-card p-3 text-center">
                    <p className="text-2xl font-black text-[var(--club-color)]">{teams.length}</p>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Equipas</p>
                </div>
                <div className="glass-card p-3 text-center">
                    <p className="text-2xl font-black text-zinc-900 dark:text-white">{teams.reduce((s, t) => s + t.total, 0)}</p>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Jogos</p>
                </div>
                <div className="glass-card p-3 text-center">
                    <p className="text-2xl font-black text-green-600 dark:text-green-400">{teams.reduce((s, t) => s + t.wins, 0)}</p>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Vitórias</p>
                </div>
            </div>

            <div className="space-y-3">
                {teams.map(team => (
                    <Link
                        key={team.teamId}
                        to={`/clube/${club.slug}/team/${encodeURIComponent(team.teamId)}`}
                        className="glass-card overflow-hidden group hover:border-[var(--club-color)]/30 transition-all duration-200"
                    >
                        <div className="p-5">
                            <div className="flex items-start gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--club-color)] to-[var(--club-color)]/70 dark:from-[var(--club-color)] dark:to-[var(--club-color)]/50 flex items-center justify-center shrink-0 shadow-md shadow-[var(--club-color)]/20 group-hover:scale-105 transition-transform">
                                    <span className="text-lg font-black text-white">{team.teamId.charAt(0).toUpperCase()}</span>
                                </div>

                                <div className="min-w-0 flex-1">
                                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white group-hover:text-[var(--club-color)] transition-colors truncate">
                                        {team.teamId.length > 30 ? team.teamId.substring(0, 27) + '...' : team.teamId}
                                    </h3>
                                    {team.escalao && (
                                        <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-[var(--club-color)]/10 text-[10px] font-bold text-[var(--club-color)]">
                                            {team.escalao}
                                        </span>
                                    )}
                                </div>

                                <ChevronRight size={18} className="text-zinc-400 group-hover:text-[var(--club-color)] shrink-0 mt-1 transition-colors" />
                            </div>

                            {team.total > 0 ? (
                                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-zinc-100 dark:border-white/5">
                                    <div className="flex items-center gap-1.5">
                                        <Target size={13} className="text-green-500" />
                                        <span className="text-xs font-semibold text-green-600 dark:text-green-400">{team.wins}V</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Target size={13} className="text-red-400 rotate-180" />
                                        <span className="text-xs font-semibold text-red-500">{team.losses}D</span>
                                    </div>
                                    <div className="flex-1" />
                                    <div className="flex items-center gap-1.5">
                                        <Activity size={13} className="text-zinc-400" />
                                        <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{team.total} jogos</span>
                                    </div>
                                    {team.pct !== null && (
                                        <div className="flex items-center gap-1.5">
                                            <TrendingUp size={13} className="text-[var(--club-color)]" />
                                            <span className="text-xs font-bold text-[var(--club-color)]">{team.pct}%</span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-white/5">
                                    <p className="text-xs text-zinc-400 italic">Sem jogos ainda esta época</p>
                                </div>
                            )}
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    )
}

export default ClubTeams
