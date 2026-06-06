import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Heart, ListOrdered, CalendarDays, Trophy, Users, BarChart4, LayoutDashboard, ExternalLink } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { logger } from '../lib/logger'
import { useFollows } from '../hooks/useFollows'
import { useAuth } from '../lib/AuthContext'
import { useClub } from '../lib/ClubContext'
import { supabase } from '../lib/supabase'
import {
    fetchStandings, fetchSchedule, fetchResults, fetchTeams, fetchPlayerStats,
    type FPBStandingPhase, type FPBGame, type FPBTeam, type FPBPlayerStat
} from '../lib/fpbCompetitionsApi'
import { GameCard } from '../components/GameCard'
import { type Match } from '../components/types'

const COMP_NAMES: Record<number, string> = {
    10902: 'Liga Betclic Masculina',
    10903: 'Proliga',
    10904: '1ª Divisão Masculina',
    10905: '2ª Divisão Masculina',
    10906: 'Liga Betclic Feminina',
    10907: '1ª Divisão Feminina',
    10908: '2ª Divisão Feminina',
    10917: 'Taça Hugo dos Santos',
    10909: 'Liga BCR',
    10920: 'Supertaça Feminina',
}

type Tab = 'geral' | 'classificacao' | 'resultados' | 'calendario' | 'equipas' | 'estatisticas'
const TAB_CONFIG = [
    { value: 'geral' as Tab, label: 'Vista Geral', icon: LayoutDashboard, color: 'from-dribly-purple to-purple-600' },
    { value: 'classificacao' as Tab, label: 'Classificação', icon: ListOrdered, color: 'from-violet-500 to-purple-600' },
    { value: 'resultados' as Tab, label: 'Resultados', icon: Trophy, color: 'from-emerald-500 to-green-600' },
    { value: 'calendario' as Tab, label: 'Agenda', icon: CalendarDays, color: 'from-blue-500 to-cyan-600' },
    { value: 'equipas' as Tab, label: 'Equipas', icon: Users, color: 'from-amber-500 to-orange-600' },
    { value: 'estatisticas' as Tab, label: 'Estatísticas', icon: BarChart4, color: 'from-pink-500 to-rose-600' },
]

function getTabsFor() {
    return TAB_CONFIG
}

