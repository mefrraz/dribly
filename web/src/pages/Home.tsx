/**
 * Home — v12 final
 *
 * Layout:
 *   Purple blur → league pills (EXACT landing page replica: 3 pills, no icons)
 *   Search bar
 *   Date selector bar (no dividers, selected = rounded-full cylinder)
 *   Featured card: followed clubs H2H priority
 *   Accordion sections grouped by category (not raw competition names)
 */

import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, Trophy, ChevronDown } from 'lucide-react'
import { useFollows } from '../hooks/useFollows'
import { supabase } from '../lib/supabase'
import { type Club, useClub, displayName } from '../lib/ClubContext'
import { normalizeTeamDisplay } from '../lib/fpbUtils'
import type { Match } from '../components/types'
import { GameCard } from '../components/GameCard'
import { LoadingSpinner } from '../components/LoadingSpinner'

// ── League pills (EXACT landing page) ──

const FEATURED_LEAGUES = [
    { name: 'Liga Betclic', id: 10902 },
    { name: 'Proliga', id: 10903 },
    { name: '1ª Divisão', id: 10904 },
]

// ── Category grouping for accordions ──

const CATEGORIES: { key: string; label: string; match: (comp: string) => boolean }[] = [
    {
        key: 'liga-betclic', label: 'Liga Betclic',
        match: (c) => c.toLowerCase().includes('betclic'),
    },
    {
        key: 'proliga', label: 'Proliga',
        match: (c) => c.toLowerCase().includes('proliga'),
    },
    {
        key: '1divisao', label: '1ª Divisão',
        match: (c) => c.toLowerCase().includes('1ª') || c.toLowerCase().includes('1 divisão') || c.toLowerCase().includes('i divisão'),
    },
    {
        key: '2divisao', label: '2ª Divisão',
        match: (c) => c.toLowerCase().includes('2ª') || c.toLowerCase().includes('ii divisão'),
    },
    {
        key: 'sub18', label: 'Sub-18',
        match: (c) => /\b(sub[-\s]?18|s18|junior)/i.test(c),
    },
    {
        key: 'sub16', label: 'Sub-16',
        match: (c) => /\b(sub[-\s]?16|s16|cadete)/i.test(c),
    },
    {
        key: 'sub14', label: 'Sub-14',
        match: (c) => /\b(sub[-\s]?14|s14|iniciad)/i.test(c),
    },
    {
        key: 'sen-fem', label: 'Seniores Femininos',
        match: (c) => /\b(fem|feminin)/i.test(c) && !/\b(sub[-\s]?(14|16|18)|s14|s16|s18)/i.test(c),
    },
]

// ── Date helpers ──

function toYYYYMMDD(d: Date): string { return d.toISOString().split('T')[0] }
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r }

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

function categoryFor(comp: string): string {
    for (const cat of CATEGORIES) {
        if (cat.match(comp)) return cat.key
    }
    return 'outros'
}

function categoryLabel(key: string): string {
    const found = CATEGORIES.find(c => c.key === key)
    return found ? found.label : 'Outros'
}

// ── Confrontos row ──

