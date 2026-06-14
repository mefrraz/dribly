/**
 * Home — App-first (v12 final)
 *
 * Layout:
 *   Purple blur → search + league pills (landing page replica)
 *   Competition filter pills
 *   Date selector pills
 *   Featured game card (GameCard component)
 *   Game rows (Confrontos style from Game.tsx)
 *   Followed clubs highlighted, ordered by time
 */

import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, Trophy, ChevronRight } from 'lucide-react'
import { useFollows } from '../hooks/useFollows'
import { supabase } from '../lib/supabase'
import { type Club, useClub, displayName } from '../lib/ClubContext'
import { normalizeTeamDisplay } from '../lib/fpbUtils'
import type { Match } from '../components/types'
import { GameCard } from '../components/GameCard'
import { LoadingSpinner } from '../components/LoadingSpinner'

// ── Competition filter ──

const COMP_FILTERS = [
    { label: 'Liga Betclic', competition: 'Liga Betclic' },
    { label: 'Proliga', competition: 'Proliga' },
    { label: '1ª Divisão', competition: '1ª Divisão' },
    { label: '2ª Divisão', competition: '2ª Divisão' },
    { label: 'Todas', competition: '' },
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

type DayPill = { label: string; date: string; isToday: boolean }

function buildDayPills(): DayPill[] {
    const hoje = new Date()
    const dias: { label: string; date: Date }[] = [
        { label: 'Ontem', date: addDays(hoje, -1) },
        { label: 'Hoje', date: hoje },
        { label: 'Amanhã', date: addDays(hoje, 1) },
    ]
    for (let i = 2; i <= 4; i++) {
        const d = addDays(hoje, i)
        const wd = d.toLocaleDateString('pt-PT', { weekday: 'short' })
        const dm = d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'numeric' })
        dias.push({ label: `${wd} ${dm}`, date: d })
    }
    return dias.map(d => ({
        label: d.label,
        date: toYYYYMMDD(d.date),
        isToday: d.date.toDateString() === hoje.toDateString(),
    }))
}

// ── Confrontos row (replicated from Game.tsx) ──

function ConfrontoRow({ match, clubs, isFollowed }: { match: Match; clubs: Club[]; isFollowed: boolean }) {
    const displayCasa = normalizeTeamDisplay(match.equipa_casa, clubs)
    const displayFora = normalizeTeamDisplay(match.equipa_fora, clubs)
    const isLive = match.status === 'A DECORRER'
    const isFinished = match.status === 'FINALIZADO'
    const slug = match.slug || `${match.data}-${match.equipa_casa.toLowerCase().replace(/\s+/g, '-')}-${match.equipa_fora.toLowerCase().replace(/\s+/g, '-')}`
    const club = clubs.find(c => c.name === match.equipa_casa || c.name === match.equipa_fora)
    const linkTo = club ? `/jogo/${slug}?clube=${club.slug}` : `/jogo/${slug}`
    const hora = match.hora ? match.hora.replace(/[^0-9:]/g, '').slice(0, 5) : ''

    return (
        <Link
            to={linkTo}
            className={`flex items-center gap-2 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group ${
                isFollowed ? 'bg-dribly-purple/[0.03] dark:bg-dribly-purple/[0.05]' : ''
            }`}
        >
            {/* Followed indicator */}
            {isFollowed && <span className="w-1.5 h-1.5 rounded-full bg-dribly-purple shrink-0" />}

            {/* Casa */}
            <div className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 overflow-hidden border border-zinc-200 dark:border-zinc-700/50">
                {match.logotipo_casa ? (
                    <img src={match.logotipo_casa} alt="" className="w-5 h-5 object-contain" loading="lazy" />
                ) : (
                    <span className="text-[9px] font-bold text-zinc-500">{displayCasa.charAt(0)}</span>
                )}
            </div>
            <span className={`text-[12px] font-semibold truncate shrink-0 max-w-[100px] ${
                isLive ? 'text-zinc-900 dark:text-white' : 'text-zinc-900 dark:text-white'
            } group-hover:text-dribly-purple transition-colors`}>
                {displayCasa}
            </span>

            {/* Score or vs */}
            {isFinished ? (
                <span className="text-zinc-400 font-medium text-xs tabular-nums shrink-0">
                    {match.resultado_casa}-{match.resultado_fora}
                </span>
            ) : (
                <span className="text-zinc-400 font-medium text-[10px] shrink-0">vs</span>
            )}

            {/* Fora */}
            <span className={`text-[12px] truncate shrink-0 max-w-[100px] ${
                isFinished ? 'text-zinc-500 dark:text-zinc-400' : 'text-zinc-500 dark:text-zinc-400'
            }`}>
                {displayFora}
            </span>
            <div className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 overflow-hidden border border-zinc-200 dark:border-zinc-700/50">
                {match.logotipo_fora ? (
                    <img src={match.logotipo_fora} alt="" className="w-5 h-5 object-contain" loading="lazy" />
                ) : (
                    <span className="text-[9px] font-bold text-zinc-500">{displayFora.charAt(0)}</span>
                )}
            </div>

            <span className="flex-1" />

            {/* Time or LIVE */}
            {isLive ? (
                <span className="text-[10px] font-bold text-red-500 animate-pulse shrink-0 uppercase">LIVE</span>
            ) : isFinished ? (
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase shrink-0 font-medium">FIN</span>
            ) : (
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 shrink-0 font-medium tabular-nums">{hora || '--:--'}</span>
            )}
        </Link>
    )
}