function normalize(s: string): string {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

interface LogoMaps {
    logos: Map<string, string>
    searchNames: Map<string, string>
}

/** Build normalized name→logo maps from the clubs list (name + search_name) */
function buildLogoMap(clubs: { name: string; search_name: string; logo_url: string | null }[]): LogoMaps {
    const logos = new Map<string, string>()
    const searchNames = new Map<string, string>()
    for (const c of clubs) {
        if (c.logo_url) {
            logos.set(normalize(c.name), c.logo_url)
            if (c.search_name) searchNames.set(normalize(c.search_name), c.logo_url)
        }
    }
    return { logos, searchNames }
}

/** Match a team name to a logo using the logo maps */
function findLogo(teamName: string, maps: LogoMaps): string | null {
    const n = normalize(teamName)

    // 1. Exact match on club name or search_name
    if (maps.logos.has(n)) return maps.logos.get(n)!
    if (maps.searchNames.has(n)) return maps.searchNames.get(n)!

    // 2. Substring: team contains club/search name, or vice versa
    for (const [name, logo] of maps.logos) {
        if (n.includes(name) || name.includes(n)) return logo
    }
    for (const [name, logo] of maps.searchNames) {
        if (n.includes(name) || name.includes(n)) return logo
    }

    // 3. Word-level: match only if the word uniquely identifies ONE club
    const teamWords = n.split(/\s+/).filter(w => w.length > 2)
    for (const tw of teamWords) {
        // Count clubs with this word in their name
        const logoHits = new Map<string, number>()
        for (const [cn, logo] of maps.logos) {
            const cw = cn.split(/\s+/).filter(w => w.length > 2)
            if (cw.includes(tw)) logoHits.set(logo, (logoHits.get(logo) || 0) + 1)
        }
        for (const [sn, logo] of maps.searchNames) {
            const sw = sn.split(/\s+/).filter(w => w.length > 2)
            if (sw.includes(tw)) logoHits.set(logo, (logoHits.get(logo) || 0) + 1)
        }
        if (logoHits.size === 1) return logoHits.keys().next().value ?? null
    }

    return null
}

import { semiAbrev } from '../lib/fpbUtils'

function fpbGameToMatch(g: FPBGame, logoMaps: LogoMaps): Match {
    const slug = g.jogo_id || `${g.data}-${g.equipa_casa.toLowerCase().replace(/\s+/g, '-')}-${g.equipa_fora.toLowerCase().replace(/\s+/g, '-')}`
    const status: Match['status'] = g.estado === 'FINALIZADO' ? 'FINALIZADO' : g.estado === 'A DECORRER' ? 'A DECORRER' : 'AGENDADO'
    return {
        id: g.jogo_id || slug,
        slug,
        data: g.data,
        hora: g.hora || '',
        equipa_casa: g.equipa_casa,
        equipa_fora: g.equipa_fora,
        resultado_casa: g.resultado_casa ?? null,
        resultado_fora: g.resultado_fora ?? null,
        escalao: '',
        competicao: '',
        local: g.pavilhao || null,
        logotipo_casa: g.logo_casa || findLogo(g.equipa_casa, logoMaps) || null,
        logotipo_fora: g.logo_fora || findLogo(g.equipa_fora, logoMaps) || null,
        status,
    }
}


/** Find the best team across all standings phases — leader, winner, or any available */
function findTopTeam(standings: FPBStandingPhase[]): { name: string; label: string; j?: number; v?: number; d?: number; pts?: number } | null {
    // First: look for a table leader
    for (const phase of standings) {
        if (phase.type === 'table' && phase.teams.length > 0) {
            const t = phase.teams[0]
            return { name: t.equipa, label: 'Líder', j: t.j, v: t.v, d: t.d, pts: t.pts }
        }
    }
    // Second: look for game phases — find the most recent game by date (likely the final)
        // Second: look for game phases — the LAST phase is typically the final
    // Find the last phase that has games with scores
    for (let i = standings.length - 1; i >= 0; i--) {
        const phase = standings[i]
        if (phase.type !== 'games' || phase.teams.length === 0) continue
        // Take the last game in this phase (the final match)
        const finalGame = phase.teams[phase.teams.length - 1]
        if (finalGame.score_casa !== undefined && finalGame.score_fora !== undefined && (finalGame.casa || finalGame.fora)) {
            const sc = [finalGame.score_casa ?? 0, finalGame.score_fora ?? 0]
            const isCasaWinner = sc[0] > sc[1]
            const winner = isCasaWinner ? (finalGame.casa || '') : (finalGame.fora || '')
            const loser = isCasaWinner ? (finalGame.fora || '') : (finalGame.casa || '')
            const score = isCasaWinner ? sc[0] + '-' + sc[1] : sc[1] + '-' + sc[0]
            return { name: winner, label: 'Vencedor' + (score ? ' · ' + score : '') + (loser ? ' vs ' + loser : '') }
        }
    }
    // Third: just use any team from any phase
    for (const phase of standings) {
        if (phase.teams.length > 0) {
            const t = phase.teams[0]
            const name = t.equipa || t.casa || t.fora || ''
            if (name) return { name, label: 'Destaque' }
        }
    }
    return null
}

export default function CompetitionDetail() {
    const { competitionId } = useParams<{ competitionId: string }>()
    const provaId = parseInt(competitionId || '0')
    const { user } = useAuth()
    const { isFollowing, toggleFollow } = useFollows()
    const { clubs, loadClubs } = useClub()

    const [tab, setTab] = useState<Tab>('geral')
    const [compName, setCompName] = useState('')
    const [standings, setStandings] = useState<FPBStandingPhase[]>([])
    const [selectedPhase, setSelectedPhase] = useState(0)
    const [games, setGames] = useState<FPBGame[]>([])
    const [teams, setTeams] = useState<FPBTeam[]>([])
    const [playerStats, setPlayerStats] = useState<FPBPlayerStat[]>([])
    const lastFetchMapRef = useRef<Map<number, number>>(new Map())
    const CACHE_TTL = 15 * 60 * 1000 // 15 minutes

    const [loading, setLoading] = useState(true)
    useEffect(() => { loadClubs() }, [])

    // Fetch competition name from Supabase (much larger catalogue than COMP_NAMES)
    useEffect(() => {
        if (!provaId) return
        supabase.from('competitions')
            .select('competition_name')
            .eq('competition_id', provaId)
            .eq('season', '2025/2026')
            .single()
            .then(({ data }) => {
                if (data?.competition_name) setCompName(data.competition_name)
            }, () => { /* fallback to COMP_NAMES or raw ID */ })
    }, [provaId])

    useEffect(() => {
        if (!provaId) return

        const now = Date.now()
        const lastFetch = lastFetchMapRef.current.get(provaId)
        if (lastFetch && now - lastFetch < CACHE_TTL && games.length > 0) return // cache fresh for this competition

        setLoading(true)
        lastFetchMapRef.current.set(provaId, now)

        const loadAll = async () => {
            try {
                const results = await Promise.allSettled([
                    fetchStandings(provaId),
                    Promise.all([fetchSchedule(provaId), fetchResults(provaId)]),
                    fetchTeams(provaId),
                    fetchPlayerStats(provaId, 'val'),
                ])
                const fetchStart = lastFetchMapRef.current.get(provaId) || 0
                if (Date.now() - fetchStart >= CACHE_TTL + 5000) return // stale (fetch took > 5s past TTL)

                if (results[0].status === 'fulfilled') { setStandings(results[0].value); setSelectedPhase(0) }
                if (results[1].status === 'fulfilled') {
                    const [sched, res] = results[1].value as [FPBGame[], FPBGame[]]
                    const merged = new Map<string, FPBGame>()
                    for (const g of sched) merged.set(g.data + g.equipa_casa + g.equipa_fora, g)
                    for (const g of res) merged.set(g.data + g.equipa_casa + g.equipa_fora, g)
                    setGames(Array.from(merged.values()))
                }
                if (results[2].status === 'fulfilled') setTeams(results[2].value)
                if (results[3].status === 'fulfilled') setPlayerStats(results[3].value)
            } catch (e) { logger.error('Failed to load competition data:', e) }
            setLoading(false)
        }
        loadAll()
    }, [provaId]) // ← only depends on provaId, NOT tab

    const isFollowed = user ? isFollowing('competition', provaId) : false

    const handleToggleFollow = async () => {
        if (!user) return
        await toggleFollow('competition', provaId)
    }

    const logoMaps = useMemo(() => buildLogoMap(clubs), [clubs])

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr)
        const formatted = date.toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'long' })
        return formatted.charAt(0).toUpperCase() + formatted.slice(1)
    }

    // Separate games into schedule (upcoming/not started) and results (finished/in-progress)
    const today = new Date().toISOString().split('T')[0]
    const scheduleList = useMemo(() =>
        games.filter(g =>
            g.estado !== 'FINALIZADO' && g.estado !== 'A DECORRER' &&
            (g.resultado_casa === undefined || g.resultado_fora === undefined) &&
            g.data >= today
        ).sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime()),
        [games, today]
    )
    const scheduleByDate = useMemo(() => {
        const groups: Record<string, FPBGame[]> = {}
        for (const g of scheduleList) {
            if (!groups[g.data]) groups[g.data] = []
            groups[g.data].push(g)
        }
        return Object.entries(groups)
    }, [scheduleList])

    const resultsList = useMemo(() =>
        games.filter(g =>
            g.estado === 'FINALIZADO' || g.estado === 'A DECORRER' ||
            (g.resultado_casa !== undefined && g.resultado_fora !== undefined)
        ).sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()),
        [games]
    )
    const resultsByDate = useMemo(() => {
        const groups: Record<string, FPBGame[]> = {}
        for (const g of resultsList) {
            if (!groups[g.data]) groups[g.data] = []
            groups[g.data].push(g)
        }
        return Object.entries(groups)
    }, [resultsList])

    if (!provaId) {
        return (
            <div className="max-w-xl mx-auto px-3 py-16 text-center">
                <p className="text-sm text-zinc-500">Competição não encontrada.</p>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-[#09090b] dark:via-zinc-950 dark:to-[#09090b]">
            <div className="max-w-6xl mx-auto px-3 sm:px-5 pt-6 pb-24">
                <PageHeader
                    backTo="/ligas"
                    right={user ? (
                        <button
                            onClick={handleToggleFollow}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all active:scale-[0.97] ${
                                isFollowed
                                    ? 'bg-dribly-purple/10 text-dribly-purple border border-dribly-purple/30'
                                    : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-white/10 hover:border-dribly-purple/30 hover:text-dribly-purple'
                            }`}
                        >
                            <Heart size={13} strokeWidth={isFollowed ? 2.5 : 2} fill={isFollowed ? 'currentColor' : 'none'} />
                            {isFollowed ? 'A seguir' : 'Seguir'}
                        </button>
                    ) : undefined}
                />

                <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white mb-1 tracking-tight">
                    {compName || COMP_NAMES[provaId] || `Competição #${provaId}`}
                </h1>
                <p className="text-sm text-zinc-400 mb-4">2025/2026 · Fase Regular</p>

                <div className="flex items-center gap-3 mb-6">
                    <a href={`https://www.fpb.pt/competicao/${provaId}/`} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 hover:text-dribly-purple transition-colors">
                        <ExternalLink size={11} />
                        Ver na FPB
                    </a>
                </div>

                {/* Tab bar */}
                <div className="sticky top-16 z-40 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl -mx-3 sm:-mx-5 px-3 sm:px-5 pb-2 mb-5 border-b border-zinc-100 dark:border-white/5 overflow-x-auto">
                    <div className="flex gap-1.5 min-w-max">
                        {getTabsFor().map(t => {
                            const active = tab === t.value
                            const Icon = t.icon
                            return (
                                <button
                                    key={t.value}
                                    onClick={() => setTab(t.value)}
                                    className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 active:scale-[0.97] ${
                                        active
                                            ? 'bg-dribly-purple text-white shadow-sm shadow-dribly-purple/20'
                                            : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5 hover:text-zinc-700 dark:hover:text-zinc-200'
                                    }`}
                                >
                                    <Icon size={15} strokeWidth={active ? 2.5 : 2} />
                                    {t.label}
                                </button>
                            )
                        })}
                    </div>
                </div>

                <div className="mt-5">
                    {loading ? (
                        <LoadingSpinner />
                    ) : (
                        <>
                            {/* Overview */}
                            {tab === 'geral' && (
                                <div className="space-y-5">
                                    {/* Row 1 — Leader + Stat Leaders (3:4 ratio) */}
                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                                        {/* Leader card */}
                                        {(() => {
                                            const top = findTopTeam(standings)
                                            if (!top) return (
                                                <div className="lg:col-span-5 bg-white dark:bg-zinc-900/60 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 p-5 flex items-center justify-center">
                                                    <p className="text-xs text-zinc-400">Sem classificação disponível.</p>
                                                </div>
                                            )
                                            const topLogo = findLogo(top.name, logoMaps)
                                            return (
                                                <div className="lg:col-span-5 bg-white dark:bg-zinc-900/60 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 p-5 flex items-center gap-4">
                                                    <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-2xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center border border-zinc-200 dark:border-zinc-700/50">
                                                        {topLogo ? (
                                                            <img src={topLogo} alt="" className="w-14 h-14 sm:w-[72px] sm:h-[72px] object-contain" />
                                                        ) : (
                                                            <span className="text-2xl font-bold text-zinc-500">{top.name.charAt(0)}</span>
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2 mb-0.5">
                                                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{top.label}</span>
                                                            <span className="px-1.5 py-0.5 rounded-md bg-dribly-purple/10 text-[9px] font-black text-dribly-purple tabular-nums">#1</span>
                                                        </div>
                                                        <p className="text-sm sm:text-base font-black text-zinc-900 dark:text-white truncate leading-tight">{top.name}</p>
                                                        {top.j !== undefined && (
                                                            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-1 flex items-center gap-1.5 flex-wrap">
                                                                <span className="tabular-nums">{top.j} jogos</span>
                                                                <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                                                                <span className="text-emerald-600 dark:text-emerald-400 tabular-nums font-bold">{top.v}V</span>
                                                                <span className="text-red-500 dark:text-red-400 tabular-nums font-bold">{top.d}D</span>
                                                                {top.pts !== undefined && (<><span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-600" /><span className="font-black text-zinc-900 dark:text-white tabular-nums">{top.pts} pts</span></>)}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })()}

                                        {/* Stat leaders */}
                                        <div className="lg:col-span-7 grid grid-cols-2 gap-2.5">
                                            {(() => {
                                                const categories: { key: keyof FPBPlayerStat; label: string; unit: string }[] = [
                                                    { key: 'pts', label: 'Melhor Marcador', unit: 'PPJ' },
                                                    { key: 'reb', label: 'Melhor Ressalteiro', unit: 'RPJ' },
                                                    { key: 'ast', label: 'Melhor Passador', unit: 'APJ' },
                                                    { key: 'val', label: 'Melhor Valorização', unit: '' },
                                                ]
                                                const hasStats = playerStats.length > 0
                                                return categories.map(cat => {
                                                    const sorted = hasStats
                                                        ? [...playerStats].filter(p => Number(p[cat.key] || 0) > 0).sort((a, b) => Number(b[cat.key] || 0) - Number(a[cat.key] || 0))
                                                        : []
                                                    const best = sorted[0]
                                                    const photoUrl = best ? (best as any).photoUrl || null : null
                                                    return (
                                                        <div key={cat.key} className={`rounded-2xl border p-3 flex items-center gap-3 ${hasStats ? 'bg-white dark:bg-zinc-900/60 border-zinc-200/50 dark:border-zinc-800/50' : 'bg-zinc-50 dark:bg-zinc-900/30 border-zinc-100 dark:border-zinc-800/30'}`}>
                                                            {hasStats && best ? (
                                                                <>
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{cat.label}</p>
                                                                        <p className="text-sm font-black text-zinc-900 dark:text-white truncate mt-0.5">{best.nome}</p>
                                                                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">{best.clube_nome}</p>
                                                                        <p className="text-lg font-black text-dribly-purple tabular-nums mt-0.5">
                                                                            {typeof best[cat.key] === 'number' ? (Number.isInteger(best[cat.key]) ? best[cat.key] : (best[cat.key] as number).toFixed(1)) : '—'}
                                                                            {cat.unit && <span className="text-[10px] text-zinc-400 ml-0.5">{cat.unit}</span>}
                                                                        </p>
                                                                    </div>
                                                                    {photoUrl ? (
                                                                        <img src={photoUrl} alt="" className="w-14 h-14 shrink-0 rounded-xl object-cover border-2 border-zinc-100 dark:border-zinc-700/50" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                                                                    ) : (
                                                                        <div className="w-14 h-14 shrink-0 rounded-xl bg-gradient-to-br from-dribly-purple/20 to-dribly-purple/5 flex items-center justify-center border border-dribly-purple/10">
                                                                            <span className="text-lg font-black text-dribly-purple">{best ? best.nome.charAt(0).toUpperCase() : '?'}</span>
                                                                        </div>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{cat.label}</p>
                                                                    <p className="text-xs text-zinc-400">Sem dados</p>
                                                                </>
                                                            )}
                                                        </div>
                                                    )
                                                })
                                            })()}
                                        </div>
                                    </div>

                                    {/* Row 2 — Próximos Jogos + Últimos Resultados lado a lado */}
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                        {/* Próximos jogos */}
                                        <div className="bg-white dark:bg-zinc-900/60 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 p-4">
                                            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                                <CalendarDays size={14} className="text-dribly-purple" />
                                                Próximos Jogos
                                            </h3>
                                            {scheduleList.length > 0 ? (
                                                <div className="space-y-2">
                                                    {scheduleList.slice(0, 3).map((g, i) => (
                                                        <GameCard key={i} match={fpbGameToMatch(g, logoMaps)} mode="agenda" />
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-zinc-400 py-4 text-center">Sem jogos agendados.</p>
                                            )}
                                        </div>

                                        {/* Últimos resultados */}
                                        <div className="bg-white dark:bg-zinc-900/60 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 p-4">
                                            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                                <Trophy size={14} className="text-dribly-purple" />
                                                Últimos Resultados
                                            </h3>
                                            {resultsList.length > 0 ? (
                                                <div className="space-y-2">
                                                    {resultsList.slice(0, 3).map((g, i) => (
                                                        <GameCard key={i} match={fpbGameToMatch(g, logoMaps)} mode="results" />
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-zinc-400 py-4 text-center">Sem resultados disponíveis.</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Standings */}
                            {tab === 'classificacao' && (
                                standings.length === 0
                                    ? <Empty text="Classificação não disponível." />
                                    : (
                                    <>
                                        {standings.length > 1 && (
                                            <div className="flex items-center gap-2 mb-4">
                                                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Fase</label>
                                                <select
                                                    value={selectedPhase}
                                                    onChange={e => setSelectedPhase(parseInt(e.target.value))}
                                                    className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300 text-xs font-medium rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-dribly-purple/30"
                                                >
                                                    {standings.map((p, i) => (
                                                        <option key={i} value={i}>{p.name} ({p.teams.length})</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                        {standings[selectedPhase] && standings[selectedPhase].type === 'games' && (
                                            <div className="space-y-3">
                                                {standings[selectedPhase].teams.map((t, i) => (
                                                    <div key={i} className="bg-white dark:bg-zinc-900/90 border border-zinc-200/60 dark:border-zinc-800/60 rounded-2xl p-4">
                                                        {/* Date header */}
                                                        {t.data && (
                                                            <div className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2.5 text-center">{t.data}</div>
                                                        )}
                                                        {/* Game row */}
                                                        <div className="flex items-center gap-2">
                                                            {/* Home team */}
                                                            <div className="flex-1 flex items-center gap-2 min-w-0">
                                                                <div className="w-9 h-9 rounded-full bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                                                                    {t.logo_casa ? (
                                                                        <img src={t.logo_casa} alt="" className="w-9 h-9 rounded-full object-contain" />
                                                                    ) : null}
                                                                </div>
                                                                <span className="text-[11px] sm:text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate">{t.casa || t.equipa}</span>
                                                            </div>
                                                            {/* Score */}
                                                            <div className="flex items-center gap-1.5 shrink-0">
                                                                <span className={`text-base sm:text-lg font-black tabular-nums ${(t.score_casa ?? 0) >= (t.score_fora ?? 0) ? 'text-dribly-purple' : 'text-zinc-400 dark:text-zinc-600'}`}>{t.score_casa ?? '?'}</span>
                                                                <span className="text-xs text-zinc-300 dark:text-zinc-600 font-bold">-</span>
                                                                <span className={`text-base sm:text-lg font-black tabular-nums ${(t.score_fora ?? 0) >= (t.score_casa ?? 0) ? 'text-dribly-purple' : 'text-zinc-400 dark:text-zinc-600'}`}>{t.score_fora ?? '?'}</span>
                                                            </div>
                                                            {/* Away team */}
                                                            <div className="flex-1 flex items-center gap-2 min-w-0 justify-end">
                                                                <span className="text-[11px] sm:text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate">{t.fora || ''}</span>
                                                                <div className="w-9 h-9 rounded-full bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                                                                    {t.logo_fora ? (
                                                                        <img src={t.logo_fora} alt="" className="w-9 h-9 rounded-full object-contain" />
                                                                    ) : null}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {standings[selectedPhase] && standings[selectedPhase].type === 'table' && standings[selectedPhase].teams.length === 0 && (
                                            <Empty text={`${standings[selectedPhase].name} — sem dados disponíveis`} />
                                        )}
                                        {standings[selectedPhase] && standings[selectedPhase].type === 'table' && standings[selectedPhase].teams.length > 0 && (
                                        <div className="bg-white dark:bg-zinc-900/60 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 overflow-hidden">
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="bg-zinc-50 dark:bg-zinc-800/40">
                                                            <th className="pl-3 pr-1 py-2.5 text-center text-[10px] font-bold text-zinc-400 uppercase w-8">#</th>
                                                            <th className="pl-2 pr-3 py-2.5 text-left text-[10px] font-bold text-zinc-400 uppercase">Equipa</th>
                                                            <th className="px-2 py-2.5 text-center text-[10px] font-bold text-zinc-400 uppercase w-8">J</th>
                                                            <th className="px-2 py-2.5 text-center text-[10px] font-bold text-zinc-400 uppercase w-8">V</th>
                                                            <th className="px-2 py-2.5 text-center text-[10px] font-bold text-zinc-400 uppercase w-8">D</th>
                                                            <th className="hidden sm:table-cell px-2 py-2.5 text-center text-[10px] font-bold text-zinc-400 uppercase w-10">PM</th>
                                                            <th className="hidden sm:table-cell px-2 py-2.5 text-center text-[10px] font-bold text-zinc-400 uppercase w-10">PS</th>
                                                            <th className="pr-3 pl-2 py-2.5 text-center text-[10px] font-bold text-zinc-400 uppercase w-10">Pts</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/30">
                                                        {standings[selectedPhase].teams.map((team, i) => (
                                                            <tr key={i} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/20">
                                                                <td className="pl-3 pr-1 py-2.5 text-center">
                                                                    <span className="text-xs font-bold text-zinc-500 tabular-nums">{team.posicao}</span>
                                                                </td>
                                                                <td className="pl-2 pr-3 py-2.5">
                                                                    <span className="inline-flex items-center gap-2">
                                                                        {team.logo ? <img src={team.logo} alt="" className="w-5 h-5 rounded-full object-contain shrink-0" /> : null}
                                                                        <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200 break-words">{semiAbrev(team.equipa)}</span>
                                                                    </span>
                                                                </td>
                                                                <td className="px-2 py-2.5 text-center"><span className="text-xs text-zinc-500 tabular-nums">{team.j}</span></td>
                                                                <td className="px-2 py-2.5 text-center"><span className="text-xs font-medium text-emerald-600 tabular-nums">{team.v}</span></td>
                                                                <td className="px-2 py-2.5 text-center"><span className="text-xs font-medium text-red-500 tabular-nums">{team.d}</span></td>
                                                                <td className="hidden sm:table-cell px-2 py-2.5 text-center"><span className="text-xs text-zinc-500 tabular-nums">{team.pm ?? '—'}</span></td>
                                                                <td className="hidden sm:table-cell px-2 py-2.5 text-center"><span className="text-xs text-zinc-500 tabular-nums">{team.ps ?? '—'}</span></td>
                                                                <td className="pr-3 pl-2 py-2.5 text-center"><span className="text-xs font-black text-zinc-900 dark:text-white tabular-nums">{team.pts}</span></td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                            <div className="px-4 py-3 border-t border-zinc-100 dark:border-zinc-800/50 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-zinc-400">
                                                <span><b className="text-zinc-500">J</b> Jogos</span>
                                                <span><b className="text-zinc-500">V</b> Vitórias</span>
                                                <span><b className="text-zinc-500">D</b> Derrotas</span>
                                                <span className="hidden sm:inline"><b className="text-zinc-500">FC</b> Faltas Comp.</span>
                                                <span className="hidden sm:inline"><b className="text-zinc-500">PM</b> Pontos Marcados</span>
                                                <span className="hidden sm:inline"><b className="text-zinc-500">PS</b> Pontos Sofridos</span>
                                                <span className="hidden sm:inline"><b className="text-zinc-500">DIF</b> Diferença</span>
                                                <span><b className="text-zinc-500">Pts</b> Pontos</span>
                                            </div>
                                        </div>
                                        )}
                                        </>
                                    )
                            )}

                            {/* Results */}
                            {tab === 'resultados' && (
                                resultsList.length === 0
                                    ? <Empty text="Sem resultados disponíveis." />
                                    : <div className="space-y-6 px-2 md:px-4">
                                        {resultsByDate.map(([date, dateGames]) => (
                                            <div key={date}>
                                                <div className="flex items-center gap-3 mb-3 px-2">
                                                    <h3 className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-widest">{formatDate(date)}</h3>
                                                    <div className="flex-1 h-px bg-zinc-200 dark:bg-white/5" />
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                    {dateGames.map((g, i) => (
                                                        <GameCard key={i} match={fpbGameToMatch(g, logoMaps)} mode="results" />
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                            )}

                            {/* Schedule */}
                            {tab === 'calendario' && (
                                scheduleList.length === 0
                                    ? <Empty text="Sem jogos agendados." />
                                    : <div className="space-y-6 px-2 md:px-4">
                                        {scheduleByDate.map(([date, dateGames]) => (
                                            <div key={date}>
                                                <div className="flex items-center gap-3 mb-3 px-2">
                                                    <h3 className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-widest">{formatDate(date)}</h3>
                                                    <div className="flex-1 h-px bg-zinc-200 dark:bg-white/5" />
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                    {dateGames.map(g => (
                                                        <GameCard key={g.jogo_id || g.data+g.equipa_casa} match={fpbGameToMatch(g, logoMaps)} mode="agenda" />
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                            )}

                            {/* Teams */}
                            {tab === 'equipas' && (
                                teams.length === 0
                                    ? <Empty text="Sem dados de equipas." />
                                    : (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                                            {teams.map((team, i) => {
                                                const fpbLogo = team.logo
                                                const supabaseLogo = findLogo(team.nome, logoMaps)
                                                const logo = fpbLogo || supabaseLogo
                                                const hasPhoto = !!team.photo
                                                return (
                                                <div
                                                    key={i}
                                                    className="relative overflow-hidden rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 p-4 text-center hover:border-dribly-purple/30 transition-all bg-cover bg-center"
                                                    style={hasPhoto ? { backgroundImage: `url(${team.photo})` } : undefined}
                                                >
                                                    {/* Photo overlay */}
                                                    {hasPhoto && <div className="absolute inset-0 bg-black/50 dark:bg-black/60" />}
                                                    {/* No-photo background */}
                                                    {!hasPhoto && <div className="absolute inset-0 bg-white dark:bg-zinc-900/90" />}
                                                    {/* Content */}
                                                    <div className="relative z-10">
                                                        {logo ? (
                                                            <img
                                                                src={logo}
                                                                alt=""
                                                                className="w-20 h-20 mx-auto object-contain rounded-2xl bg-zinc-50/90 dark:bg-zinc-800/90 mb-3 drop-shadow-sm"
                                                                onError={(e) => {
                                                                    const el = e.currentTarget
                                                                    // If FPB logo failed and we have a Supabase fallback, try it
                                                                    if (fpbLogo && supabaseLogo && el.src !== supabaseLogo) {
                                                                        el.src = supabaseLogo
                                                                    } else {
                                                                        // Both failed — hide img, show fallback div
                                                                        el.style.display = 'none'
                                                                        const fb = el.nextElementSibling as HTMLElement | null
                                                                        if (fb) fb.style.display = ''
                                                                    }
                                                                }}
                                                            />
                                                        ) : null}
                                                        <div className={`w-20 h-20 mx-auto rounded-2xl bg-zinc-100/80 dark:bg-zinc-800/80 flex items-center justify-center mb-3 ${logo ? 'hidden' : ''}`}>
                                                            <span className="text-2xl font-bold text-zinc-500">{team.nome.charAt(0)}</span>
                                                        </div>
                                                        <p className={`text-xs font-bold leading-tight truncate ${hasPhoto ? 'text-white' : 'text-zinc-700 dark:text-zinc-300'}`}>{team.nome}</p>
                                                        {team.associacao && <p className={`text-[10px] mt-0.5 truncate ${hasPhoto ? 'text-white/60' : 'text-zinc-400'}`}>{team.associacao}</p>}
                                                    </div>
                                                </div>
                                                )
                                            })}
                                        </div>
                                    )
                            )}

                            {/* Player Stats */}
                            {tab === 'estatisticas' && (
                                playerStats.length === 0
                                    ? <Empty text="Sem estatísticas disponíveis." />
                                    : <StatsLeaderboard playerStats={playerStats} />
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

const STAT_TYPES: { key: keyof FPBPlayerStat; label: string; unit: string }[] = [
    { key: 'val', label: 'Valorização', unit: '' },
    { key: 'pts', label: 'Pontos', unit: 'PPJ' },
    { key: 'reb', label: 'Ressaltos', unit: 'RPJ' },
    { key: 'ast', label: 'Assistências', unit: 'APJ' },
    { key: 'blk', label: 'Desarmes', unit: 'DPJ' },
    { key: 'stl', label: 'Roubos', unit: 'RBPJ' },
]

function StatsLeaderboard({ playerStats }: { playerStats: FPBPlayerStat[] }) {
    const [statType, setStatType] = useState(0)

    const sorted = useMemo(() => {
        const key = STAT_TYPES[statType].key
        return [...playerStats]
            .filter(p => ((p[key] as number) || 0) > 0)
            .sort((a, b) => ((b[key] as number) || 0) - ((a[key] as number) || 0))
            .slice(0, 5)
    }, [playerStats, statType])

    return (
        <div>
            {/* Stat type pills */}
            <div className="flex items-center gap-2 mb-4 flex-wrap overflow-x-auto pb-1">
                {STAT_TYPES.map((st, i) => (
                    <button
                        key={st.key}
                        onClick={() => setStatType(i)}
                        className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                            i === statType
                                ? 'bg-dribly-purple text-white'
                                : 'bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-white/10 hover:border-dribly-purple/30'
                        }`}
                    >
                        {st.label}
                    </button>
                ))}
            </div>

            {/* Player grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {sorted.map((p, i) => {
                    const val = p[STAT_TYPES[statType].key]
                    const displayVal = typeof val === 'number' ? (Number.isInteger(val) ? val : val.toFixed(1)) : '—'
                    const photoUrl = (p as any).photoUrl || null

                    return (
                        <div key={p.atleta_id} className="bg-white dark:bg-zinc-900/90 border border-zinc-200/60 dark:border-zinc-800/60 rounded-2xl p-4 text-center hover:border-dribly-purple/30 transition-all group">
                            <span className="absolute top-2 left-3 text-[10px] font-black text-zinc-300 dark:text-zinc-600">{i + 1}</span>
                            <div className="relative w-24 h-24 mx-auto mb-3">
                                {photoUrl ? (
                                    <img src={photoUrl} alt="" className="w-24 h-24 object-cover rounded-full border-[3px] border-zinc-100 dark:border-white/10 shadow-md" fetchPriority="high" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden') }} />
                                ) : null}
                                <div className={`w-24 h-24 rounded-full bg-gradient-to-br from-dribly-purple/20 to-dribly-purple/5 flex items-center justify-center mx-auto ${photoUrl ? 'hidden' : ''}`}>
                                    <span className="text-3xl font-black text-dribly-purple">{p.nome.charAt(0).toUpperCase()}</span>
                                </div>
                            </div>
                            <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200 leading-tight truncate">{p.nome}</p>
                            <p className="text-[11px] text-zinc-400 truncate mt-0.5">{p.clube_nome}</p>
                            <div className="mt-2">
                                <span className="text-2xl font-black text-dribly-purple">{displayVal}</span>
                                {STAT_TYPES[statType].unit && <span className="text-[10px] text-zinc-400 ml-0.5">{STAT_TYPES[statType].unit}</span>}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

function Empty({ text }: { text: string }) {
    return (
        <div className="text-center py-16 bg-white dark:bg-zinc-900/50 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60">
            <p className="text-sm text-zinc-400">{text}</p>
        </div>
    )
}
