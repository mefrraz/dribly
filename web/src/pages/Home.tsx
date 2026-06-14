/**
 * Home — Nova interface app-first (v12)
 *
 * Design principles:
 * - Jogos no topo, zero scroll para os ver
 * - Tabs: Seguidos (se logado) | Próximos | Resultados
 * - Live games têm destaque vermelho pulsante
 * - Cards compactos, fáceis de scan
 * - Search acessível mas não dominante
 */

import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Search, Bell, Trophy, Activity, Clock, ChevronRight, Flame } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { useFollows } from '../hooks/useFollows'
import { supabase } from '../lib/supabase'
import { type Club, useClub, displayName } from '../lib/ClubContext'
import { normalizeTeamDisplay } from '../lib/fpbUtils'
import type { Match } from '../components/types'
import { PageHeader } from '../components/PageHeader'
import { LoadingSpinner } from '../components/LoadingSpinner'

// ── Types ──

type Tab = 'seguidos' | 'proximos' | 'resultados'

interface GameWithClub extends Match {
    _clubId?: number
    _clubSlug?: string
}

// ── Helpers ──

function hasHora(hora: string | null | undefined): boolean {
    return !!hora && hora.replace(/[^0-9]/g, '').length > 0
}

function formatGameDate(data: string): string {
    const d = new Date(data)
    const hoje = new Date()
    const amanha = new Date(hoje)
    amanha.setDate(hoje.getDate() + 1)

    if (d.toDateString() === hoje.toDateString()) return 'Hoje'
    if (d.toDateString() === amanha.toDateString()) return 'Amanhã'

    return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })
}

function formatGameTime(data: string, hora: string | null): string {
    if (hasHora(hora)) return hora!.slice(0, 5)
    return formatGameDate(data)
}

// ── Game row component ──

function GameRow({ match, clubs, showCompetition }: {
    match: GameWithClub
    clubs: Club[]
    showCompetition?: boolean
}) {
    const isLive = match.status === 'A DECORRER'
    const isFinished = match.status === 'FINALIZADO'
    const displayCasa = normalizeTeamDisplay(match.equipa_casa, clubs)
    const displayFora = normalizeTeamDisplay(match.equipa_fora, clubs)
    const slug = match.slug || `${match.data}-${match.equipa_casa.toLowerCase().replace(/\s+/g, '-')}-${match.equipa_fora.toLowerCase().replace(/\s+/g, '-')}`

    // Find club slug for link (prefer followed club)
    const clubSlug = match._clubSlug
        || clubs.find(c => c.name === match.equipa_casa || c.name === match.equipa_fora)?.slug

    const linkTo = clubSlug
        ? `/jogo/${slug}?clube=${clubSlug}`
        : `/jogo/${slug}`

    return (
        <Link
            to={linkTo}
            className="flex items-center gap-3 px-4 py-3.5 hover:bg-zinc-50 dark:hover:bg-white/[0.03] active:bg-zinc-100 dark:active:bg-white/[0.06] transition-colors border-b border-zinc-100 dark:border-white/5 last:border-0"
        >
            {/* Time / Status column */}
            <div className="w-14 shrink-0 text-center">
                {isLive ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-500 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        LIVE
                    </span>
                ) : isFinished ? (
                    <span className="text-[11px] font-bold text-zinc-400">FIN</span>
                ) : (
                    <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
                        {formatGameTime(match.data, match.hora)}
                    </span>
                )}
            </div>

            {/* Teams */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold truncate ${isLive ? 'text-zinc-900 dark:text-white' : 'text-zinc-700 dark:text-zinc-300'}`}>
                        {displayCasa}
                    </span>
                    {isFinished && (
                        <span className="text-sm font-mono font-bold text-zinc-900 dark:text-white tabular-nums shrink-0">
                            {match.resultado_casa}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-sm font-bold truncate ${isLive ? 'text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400'}`}>
                        {displayFora}
                    </span>
                    {isFinished && (
                        <span className="text-sm font-mono font-bold text-zinc-900 dark:text-white tabular-nums shrink-0">
                            {match.resultado_fora}
                        </span>
                    )}
                </div>
                {showCompetition && (
                    <p className="text-[10px] text-zinc-400 mt-0.5 truncate">
                        {match.competicao} · {match.escalao}
                    </p>
                )}
            </div>

            {/* Arrow */}
            <ChevronRight size={14} className="text-zinc-300 shrink-0" />
        </Link>
    )
}

// ── Main component ──