function ConfrontoRow({ match, clubs, isFollowed }: { match: Match; clubs: Club[]; isFollowed: boolean; compLabel?: string }) {
    const displayCasa = normalizeTeamDisplay(match.equipa_casa, clubs)
    const displayFora = normalizeTeamDisplay(match.equipa_fora, clubs)
    const isLive = match.status === 'A DECORRER'
    const isFinished = match.status === 'FINALIZADO'
    const slug = match.slug || `${match.data}-${match.equipa_casa.toLowerCase().replace(/\s+/g, '-')}-${match.equipa_fora.toLowerCase().replace(/\s+/g, '-')}`
    const club = clubs.find(c => c.name === match.equipa_casa || c.name === match.equipa_fora)
    const linkTo = club ? `/jogo/${slug}?clube=${club.slug}` : `/jogo/${slug}`
    const hora = match.hora ? match.hora.replace(/[^0-9:]/g, '').slice(0, 5) : ''

    return (
        <Link to={linkTo}
            className={`flex items-center gap-2 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group ${
                isFollowed ? 'bg-dribly-purple/[0.03] dark:bg-dribly-purple/[0.05]' : ''
            }`}>
            {isFollowed && <span className="w-1.5 h-1.5 rounded-full bg-dribly-purple shrink-0" />}
            <div className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 overflow-hidden border border-zinc-200 dark:border-zinc-700/50">
                {match.logotipo_casa ? <img src={match.logotipo_casa} alt="" className="w-5 h-5 object-contain" loading="lazy" />
                    : <span className="text-[9px] font-bold text-zinc-500">{displayCasa.charAt(0)}</span>}
            </div>
            <span className="text-[12px] font-semibold truncate shrink-0 max-w-[100px] text-zinc-900 dark:text-white group-hover:text-dribly-purple transition-colors">
                {displayCasa}
            </span>
            {isFinished
                ? <span className="text-zinc-400 font-medium text-xs tabular-nums shrink-0">{match.resultado_casa}-{match.resultado_fora}</span>
                : <span className="text-zinc-400 font-medium text-[10px] shrink-0">vs</span>}
            <span className="text-[12px] truncate shrink-0 max-w-[100px] text-zinc-500 dark:text-zinc-400">{displayFora}</span>
            <div className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 overflow-hidden border border-zinc-200 dark:border-zinc-700/50">
                {match.logotipo_fora ? <img src={match.logotipo_fora} alt="" className="w-5 h-5 object-contain" loading="lazy" />
                    : <span className="text-[9px] font-bold text-zinc-500">{displayFora.charAt(0)}</span>}
            </div>
            <span className="flex-1" />
            {isLive ? <span className="text-[10px] font-bold text-red-500 animate-pulse shrink-0 uppercase">LIVE</span>
                : isFinished ? <span className="text-[10px] text-zinc-400 shrink-0 font-medium uppercase">FIN</span>
                : <span className="text-[10px] text-zinc-400 shrink-0 font-medium tabular-nums">{hora || '--:--'}</span>}
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
    const [allGames, setAllGames] = useState<Match[]>([])
    const [loading, setLoading] = useState(true)
    const [openSections, setOpenSections] = useState<Set<string>>(new Set())
    const [searchOpen, setSearchOpen] = useState(false)

    useEffect(() => { loadClubs() }, [loadClubs])

    useEffect(() => {
        setLoading(true)
        setOpenSections(new Set())
        const tableName = `games_2025_2026`
        const fetchGames = async () => {
            try {
                const { data } = await supabase.from(tableName).select('*').eq('data', selectedDate).order('hora', { ascending: true })
                setAllGames((data as Match[]) || [])
            } catch { setAllGames([]) }
            setLoading(false)
        }
        fetchGames()
    }, [selectedDate])

    const followedNames = useMemo(() =>
        new Set(clubs.filter(c => followedClubIds.includes(c.id)).map(c => c.name)),
        [clubs, followedClubIds])

    // Group games by category
    const gamesByCategory = useMemo(() => {
        // Initialize all categories (empty arrays)
        const map = new Map<string, Match[]>()
        for (const cat of CATEGORIES) map.set(cat.key, [])
        map.set('outros', [])

        for (const g of allGames) {
            const comp = g.competicao || ''
            const cat = categoryFor(comp)
            const arr = map.get(cat) || []
            arr.push(g)
            if (!map.has(cat)) map.set(cat, arr)
        }

        // Sort within each category: followed first, then by time
        for (const [key, games] of map) {
            const followed: Match[] = []
            const rest: Match[] = []
            for (const g of games) {
                if (followedNames.has(g.equipa_casa) || followedNames.has(g.equipa_fora)) {
                    followed.push(g)
                } else { rest.push(g) }
            }
            map.set(key, [...followed, ...rest])
        }

        return map
    }, [allGames, followedNames])

    const featuredGame = useMemo(() => {
        if (followedNames.size >= 2) {
            const h2h = allGames.find(g =>
                followedNames.has(g.equipa_casa) && followedNames.has(g.equipa_fora))
            if (h2h) return h2h
        }
        return allGames.find(g =>
            followedNames.has(g.equipa_casa) || followedNames.has(g.equipa_fora)
        ) || allGames[0] || null
    }, [allGames, followedNames])

    const toggleSection = (key: string) => {
        setOpenSections(prev => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }

    const isEmpty = !loading && allGames.length === 0
    const liveCount = allGames.filter(g => g.status === 'A DECORRER').length

    return (
        <div className="max-w-2xl mx-auto pb-24">
            {/* ── Purple blur section ── */}
            <div className="relative overflow-hidden">
                <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-dribly-purple/20 dark:bg-dribly-purple/15 blur-[100px] pointer-events-none" />
                <div className="absolute -top-8 left-1/4 w-40 h-40 rounded-full bg-dribly-purple-light/15 dark:bg-dribly-purple-light/10 blur-[60px] pointer-events-none" />

                <div className="relative z-10 max-w-2xl mx-auto px-4 pt-2 pb-5">
                    {/* League pills — EXACT landing page replica: 3 pills, NO icons */}
                    <div className="flex justify-center gap-2 mb-4 flex-wrap">
                        {FEATURED_LEAGUES.map(({ name, id }) => (
                            <button
                                key={id}
                                onClick={() => navigate('/competicao/' + id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300 hover:border-dribly-purple/30 hover:text-dribly-purple hover:shadow-sm transition-all shrink-0"
                            >
                                {name}
                            </button>
                        ))}
                    </div>

                    {/* Search bar */}
                    <div className="max-w-lg mx-auto">
                        <button
                            onClick={() => setSearchOpen(true)}
                            className="w-full flex items-center gap-3 pl-5 pr-4 py-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl text-left text-sm text-zinc-400 hover:border-dribly-purple/30 transition-colors shadow-lg shadow-zinc-200/50 dark:shadow-black/20"
                        >
                            <Search size={20} className="shrink-0" />
                            Pesquisar clubes e competições...
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Date selector BAR (no dividers, selected = rounded-full cylinder) ── */}
            <div className="px-4 mb-5">
                <div className="flex gap-2 overflow-x-auto scrollbar-none">
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
                        {/* Featured card */}
                        {featuredGame && (
                            <div className="mb-5">
                                <GameCard match={featuredGame} mode="agenda" clubs={clubs} />
                            </div>
                        )}

                        {/* Category accordions */}
                        <div className="space-y-2">
                            {[...gamesByCategory.entries()]
                                .filter(([, games]) => games.length > 0)
                                .map(([key, games]) => {
                                    const isOpen = openSections.has(key)
                                    const label = categoryLabel(key)
                                    return (
                                        <div key={key} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl overflow-hidden">
                                            <button
                                                onClick={() => toggleSection(key)}
                                                className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors"
                                            >
                                                <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-dribly-purple" />
                                                    {label}
                                                    <span className="text-[11px] font-medium text-zinc-400">({games.length})</span>
                                                </h3>
                                                <ChevronDown size={16} className={`text-zinc-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                                            </button>
                                            {isOpen && (
                                                <div className="divide-y divide-zinc-100 dark:divide-white/5 border-t border-zinc-100 dark:border-white/5">
                                                    {games.map((g, i) => (
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
                                            )}
                                        </div>
                                    )
                                })}
                        </div>
                    </>
                )}
            </div>

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
            return norm(displayName(c)).includes(qn) || norm(c.name).includes(qn) || norm(c.search_name || '').includes(qn)
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
                {q.trim() && results.length === 0 && <p className="text-sm text-zinc-400 text-center py-8">Nenhum clube encontrado.</p>}
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