// ── Main ──

export default function Home() {
    const { followedClubIds } = useFollows()
    const { clubs, loadClubs } = useClub()
    const navigate = useNavigate()

    const [pills] = useState<DayPill[]>(() => buildDayPills())
    const [selectedDate, setSelectedDate] = useState<string>(() => toYYYYMMDD(new Date()))
    const [compFilter, setCompFilter] = useState<string>(COMP_FILTERS[0].competition)
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

        let query = supabase.from(tableName).select('*').eq('data', selectedDate)

        if (compFilter) {
            query = query.eq('competicao', compFilter)
        }

        const fetchGames = async () => {
            try {
                const { data } = await query.order('hora', { ascending: true })
                setGames((data as Match[]) || [])
            } catch { setGames([]) }
            setLoading(false)
        }
        fetchGames()
    }, [selectedDate, compFilter])

    // Sort: followed first, then by time
    const sortedGames = useMemo(() => {
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
    }, [games, clubs, followedClubIds])

    const featured = sortedGames[0] || null
    const restGames = sortedGames.slice(1)
    const visible = showAll ? restGames : restGames.slice(0, 6)
    const hasMore = restGames.length > 6 && !showAll
    const liveCount = games.filter(g => g.status === 'A DECORRER').length
    const isEmpty = !loading && games.length === 0

    // Followed check
    const followedNames = new Set(
        clubs.filter(c => followedClubIds.includes(c.id)).map(c => c.name)
    )

    return (
        <div className="max-w-2xl mx-auto pb-24">
            {/* ── Purple blur section ── */}
            <div className="relative overflow-hidden">
                {/* Blur circle */}
                <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full bg-dribly-purple/15 dark:bg-dribly-purple/10 blur-[80px] pointer-events-none" />

                <div className="relative z-10 max-w-2xl mx-auto px-4 pt-2 pb-4">
                    {/* Search bar */}
                    <div className="max-w-lg mx-auto mb-3">
                        <button
                            onClick={() => setSearchOpen(true)}
                            className="w-full flex items-center gap-3 pl-5 pr-4 py-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl text-left text-sm text-zinc-400 hover:border-dribly-purple/30 transition-colors shadow-lg shadow-zinc-200/50 dark:shadow-black/20"
                        >
                            <Search size={20} className="shrink-0" />
                            Pesquisar clubes e competições...
                        </button>
                    </div>

                    {/* League pills */}
                    <div className="flex justify-center gap-2 flex-wrap">
                        {[
                            { name: 'Liga Betclic', id: 10902 },
                            { name: 'Proliga', id: 10903 },
                            { name: '1ª Divisão', id: 10904 },
                            { name: '2ª Divisão', id: 10905 },
                        ].map(({ name, id }, i) => (
                            <button
                                key={id}
                                onClick={() => navigate('/competicao/' + id)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300 hover:border-dribly-purple/30 hover:text-dribly-purple hover:shadow-sm transition-all shrink-0 ${i >= 3 ? 'hidden sm:flex' : ''}`}
                            >
                                <span className="w-5 h-5 rounded-full bg-zinc-100 dark:bg-white/10 flex items-center justify-center shrink-0">
                                    <Trophy size={10} className="text-dribly-purple" />
                                </span>
                                {name}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Competition filter pills ── */}
            <div className="px-4 mb-4">
                <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
                    {COMP_FILTERS.map(f => (
                        <button
                            key={f.label}
                            onClick={() => setCompFilter(f.competition)}
                            className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all ${
                                compFilter === f.competition
                                    ? 'bg-dribly-purple text-white shadow-sm shadow-dribly-purple/20'
                                    : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-500 dark:text-zinc-400 hover:border-dribly-purple/30'
                            }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Date selector ── */}
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

            {/* ── Live badge ── */}
            {liveCount > 0 && (
                <div className="px-4 mb-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-[10px] font-bold animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        {liveCount} AO VIVO
                    </span>
                </div>
            )}

            {/* ── Content ── */}
            <div className="px-4">
                {loading ? (
                    <div className="flex justify-center py-12"><LoadingSpinner /></div>
                ) : isEmpty ? (
                    <div className="text-center py-12">
                        <Trophy size={28} className="text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
                        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Nenhum jogo neste dia.</p>
                    </div>
                ) : (
                    <>
                        {/* Featured card — uses existing GameCard */}
                        {featured && (
                            <div className="mb-4">
                                <GameCard match={featured} mode="agenda" clubs={clubs} />
                            </div>
                        )}

                        {/* Game rows — Confrontos style */}
                        {visible.length > 0 && (
                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl overflow-hidden">
                                <div className="p-3.5 border-b border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-white/[0.02]">
                                    <h3 className="text-xs font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-dribly-purple" />
                                        {compFilter ? compFilter : 'Todos os jogos'}
                                    </h3>
                                </div>
                                <div className="divide-y divide-zinc-100 dark:divide-white/5">
                                    {visible.map((g, i) => (
                                        <ConfrontoRow
                                            key={g.slug || i}
                                            match={g}
                                            clubs={clubs}
                                            isFollowed={
                                                followedNames.has(g.equipa_casa) ||
                                                followedNames.has(g.equipa_fora)
                                            }
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {hasMore && (
                            <button
                                onClick={() => setShowAll(true)}
                                className="w-full mt-2 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 text-xs font-bold hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center gap-1.5"
                            >
                                Ver mais {restGames.length - 6} jogos
                                <ChevronRight size={12} />
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
            const n = norm(displayName(c))
            const f = norm(c.name)
            const s = norm(c.search_name || '')
            return n.includes(qn) || f.includes(qn) || s.includes(qn)
        }).slice(0, 6)
    }, [q, clubs])

    return (
        <div className="fixed inset-0 z-50 bg-zinc-50 dark:bg-zinc-950" onClick={onClose}>
            <div className="max-w-2xl mx-auto px-4 pt-4" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1 relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                        <input autoFocus type="text" value={q} onChange={e => setQ(e.target.value)}
                            placeholder="Pesquisar clubes..."
                            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl text-sm text-zinc-900 dark:text-white placeholder-zinc-400 outline-none focus:ring-2 focus:ring-dribly-purple/30" />
                    </div>
                    <button onClick={onClose} className="text-sm font-medium text-zinc-500">Cancelar</button>
                </div>
                {q.trim() && results.length === 0 && (
                    <p className="text-sm text-zinc-400 text-center py-8">Nenhum clube encontrado.</p>
                )}
                <div className="space-y-1">
                    {results.map(club => (
                        <Link key={club.id} to={`/clube/${club.slug}/home`} onClick={onClose}
                            className="flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors">
                            <div className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-white/10 flex items-center justify-center overflow-hidden shrink-0">
                                {club.logo_url ? <img src={club.logo_url} alt="" className="w-6 h-6 object-contain" />
                                    : <span className="text-xs font-bold text-zinc-500">{displayName(club).charAt(0).toUpperCase()}</span>}
                            </div>
                            <span className="text-sm font-medium text-zinc-900 dark:text-white">{displayName(club)}</span>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    )
}
