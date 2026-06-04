import { useState, useEffect, useMemo } from 'react'
import { Link, useParams, useSearchParams, useOutletContext } from 'react-router-dom'
import { ArrowLeft, Calendar, Trophy } from 'lucide-react'
import { useGames } from '../../hooks/useGames'
import { SkeletonGameGrid } from '../../components/Skeleton'
import { EmptyState } from '../../components/EmptyState'
import { GameCard } from '../../components/GameCard'
import { SegmentControl } from '../../components/SegmentControl'
import type { Match } from '../../components/types'
import type { Club } from '../../lib/ClubContext'

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

function formatDate(dateStr: string) {
    const date = new Date(dateStr)
    const formatted = date.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })
    return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

function ClubTeamDetail() {
    const { club } = useOutletContext<{ club: Club }>()
    const { teamId: paramTeamId } = useParams<{ teamId: string }>()
    const [searchParams, setSearchParams] = useSearchParams()
    const decoded = decodeURIComponent(paramTeamId || '')

    const [view, setView] = useState<'agenda' | 'results'>(() => {
        const v = searchParams.get('view')
        return v === 'results' ? 'results' : 'agenda'
    })

    const { games: allGames, loading } = useGames('2025/2026', club.id, club.name)
    const games = allGames || []
    const clubNameUpper = club.name.toUpperCase()

    useEffect(() => {
        setSearchParams({ view })
    }, [view, setSearchParams])

    const teamGames = useMemo(() =>
        games.filter(g => {
            let fullTeamName = ''
            if (g.equipa_casa.toUpperCase().includes(clubNameUpper)) fullTeamName = g.equipa_casa
            else if (g.equipa_fora.toUpperCase().includes(clubNameUpper)) fullTeamName = g.equipa_fora
            if (!fullTeamName) return false
            return extractTeamId(fullTeamName, club.name, g.escalao || '') === decoded
        }),
    [games, decoded, clubNameUpper, club.name])

    const finished = useMemo(() =>
        teamGames.filter(g => g.status === 'FINALIZADO').sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()),
    [teamGames])

    const upcoming = useMemo(() =>
        teamGames.filter(g => g.status !== 'FINALIZADO').sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime()),
    [teamGames])

    let wins = 0, losses = 0, draws = 0
    finished.forEach(g => {
        const clubHome = g.equipa_casa.toUpperCase().includes(clubNameUpper)
        if (g.resultado_casa === null || g.resultado_fora === null) return
        if (g.resultado_casa === g.resultado_fora) { draws++; return }
        if (clubHome ? g.resultado_casa > g.resultado_fora : g.resultado_fora > g.resultado_casa) wins++
        else losses++
    })
    const total = wins + losses + draws
    const pct = total > 0 ? Math.round(wins / (wins + losses || 1) * 100) : null

    const filteredMatches = view === 'agenda' ? upcoming : finished

    const groupedMatches = filteredMatches.reduce((groups, match) => {
        const date = match.data
        if (!groups[date]) groups[date] = []
        groups[date].push(match)
        return groups
    }, {} as Record<string, Match[]>)
    Object.values(groupedMatches).forEach(g => g.sort((a, b) => (a.hora || '99:99').localeCompare(b.hora || '99:99')))

    const sortedDates = Object.keys(groupedMatches).sort((a, b) =>
        view === 'agenda'
            ? new Date(a).getTime() - new Date(b).getTime()
            : new Date(b).getTime() - new Date(a).getTime()
    )

    return (
        <div className="max-w-6xl mx-auto space-y-4 pb-24">
            {/* Header */}
            <div className="flex items-center justify-between pt-3 px-3">
                <Link to={`/clube/${club.slug}/team`} className="p-2 -ml-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
                    <ArrowLeft size={22} />
                </Link>
                <span className="text-[10px] font-bold tracking-widest uppercase text-zinc-500">EQUIPA</span>
                <div className="w-10" />
            </div>

            {/* Hero Card */}
            <div className="max-w-xl mx-auto px-3">
                <div className="glass-card overflow-hidden">
                    <div className="bg-gradient-to-r from-[var(--club-color)]/10 via-white to-[var(--club-color)]/10 dark:from-[var(--club-color)]/10 dark:via-zinc-900 dark:to-[var(--club-color)]/10 p-6">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--club-color)] to-[var(--club-color)]/70 dark:to-[var(--club-color)]/50 flex items-center justify-center shrink-0 shadow-lg shadow-[var(--club-color)]/20">
                                <span className="text-2xl font-black text-white">{decoded.charAt(0).toUpperCase()}</span>
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-xl font-black text-zinc-900 dark:text-white truncate">{decoded}</h1>
                                <p className="text-xs text-zinc-500 mt-0.5">{club.name}</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-5 pt-0">
                        <div className="grid grid-cols-4 gap-3 -mt-2">
                            <div className="text-center pt-4">
                                <p className="text-2xl font-black text-zinc-900 dark:text-white">{total}</p>
                                <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Jogos</p>
                            </div>
                            <div className="text-center pt-4">
                                <p className="text-2xl font-black text-green-600 dark:text-green-400">{wins}</p>
                                <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Vitórias</p>
                            </div>
                            <div className="text-center pt-4">
                                <p className="text-2xl font-black text-red-500">{losses}</p>
                                <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Derrotas</p>
                            </div>
                            <div className="text-center pt-4">
                                <p className={`text-2xl font-black ${pct !== null && pct >= 50 ? 'text-green-600 dark:text-green-400' : pct !== null ? 'text-red-500' : 'text-zinc-400'}`}>
                                    {pct !== null ? pct + '%' : '—'}
                                </p>
                                <p className="text-[10px] text-zinc-500 uppercase tracking-wide">PCT</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Segment control */}
            <div className="px-3 mt-2">
                <SegmentControl
                    options={[
                        { value: 'agenda', label: 'AGENDA', icon: Calendar },
                        { value: 'results', label: 'RESULTADOS', icon: Trophy },
                    ]}
                    value={view}
                    onChange={(v) => setView(v as 'agenda' | 'results')}
                />
            </div>

            {/* Loading */}
            {loading && (
                <div>
                    <SkeletonGameGrid days={2} count={3} />
                </div>
            )}

            {/* Empty */}
            {!loading && sortedDates.length === 0 && (
                <EmptyState view={view} />
            )}

            {/* Games */}
            {!loading && sortedDates.length > 0 && (
                <div className="space-y-6 px-2 md:px-4">
                    {sortedDates.map(date => (
                        <div key={date}>
                            <div className="flex items-center gap-3 mb-3 px-2">
                                <h3 className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-widest">{formatDate(date)}</h3>
                                <div className="flex-1 h-px bg-zinc-200 dark:bg-white/5" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {groupedMatches[date].map(match => (
                                    <GameCard key={match.id || match.slug} match={match} mode={view === 'agenda' ? 'agenda' : 'results'} clubName={club.name} clubSlug={club.slug} />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default ClubTeamDetail
