import { useState, useEffect, useMemo } from 'react'
import { ArrowLeft, Calendar, Trophy, Filter, AlertCircle } from 'lucide-react'
import { Link, useSearchParams, useOutletContext } from 'react-router-dom'
import { useGames } from '../../hooks/useGames'
import { useSeason } from '../../hooks/useSeason'
import { SeasonSelector } from '../../components/SeasonSelector'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { EmptyState } from '../../components/EmptyState'
import { GameCard } from '../../components/GameCard'
import { SegmentControl } from '../../components/SegmentControl'
import { Match } from '../../components/types'
import { type Club, useClub } from '../../lib/ClubContext'

function ClubGames() {
    const { club } = useOutletContext<{ club: Club }>()
    const { clubs } = useClub()
    const [searchParams, setSearchParams] = useSearchParams()

    const [view, setView] = useState<'agenda' | 'results'>(() => {
        const v = searchParams.get('view')
        return v === 'results' ? 'results' : 'agenda'
    })

    const [filterEscalao, setFilterEscalao] = useState<string>('Todos')
    const [escaloes, setEscaloes] = useState<string[]>([])

    const { season, setSeason } = useSeason(searchParams.get('season') || undefined)
    const { games: allGames, loading, error, refresh } = useGames(season, club.id, club.name)
    const matches = useMemo(() => allGames || [], [allGames])

    useEffect(() => {
        const params: Record<string, string> = { view }
        if (season !== '2026/2027') params.season = season
        setSearchParams(params)
    }, [view, season, setSearchParams])

    useEffect(() => {
        const uniqueEscaloes = Array.from(new Set(matches.map(m => m.escalao))).filter(Boolean).sort()
        setEscaloes(uniqueEscaloes)
    }, [matches])

    const filteredMatches = matches.filter(match => {
        if (view === 'agenda' && (match.status === 'FINALIZADO' || match.data < new Date().toISOString().split('T')[0])) return false
        if (view === 'results' && match.status !== 'FINALIZADO') return false
        if (filterEscalao !== 'Todos' && match.escalao !== filterEscalao) return false
        return true
    })

    const groupedMatches = filteredMatches.reduce((groups, match) => {
        const date = match.data
        if (!groups[date]) groups[date] = []
        groups[date].push(match)
        return groups
    }, {} as Record<string, Match[]>)
    Object.values(groupedMatches).forEach(g => g.sort((a, b) => (a.hora || '99:99').localeCompare(b.hora || '99:99')))

    const sortedDates = Object.keys(groupedMatches).sort((a, b) => {
        return view === 'agenda'
            ? new Date(a).getTime() - new Date(b).getTime()
            : new Date(b).getTime() - new Date(a).getTime()
    })

    const formatDate = (dateStr: string) => {
        const options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'long' }
        const date = new Date(dateStr).toLocaleDateString('pt-PT', options)
        return date.charAt(0).toUpperCase() + date.slice(1)
    }

    return (
        <div className="max-w-6xl mx-auto space-y-4 pb-24">
            {/* Back + Segment */}
            <div className="px-3 mt-2 flex items-center gap-3">
                <Link to={`/clube/${club.slug}/home`} className="p-2 -ml-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
                    <ArrowLeft size={20} />
                </Link>
                <div className="flex-1">
                <SegmentControl
                options={[
                    { value: 'agenda', label: 'AGENDA', icon: Calendar },
                    { value: 'results', label: 'RESULTADOS', icon: Trophy },
                ]}
                value={view}
                onChange={(v) => setView(v as 'agenda' | 'results')}
            />
            </div>
                <div className="w-9" />
            </div>

            {/* Filtro */}
            <div className="px-3 max-w-sm mx-auto flex items-center gap-1.5">
                <div className="relative w-2/3">
                    <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none text-zinc-500">
                        <Filter size={11} />
                    </div>
                    <select
                        value={filterEscalao}
                        onChange={(e) => setFilterEscalao(e.target.value)}
                        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-800 dark:text-zinc-200 text-[11px] font-medium rounded-lg focus:ring-2 focus:ring-[var(--club-color)]/30 focus:border-[var(--club-color)] block w-full pl-6 p-1.5 appearance-none shadow-sm transition-colors"
                    >
                        <option value="Todos">Escalão</option>
                        {escaloes.map(e => (
                            <option key={e} value={e}>{e}</option>
                        ))}
                    </select>
                </div>
                <SeasonSelector className="w-1/3 text-[11px] p-1.5" value={season} onChange={setSeason} />
            </div>

            {/* Error banner */}
            {error && !loading && (
                <div className="px-3 max-w-lg mx-auto ">
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                        <AlertCircle size={14} className="text-red-500 shrink-0" />
                        <span className="text-xs text-red-700 dark:text-red-300 flex-1">{error}</span>
                        <button onClick={() => refresh()} className="text-xs font-bold text-red-600 dark:text-red-400 hover:underline shrink-0">Tentar novamente</button>
                    </div>
                </div>
            )}

            {loading && <LoadingSpinner message="A atualizar dados..." />}

            {/* Error + empty */}
            {!loading && error && matches.length === 0 && (
                <EmptyState icon="error" title="Erro ao carregar" subtitle={error} action={{ label: 'Tentar novamente', onClick: () => refresh() }} />
            )}

            {/* Empty */}
            {!loading && !error && sortedDates.length === 0 && (
                <EmptyState view={view} />
            )}

            {/* Games */}
            {!loading && sortedDates.length > 0 && (
                <div className="space-y-6 px-2 md:px-4">
                    {sortedDates.map(date => (
                        <div key={date} className="">
                            <div className="flex items-center gap-3 mb-3 px-2">
                                <h3 className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-widest">{formatDate(date)}</h3>
                                <div className="flex-1 h-px bg-zinc-200 dark:bg-white/5" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {groupedMatches[date].map(match => (
                                    <GameCard key={match.id || match.slug} match={match} mode={view === 'agenda' ? 'agenda' : 'results'} clubName={club.name} clubSlug={club.slug} clubs={clubs} />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default ClubGames
