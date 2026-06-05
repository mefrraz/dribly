import { useMemo } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { Users, ChevronRight, Calendar, ArrowLeft } from 'lucide-react'
import { useGames } from '../../hooks/useGames'
import { useTeamPhotos } from '../../lib/useTeamPhotos'
import { SkeletonGameGrid } from '../../components/Skeleton'
import { type Club, displayName } from '../../lib/ClubContext'
import { type Match } from '../../components/types'

function slugify(text: string): string {
    return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-+/g, '-')
}

function extractTeamId(fullTeamName: string, clubName: string, fallbackEscalao: string): string {
    const upperTeam = fullTeamName.toUpperCase()
    const upperClub = clubName.toUpperCase()
    let suffix = upperTeam
        .replace(new RegExp(upperClub.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '')
        .replace(/^[\s\-–—/]+/, '').replace(/[\s\-–—/]+$/, '').trim()
    if (!suffix || suffix.length < 2) suffix = fallbackEscalao || fullTeamName
    return suffix
}

function formatShortDate(dateStr: string) {
    const d = new Date(dateStr)
    return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })
}

interface TeamStats { wins: number; losses: number; draws: number; total: number; pct: number | null; lastGame: Match | null }

function ClubTeams() {
    const { club } = useOutletContext<{ club: Club }>()
    const { games: allGames, loading: gamesLoading } = useGames('2025/2026', club.id, club.name)
    const { teams: fpbTeams, loading: teamDataLoading } = useTeamPhotos(club.id, club.name)
    const games = allGames || []
    const clubNameUpper = club.name.toUpperCase()

    // Build game stats per team from game data
    const gameStats = useMemo(() => {
        const map = new Map<string, Match[]>()
        games.forEach(g => {
            let fullTeamName = ''
            if (g.equipa_casa.toUpperCase().includes(clubNameUpper)) fullTeamName = g.equipa_casa
            else if (g.equipa_fora.toUpperCase().includes(clubNameUpper)) fullTeamName = g.equipa_fora
            if (!fullTeamName) return
            const tid = extractTeamId(fullTeamName, club.name, g.escalao || '')
            if (!map.has(tid)) map.set(tid, [])
            map.get(tid)!.push(g)
        })
        const stats = new Map<string, TeamStats>()
        map.forEach((tg, tid) => {
            const finished = tg.filter(g => g.status === 'FINALIZADO')
            let wins = 0, losses = 0, draws = 0
            finished.forEach(g => {
                const ch = g.equipa_casa.toUpperCase().includes(clubNameUpper)
                if (g.resultado_casa === null || g.resultado_fora === null) return
                if (g.resultado_casa === g.resultado_fora) { draws++; return }
                if (ch ? g.resultado_casa > g.resultado_fora : g.resultado_fora > g.resultado_casa) wins++; else losses++
            })
            const total = wins + losses + draws
            const lastGame = [...finished].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())[0] || null
            stats.set(tid, { wins, losses, draws, total, pct: total > 0 ? Math.round(wins / (wins + losses) * 100) : null, lastGame })
        })
        return stats
    }, [games, clubNameUpper, club.name])

    if (gamesLoading || teamDataLoading) {
        return <div className="max-w-xl mx-auto px-3 pt-4"><SkeletonGameGrid days={3} count={2} /></div>
    }

    // Sort: oldest escalão first, same escalão: A before B
    const escalaoOrder = ['MASTERS', 'VETERANOS', 'SENIOR', 'SUB23', 'SUB22', 'SUB18', 'SUB16', 'SUB14', 'MINI12', 'MINI10', 'MINI8']
    function escalaoPriority(name: string): number {
        const n = name.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        for (let i = 0; i < escalaoOrder.length; i++) if (n.includes(escalaoOrder[i])) return i
        return escalaoOrder.length
    }
    const displayTeams = [...fpbTeams].sort((a, b) => {
        const pa = escalaoPriority(a.escalao || a.nome)
        const pb = escalaoPriority(b.escalao || b.nome)
        if (pa !== pb) return pa - pb
        // Same escalão: A before B
        const aA = /\bA\b/.test(a.nome); const bA = /\bA\b/.test(b.nome)
        if (aA && !bA) return -1; if (!aA && bA) return 1
        return a.nome.localeCompare(b.nome)
    })

    if (displayTeams.length === 0) {
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
            <Link to={`/clube/${club.slug}/home`} className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 mb-3 group">
                <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                {displayName(club)}
            </Link>
            <div className="pt-1 pb-1">
                <h2 className="text-xl font-black text-zinc-900 dark:text-white">Equipas</h2>
                <p className="text-xs text-zinc-500 mt-1">{displayTeams.length} equipas de {displayName(club)} na época 2025/2026</p>
            </div>

            <div className="grid grid-cols-3 gap-2">
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3 text-center shadow-sm">
                    <p className="text-2xl font-black text-dribly-purple">{displayTeams.length}</p>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Equipas</p>
                </div>
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3 text-center shadow-sm">
                    <p className="text-2xl font-black text-zinc-900 dark:text-white">{[...gameStats.values()].reduce((s, t) => s + t.total, 0)}</p>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Jogos</p>
                </div>
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3 text-center shadow-sm">
                    <p className="text-2xl font-black text-green-600 dark:text-green-400">{[...gameStats.values()].reduce((s, t) => s + t.wins, 0)}</p>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Vitórias</p>
                </div>
            </div>

            <div className="space-y-2.5">
                {displayTeams.map(team => {
                    // Try to find matching game stats: try escalão, then team name words
                    const norm = (s: string) => s.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()
                    const searchTerms = new Set<string>()
                    searchTerms.add(norm(team.escalao || ''))
                    for (const w of (team.escalao || '').split(/\s+/)) { if (w.length > 2) searchTerms.add(norm(w)) }
                    for (const w of team.nome.split(/[\s\-]+/)) { if (w.length > 2) searchTerms.add(norm(w)) }
                    searchTerms.delete('')

                    let stats: TeamStats | undefined
                    for (const [key, s] of gameStats) {
                        const kn = norm(key)
                        for (const st of searchTerms) {
                            if (kn.includes(st) || st.includes(kn)) { stats = s; break }
                        }
                        if (stats) break
                    }

                    return (
                        <Link
                            key={team.id}
                            to={`/clube/${club.slug}/team/${slugify(team.escalao || team.nome)}`}
                            className="block bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden hover:shadow-md hover:border-dribly-purple/30 dark:hover:border-dribly-purple/30 transition-all duration-200"
                        >
                            {team.photo && (
                                <div className="relative h-48 bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                                    <img src={team.photo} alt="" className="absolute inset-0 w-full h-full object-cover object-center" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                                </div>
                            )}
                            <div className="p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white truncate">
                                            {team.nome}
                                        </h3>
                                        {team.escalao && (
                                            <div className="flex items-center gap-1.5 mt-1">
                                                <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
                                                    {team.escalao}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <ChevronRight size={16} className="text-zinc-400 shrink-0 mt-1" />
                                </div>

                                {stats && stats.total > 0 ? (
                                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                                        <div><span className="text-base font-black text-zinc-900 dark:text-white">{stats.total}</span><span className="text-[10px] text-zinc-500 ml-0.5">J</span></div>
                                        <div><span className="text-base font-black text-green-600 dark:text-green-400">{stats.wins}</span><span className="text-[10px] text-green-600/70 dark:text-green-400/70 ml-0.5">V</span></div>
                                        <div><span className="text-base font-black text-red-500">{stats.losses}</span><span className="text-[10px] text-red-500/70 ml-0.5">D</span></div>
                                        {stats.pct !== null && <span className="text-xs font-bold text-zinc-500">{stats.pct}%</span>}
                                        <div className="flex-1" />
                                        {stats.lastGame && <div className="flex items-center gap-1.5 text-[10px] text-zinc-400"><Calendar size={11} /><span>{formatShortDate(stats.lastGame.data)}</span></div>}
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
