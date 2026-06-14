/**
 * Home — App-first interface (v12)
 *
 * - Date selector pills (Ontem | Hoje | Amanhã | Sáb 14 | Dom 15)
 * - Featured game card (live/first of the day)
 * - Compact inline game rows below
 * - "Ver mais" expande a lista
 * - Search inline overlay
 */

import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Search, ChevronRight, Trophy, Flame } from 'lucide-react'
import { useFollows } from '../hooks/useFollows'
import { supabase } from '../lib/supabase'
import { type Club, useClub, displayName } from '../lib/ClubContext'
import { normalizeTeamDisplay } from '../lib/fpbUtils'
import type { Match } from '../components/types'
import { PageHeader } from '../components/PageHeader'
import { LoadingSpinner } from '../components/LoadingSpinner'

// ── Constants ──

const FEATURED_LEAGUES = [
    { name: 'Liga Betclic', id: 10902 },
    { name: 'Proliga', id: 10903 },
    { name: '1ª Divisão', id: 10904 },
]

// ── Date helpers ──

function toYYYYMMDD(d: Date): string {
    return d.toISOString().split('T')[0]
}

function addDays(d: Date, n: number): Date {
    const r = new Date(d)
    r.setDate(r.getDate() + n)
    return r
}

type DayPill = {
    label: string
    date: string
    isToday: boolean
}

function buildDayPills(): DayPill[] {
    const hoje = new Date()
    const dias: { label: string; date: Date }[] = [
        { label: 'Ontem', date: addDays(hoje, -1) },
        { label: 'Hoje', date: hoje },
        { label: 'Amanhã', date: addDays(hoje, 1) },
    ]

    for (let i = 2; i <= 4; i++) {
        const d = addDays(hoje, i)
        const weekDay = d.toLocaleDateString('pt-PT', { weekday: 'short' })
        const dayMonth = d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'numeric' })
        dias.push({ label: `${weekDay} ${dayMonth}`, date: d })
    }

    return dias.map(d => ({
        label: d.label,
        date: toYYYYMMDD(d.date),
        isToday: d.date.toDateString() === hoje.toDateString(),
    }))
}

function hasHora(hora: string | null | undefined): boolean {
    return !!hora && hora.replace(/[^0-9]/g, '').length > 0
}

// ── Components ──