export default function Home() {
    const { user } = useAuth()
    const { followedClubIds } = useFollows()
    const { clubs, loadClubs } = useClub()

    const [tab, setTab] = useState<Tab>(() => {
        if (user && followedClubIds.length > 0) return 'seguidos'
        return 'proximos'
    })
    const [games, setGames] = useState<GameWithClub[]>([])
    const [loading, setLoading] = useState(true)
    const [searchOpen, setSearchOpen] = useState(false)

    useEffect(() => { loadClubs() }, [loadClubs])

    // ── Fetch games based on active tab ──
    useEffect(() => {
        setLoading(true)
        const season = '2025/2026'
        const tableName = `games_${season.replace('/', '_')}`

        const today = new Date().toISOString().split('T')[0]
        const threeDaysLater = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]
        const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]

        let query = supabase.from(tableName).select('*')

        switch (tab) {
            case 'seguidos': {
                // Get followed club names from IDs
                const followedNames = clubs
                    .filter(c => followedClubIds.includes(c.id))
                    .map(c => c.name)

                if (followedNames.length === 0) {
                    setGames([])
                    setLoading(false)
                    return
                }

                query = query
                    .or(followedNames.map(n => `equipa_casa.eq.${n},equipa_fora.eq.${n}`).join(','))
                    .order('data', { ascending: true })
                    .limit(30)
                break
            }
            case 'proximos':
                query = query
                    .not('status', 'eq', 'FINALIZADO')
                    .not('status', 'eq', 'ADIADO')
                    .gte('data', today)
                    .lte('data', threeDaysLater)
                    .order('data', { ascending: true })
                    .limit(40)
                break
            case 'resultados':
                query = query
                    .eq('status', 'FINALIZADO')
                    .gte('data', sevenDaysAgo)
                    .lte('data', today)
                    .order('data', { ascending: false })
                    .limit(40)
                break
        }

        const fetchGames = async () => {
            try {
                const { data } = await query
                if (data) {
                    const mapped = (data as GameWithClub[]).map(g => {
                        const club = clubs.find(c => c.name === g.equipa_casa || c.name === g.equipa_fora)
                        return {
                            ...g,
                            _clubId: club?.id,
                            _clubSlug: club?.slug,
                        }
                    })
                    setGames(mapped)
                }
            } catch {
                setGames([])
            }
            setLoading(false)
        }
        fetchGames()
    }, [tab, clubs, followedClubIds])

    // ── Live games count ──
    const liveGames = useMemo(() => games.filter(g => g.status === 'A DECORRER'), [games])
    const hasLiveGames = liveGames.length > 0

    // ── Tabs ──
    const tabs: { id: Tab; label: string; icon?: React.ReactNode; show?: boolean }[] = [
        ...(user && followedClubIds.length > 0
            ? [{ id: 'seguidos' as Tab, label: 'Seguidos', icon: <Activity size={13} />, show: true }]
            : []),
        { id: 'proximos' as Tab, label: 'Próximos', icon: <Clock size={13} />, show: true },
        { id: 'resultados' as Tab, label: 'Resultados', icon: <Trophy size={13} />, show: true },
    ].filter(t => t.show !== false)

    return (
        <div className="max-w-2xl mx-auto pb-24">
            <PageHeader />

            {/* Header */}
            <div className="px-4 pt-2 pb-1 flex items-center justify-between">
                <div className="flex items-baseline gap-2">
                    <h1 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">
                        Dribly<span className="text-dribly-purple">.</span>
                    </h1>
                    {hasLiveGames && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-red-500 animate-pulse">
                            <Flame size={12} />
                            {liveGames.length} AO VIVO
                        </span>
                    )}
                </div>
                <button
                    onClick={() => setSearchOpen(true)}
                    className="p-2 rounded-full text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                >
                    <Search size={18} />
                </button>
            </div>

            {/* Tabs */}
            <div className="px-4 sticky top-14 sm:top-16 z-30 bg-zinc-50/90 dark:bg-zinc-950/90 backdrop-blur-md pb-2">
                <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl p-1">
                    {tabs.map(t => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                                tab === t.id
                                    ? 'bg-white dark:bg-zinc-800 text-dribly-purple shadow-sm'
                                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                            }`}
                        >
                            {t.icon}
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="px-4 pt-2">
                {loading ? (
                    <div className="flex justify-center py-12">
                        <LoadingSpinner />
                    </div>
                ) : games.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="w-12 h-12 mx-auto rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-3">
                            {tab === 'seguidos' ? (
                                <Activity size={20} className="text-zinc-400" />
                            ) : tab === 'proximos' ? (
                                <Clock size={20} className="text-zinc-400" />
                            ) : (
                                <Trophy size={20} className="text-zinc-400" />
                            )}
                        </div>
                        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                            {tab === 'seguidos'
                                ? 'Nenhum jogo dos teus clubes nos próximos dias.'
                                : tab === 'proximos'
                                    ? 'Nenhum jogo nos próximos 3 dias.'
                                    : 'Nenhum resultado recente.'}
                        </p>
                        {tab === 'seguidos' && (
                            <Link
                                to="/clubes"
                                className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 rounded-full bg-dribly-purple text-white text-xs font-bold hover:bg-dribly-purple/90 transition-colors"
                            >
                                <Search size={12} />
                                Encontrar clubes
                            </Link>
                        )}
                    </div>
                ) : (
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl overflow-hidden divide-y divide-zinc-100 dark:divide-white/5">
                        {/* Live games first */}
                        {hasLiveGames && tab !== 'resultados' && (
                            <>
                                {liveGames.map((g, i) => (
                                    <div key={g.slug || i} className="relative">
                                        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-red-500 rounded-r" />
                                        <GameRow match={g} clubs={clubs} showCompetition />
                                    </div>
                                ))}
                            </>
                        )}

                        {/* Other games */}
                        {games
                            .filter(g => !hasLiveGames || g.status !== 'A DECORRER')
                            .map((g, i) => (
                                <GameRow
                                    key={g.slug || i}
                                    match={g}
                                    clubs={clubs}
                                    showCompetition={tab !== 'seguidos'}
                                />
                            ))}
                    </div>
                )}
            </div>

            {/* Bottom hint — only for new users */}
            {!user && tab === 'proximos' && !loading && (
                <div className="px-4 mt-6">
                    <div className="bg-dribly-purple/5 dark:bg-dribly-purple/10 border border-dribly-purple/20 rounded-2xl p-4 flex items-center gap-3">
                        <Bell size={20} className="text-dribly-purple shrink-0" />
                        <div className="min-w-0">
                            <p className="text-xs font-bold text-dribly-purple">
                                Cria conta para seguir clubes
                            </p>
                            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                                Recebe notificações dos jogos e vê os teus clubes no topo.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Search modal — simple inline version */}
            {searchOpen && <SearchOverlay clubs={clubs} onClose={() => setSearchOpen(false)} />}
        </div>
    )
}

// ── Inline search overlay ──

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