function GameCardFeatured({ match, clubs }: { match: Match; clubs: Club[] }) {
    const displayCasa = normalizeTeamDisplay(match.equipa_casa, clubs)
    const displayFora = normalizeTeamDisplay(match.equipa_fora, clubs)
    const isLive = match.status === 'A DECORRER'
    const isFinished = match.status === 'FINALIZADO'
    const slug = match.slug || `${match.data}-${match.equipa_casa.toLowerCase().replace(/\s+/g, '-')}-${match.equipa_fora.toLowerCase().replace(/\s+/g, '-')}`

    const club = clubs.find(c => c.name === match.equipa_casa || c.name === match.equipa_fora)
    const linkTo = club ? `/jogo/${slug}?clube=${club.slug}` : `/jogo/${slug}`

    return (
        <Link to={linkTo} className="block">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-dribly-purple to-dribly-purple-dark p-5 text-white shadow-md hover:shadow-lg active:scale-[0.98] transition-all">
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-bl-3xl -mr-6 -mt-6" />
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-4">
                        {isLive ? (
                            <span className="flex items-center gap-1.5 text-[11px] font-bold animate-pulse">
                                <span className="w-2 h-2 rounded-full bg-red-400" />
                                AO VIVO
                            </span>
                        ) : isFinished ? (
                            <span className="text-[11px] font-bold text-white/70">FINALIZADO</span>
                        ) : (
                            <span className="text-[11px] font-bold text-white/70">
                                {hasHora(match.hora) ? match.hora!.slice(0, 5) : match.data.slice(5)}
                            </span>
                        )}
                        <span className="text-[10px] text-white/50">{match.competicao}</span>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-base font-bold truncate flex-1">{displayCasa}</span>
                            {isFinished && (
                                <span className="text-2xl font-mono font-bold tabular-nums ml-3">{match.resultado_casa}</span>
                            )}
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-base font-bold text-white/80 truncate flex-1">{displayFora}</span>
                            {isFinished && (
                                <span className="text-2xl font-mono font-bold tabular-nums ml-3">{match.resultado_fora}</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </Link>
    )
}

function GameRowCompact({ match, clubs }: { match: Match; clubs: Club[] }) {
    const displayCasa = normalizeTeamDisplay(match.equipa_casa, clubs)
    const displayFora = normalizeTeamDisplay(match.equipa_fora, clubs)
    const isLive = match.status === 'A DECORRER'
    const isFinished = match.status === 'FINALIZADO'
    const slug = match.slug || `${match.data}-${match.equipa_casa.toLowerCase().replace(/\s+/g, '-')}-${match.equipa_fora.toLowerCase().replace(/\s+/g, '-')}`

    const club = clubs.find(c => c.name === match.equipa_casa || c.name === match.equipa_fora)
    const linkTo = club ? `/jogo/${slug}?clube=${club.slug}` : `/jogo/${slug}`

    return (
        <Link
            to={linkTo}
            className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-white/[0.03] active:bg-zinc-100 dark:active:bg-white/[0.06] transition-colors border-b border-zinc-100 dark:border-white/5 last:border-0"
        >
            <div className="w-14 shrink-0 text-center">
                {isLive ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-red-500 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />LIVE
                    </span>
                ) : isFinished ? (
                    <span className="text-[10px] font-bold text-zinc-400">FIN</span>
                ) : (
                    <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
                        {hasHora(match.hora) ? match.hora!.slice(0, 5) : '--:--'}
                    </span>
                )}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className={`text-[13px] font-bold truncate ${isLive ? 'text-zinc-900 dark:text-white' : 'text-zinc-700 dark:text-zinc-300'}`}>
                            {displayCasa}
                        </span>
                        {isFinished && (
                            <span className="text-sm font-mono font-bold text-zinc-900 dark:text-white tabular-nums">{match.resultado_casa}</span>
                        )}
                    </div>
                    <span className="text-[10px] text-zinc-400 shrink-0 font-medium">vs</span>
                    <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
                        {isFinished && (
                            <span className="text-sm font-mono font-bold text-zinc-900 dark:text-white tabular-nums">{match.resultado_fora}</span>
                        )}
                        <span className={`text-[13px] font-bold truncate ${isLive ? 'text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400'}`}>
                            {displayFora}
                        </span>
                    </div>
                </div>
                <p className="text-[10px] text-zinc-400 mt-0.5 truncate">{match.competicao} · {match.escalao}</p>
            </div>

            <ChevronRight size={14} className="text-zinc-300 shrink-0" />
        </Link>
    )
}

// ── Main ──

export default function Home() {
    const { followedClubIds } = useFollows()
    const { clubs, loadClubs } = useClub()
    const clubsReady = clubs.length > 0

    const [pills] = useState<DayPill[]>(() => buildDayPills())
    const [selectedDate, setSelectedDate] = useState<string>(() => toYYYYMMDD(new Date()))
    const [games, setGames] = useState<Match[]>([])
    const [loading, setLoading] = useState(true)
    const [showAll, setShowAll] = useState(false)
    const [searchOpen, setSearchOpen] = useState(false)

    useEffect(() => { loadClubs() }, [loadClubs])

    // Fetch games for selected date
    useEffect(() => {
        setLoading(true)
        setShowAll(false)

        const season = '2025/2026'
        const tableName = `games_${season.replace('/', '_')}`

        const fetchGames = async () => {
            try {
                const { data } = await supabase
                    .from(tableName)
                    .select('*')
                    .eq('data', selectedDate)
                    .order('hora', { ascending: true })
                setGames((data as Match[]) || [])
            } catch {
                setGames([])
            }
            setLoading(false)
        }
        fetchGames()
    }, [selectedDate])

    // Highlight followed club games
    const sortedGames = useMemo(() => {
        if (!clubsReady || followedClubIds.length === 0) return games
        const followedNames = new Set(
            clubs.filter(c => followedClubIds.includes(c.id)).map(c => c.name)
        )
        const followed: Match[] = []
        const rest: Match[] = []
        for (const g of games) {
            if (followedNames.has(g.equipa_casa) || followedNames.has(g.equipa_fora)) {
                followed.push(g)
            } else {
                rest.push(g)
            }
        }
        return [...followed, ...rest]
    }, [games, clubs, followedClubIds, clubsReady])

    const featured = sortedGames[0] || null
    const rest = sortedGames.slice(1)
    const visible = showAll ? rest : rest.slice(0, 6)
    const hasMore = rest.length > 6 && !showAll
    const liveGames = games.filter(g => g.status === 'A DECORRER')
    const isEmpty = !loading && games.length === 0

    return (
        <div className="max-w-2xl mx-auto pb-24">
            <PageHeader />

            {/* ── Header ── */}
            <div className="px-4 pt-3 pb-4 flex items-center justify-between">
                <h1 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
                    Dribly<span className="text-dribly-purple">.</span>
                </h1>
                <button
                    onClick={() => setSearchOpen(true)}
                    className="p-2 rounded-full text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                    aria-label="Pesquisar"
                >
                    <Search size={20} />
                </button>
            </div>

            {/* ── League pills ── */}
            <div className="px-4 mb-4 flex gap-2 overflow-x-auto scrollbar-none">
                {FEATURED_LEAGUES.map(({ name, id }) => (
                    <Link
                        key={id}
                        to={`/competicao/${id}`}
                        className="shrink-0 px-3 py-1.5 rounded-full text-xs font-bold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-300 hover:border-dribly-purple/30 hover:text-dribly-purple transition-colors"
                    >
                        {name}
                    </Link>
                ))}
            </div>

            {/* ── Search bar ── */}
            <div className="px-4 mb-5">
                <button
                    onClick={() => setSearchOpen(true)}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl text-left text-sm text-zinc-400 hover:border-dribly-purple/30 transition-colors"
                >
                    <Search size={16} className="shrink-0" />
                    Pesquisar clubes e competições...
                </button>
            </div>

            {/* ── Date selector pills ── */}
            <div className="px-4 mb-5">
                <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                    {pills.map(p => (
                        <button
                            key={p.date}
                            onClick={() => setSelectedDate(p.date)}
                            className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all ${
                                selectedDate === p.date
                                    ? 'bg-dribly-purple text-white shadow-sm shadow-dribly-purple/20'
                                    : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-300 hover:border-dribly-purple/30'
                            }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Live indicator ── */}
            {liveGames.length > 0 && (
                <div className="px-4 mb-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-[10px] font-bold animate-pulse">
                        <Flame size={11} />
                        {liveGames.length} AO VIVO
                    </span>
                </div>
            )}

            {/* ── Content ── */}
            <div className="px-4">
                {loading ? (
                    <div className="flex justify-center py-12">
                        <LoadingSpinner />
                    </div>
                ) : isEmpty ? (
                    <div className="text-center py-12">
                        <Trophy size={28} className="text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
                        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Nenhum jogo neste dia.</p>
                    </div>
                ) : (
                    <>
                        {/* Featured card */}
                        {featured && (
                            <div className="mb-4">
                                <GameCardFeatured match={featured} clubs={clubs} />
                            </div>
                        )}

                        {/* Game list */}
                        {visible.length > 0 && (
                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl overflow-hidden">
                                {visible.map((g, i) => (
                                    <GameRowCompact key={g.slug || i} match={g} clubs={clubs} />
                                ))}
                            </div>
                        )}

                        {/* Ver mais */}
                        {hasMore && (
                            <button
                                onClick={() => setShowAll(true)}
                                className="w-full mt-2 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 text-xs font-bold hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center gap-1.5"
                            >
                                Ver mais {rest.length - 6} jogos
                                <ChevronRight size={12} />
                            </button>
                        )}

                        {/* Show less */}
                        {showAll && rest.length > 6 && (
                            <button
                                onClick={() => setShowAll(false)}
                                className="w-full mt-2 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 text-xs font-bold hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                            >
                                Mostrar menos
                            </button>
                        )}
                    </>
                )}
            </div>

            {/* ── Search overlay ── */}
            {searchOpen && <SearchOverlay clubs={clubs} onClose={() => setSearchOpen(false)} />}
        </div>
    )
}

// ── Search overlay ──

function SearchOverlay({ clubs, onClose }: { clubs: Club[]; onClose: () => void }) {
    const [q, setQ] = useState('')

    const results = useMemo(() => {
        if (!q.trim()) return []
        const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        const qn = norm(q)
        return clubs.filter(c => {
            const name = norm(displayName(c))
            const full = norm(c.name)
            const search = norm(c.search_name || '')
            return name.includes(qn) || full.includes(qn) || search.includes(qn)
        }).slice(0, 6)
    }, [q, clubs])

    return (
        <div className="fixed inset-0 z-50 bg-zinc-50 dark:bg-zinc-950" onClick={onClose}>
            <div className="max-w-2xl mx-auto px-4 pt-4" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1 relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                        <input
                            autoFocus
                            type="text"
                            value={q}
                            onChange={e => setQ(e.target.value)}
                            placeholder="Pesquisar clubes..."
                            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl text-sm text-zinc-900 dark:text-white placeholder-zinc-400 outline-none focus:ring-2 focus:ring-dribly-purple/30"
                        />
                    </div>
                    <button onClick={onClose} className="text-sm font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
                        Cancelar
                    </button>
                </div>

                {q.trim() && results.length === 0 && (
                    <p className="text-sm text-zinc-400 text-center py-8">Nenhum clube encontrado.</p>
                )}

                <div className="space-y-1">
                    {results.map(club => (
                        <Link
                            key={club.id}
                            to={`/clube/${club.slug}/home`}
                            onClick={onClose}
                            className="flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
                        >
                            <div className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-white/10 flex items-center justify-center overflow-hidden shrink-0">
                                {club.logo_url ? (
                                    <img src={club.logo_url} alt="" className="w-6 h-6 object-contain" />
                                ) : (
                                    <span className="text-xs font-bold text-zinc-500">
                                        {displayName(club).charAt(0).toUpperCase()}
                                    </span>
                                )}
                            </div>
                            <span className="text-sm font-medium text-zinc-900 dark:text-white">
                                {displayName(club)}
                            </span>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    )
}
