import { useState, useEffect, useMemo } from 'react'
import { Link, useParams, useSearchParams, useOutletContext } from 'react-router-dom'
import { ArrowLeft, Calendar, Trophy, Users, Info } from 'lucide-react'
import { useGames } from '../../hooks/useGames'
import { useEquipaGames } from '../../hooks/useEquipaGames'
import { SkeletonGameGrid } from '../../components/Skeleton'
import { EmptyState } from '../../components/EmptyState'
import { GameCard } from '../../components/GameCard'
import type { Match } from '../../components/types'
import type { Club } from '../../lib/ClubContext'

function slugify(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-+/g, '-')
}

function detectGender(teamName: string, escalao: string): 'M' | 'F' | null {
    const upper = (teamName + ' ' + (escalao || '')).toUpperCase()
    if (/\bFEMININ[OA]S?\b/.test(upper)) return 'F'
    if (/\bMASCULIN[OA]S?\b/.test(upper)) return 'M'
    return null
}

function formatDate(dateStr: string) {
    const date = new Date(dateStr)
    const formatted = date.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })
    return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

function ClubTeamDetail() {
    const { club } = useOutletContext<{ club: Club }>()
    const { teamId: teamSlug } = useParams<{ teamId: string }>()
    const [searchParams, setSearchParams] = useSearchParams()

    type Tab = 'geral' | 'agenda' | 'resultados' | 'plantel'
    const [tab, setTab] = useState<Tab>(() => {
        const v = searchParams.get('tab')
        return (v === 'resultados' || v === 'agenda' || v === 'plantel') ? v : 'geral'
    })

    const equipaId = searchParams.get('eid') || ''
    const { games: clubGames, loading: clubLoading } = useGames('2025/2026', club.id, club.name)
    const { games: equipaGames, photo: equipaPhoto, teamInfo, plantel, loading: equipaLoading } = useEquipaGames(equipaId)

    const loading = equipaId ? equipaLoading : clubLoading
    const games = equipaId && equipaGames.length > 0 ? equipaGames : (clubGames || [])
    const clubNameUpper = club.name.toUpperCase()

    useEffect(() => {
        const params: Record<string, string> = { tab }
        if (equipaId) params.eid = equipaId
        setSearchParams(params)
    }, [tab, setSearchParams, equipaId])

    const { teamName, teamGames } = useMemo(() => {
        if (equipaId) {
            return { teamName: teamInfo.nome || teamSlug?.replace(/-/g, ' ').toUpperCase() || '', teamGames: games }
        }

        const filtered = games.filter(g => {
            let fullTeamName = ''
            if (g.equipa_casa.toUpperCase().includes(clubNameUpper)) fullTeamName = g.equipa_casa
            else if (g.equipa_fora.toUpperCase().includes(clubNameUpper)) fullTeamName = g.equipa_fora
            if (!fullTeamName) return false
            return slugify(fullTeamName) === teamSlug
        })

        const name = filtered.length > 0
            ? (filtered[0].equipa_casa.toUpperCase().includes(clubNameUpper) ? filtered[0].equipa_casa : filtered[0].equipa_fora)
            : ''

        return { teamName: name, teamGames: filtered }
    }, [games, teamSlug, clubNameUpper, equipaId, teamInfo.nome])

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

    const filteredMatches = tab === 'agenda' ? upcoming : tab === 'resultados' ? finished : teamGames

    const groupedMatches = filteredMatches.reduce((groups, match) => {
        const date = match.data
        if (!groups[date]) groups[date] = []
        groups[date].push(match)
        return groups
    }, {} as Record<string, Match[]>)
    Object.values(groupedMatches).forEach(g => g.sort((a, b) => (a.hora || '99:99').localeCompare(b.hora || '99:99')))

    const sortedDates = Object.keys(groupedMatches).sort((a, b) =>
        tab === 'agenda'
            ? new Date(a).getTime() - new Date(b).getTime()
            : new Date(b).getTime() - new Date(a).getTime()
    )

    const genero = detectGender(teamName, teamInfo.escalao || teamGames[0]?.escalao || '')
    const escalao = teamInfo.escalao || teamGames[0]?.escalao || ''
    const generoLabel = genero === 'M' ? 'Masculino' : genero === 'F' ? 'Feminino' : 'Indefinido'
    const generoClass = genero === 'M'
        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
        : genero === 'F'
            ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400'
            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'

    return (
        <div className="max-w-6xl mx-auto space-y-4 pb-24">
            <div className="flex items-center justify-between pt-3 px-3">
                <Link to={`/clube/${club.slug}/team`} className="p-2 -ml-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
                    <ArrowLeft size={22} />
                </Link>
                <span className="text-[10px] font-bold tracking-widest uppercase text-zinc-500">EQUIPA</span>
                <div className="w-10" />
            </div>

            <div className="max-w-xl mx-auto px-3">
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
                    {equipaPhoto && (
                        <div className="relative h-48 bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                            <img src={equipaPhoto} alt="" className="absolute inset-0 w-full h-full object-cover object-center" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                        </div>
                    )}
                    <div className="p-6">
                        <h1 className="text-xl font-black text-zinc-900 dark:text-white truncate">{teamName}</h1>
                        <div className="flex items-center gap-1.5 mt-1.5">
                            {escalao && (
                                <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
                                    {escalao}
                                </span>
                            )}
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${generoClass}`}>
                                {generoLabel}
                            </span>
                        </div>
                        <p className="text-xs text-zinc-500 mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">{club.name}</p>
                    </div>

                    <div className="px-5 pb-5">
                        <div className="grid grid-cols-4 gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                            <div className="text-center">
                                <p className="text-2xl font-black text-zinc-900 dark:text-white">{total}</p>
                                <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Jogos</p>
                            </div>
                            <div className="text-center">
                                <p className="text-2xl font-black text-green-600 dark:text-green-400">{wins}</p>
                                <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Vitórias</p>
                            </div>
                            <div className="text-center">
                                <p className="text-2xl font-black text-red-500">{losses}</p>
                                <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Derrotas</p>
                            </div>
                            <div className="text-center">
                                <p className={`text-2xl font-black ${pct !== null && pct >= 50 ? 'text-green-600 dark:text-green-400' : pct !== null ? 'text-red-500' : 'text-zinc-400'}`}>
                                    {pct !== null ? pct + '%' : '—'}
                                </p>
                                <p className="text-[10px] text-zinc-500 uppercase tracking-wide">PCT</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tab bar */}
            <div className="px-3 mt-2">
                <div className="flex gap-1.5 overflow-x-auto">
                    {([
                        { value: 'geral' as Tab, label: 'Vista Geral', icon: Info },
                        { value: 'agenda' as Tab, label: 'Agenda', icon: Calendar },
                        { value: 'resultados' as Tab, label: 'Resultados', icon: Trophy },
                        { value: 'plantel' as Tab, label: 'Plantel', icon: Users },
                    ]).map(t => (
                        <button key={t.value} onClick={() => setTab(t.value)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                tab === t.value ? 'bg-dribly-purple text-white' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/5'
                            }`}>
                            <t.icon size={14} />
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Vista Geral tab */}
            {tab === 'geral' && (
                <div className="px-3 space-y-3">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5">
                        <div className="grid grid-cols-4 gap-3">
                            <div className="text-center"><p className="text-2xl font-black text-zinc-900 dark:text-white">{total}</p><p className="text-[10px] text-zinc-500">Jogos</p></div>
                            <div className="text-center"><p className="text-2xl font-black text-green-600 dark:text-green-400">{wins}</p><p className="text-[10px] text-zinc-500">Vitórias</p></div>
                            <div className="text-center"><p className="text-2xl font-black text-red-500">{losses}</p><p className="text-[10px] text-zinc-500">Derrotas</p></div>
                            <div className="text-center"><p className="text-2xl font-black text-zinc-900 dark:text-white">{pct !== null ? pct + '%' : '—'}</p><p className="text-[10px] text-zinc-500">PCT</p></div>
                        </div>
                    </div>
                    {(() => {
                        const clubHome = (g: Match) => g.equipa_casa.toUpperCase().includes(clubNameUpper)
                        const winsList = finished.filter(g => (clubHome(g) ? g.resultado_casa! > g.resultado_fora! : g.resultado_fora! > g.resultado_casa!))
                        const maxWin = winsList.length > 0 ? winsList.reduce((a, b) => {
                            const aDiff = Math.abs((clubHome(a) ? a.resultado_casa! : a.resultado_fora!) - (clubHome(a) ? a.resultado_fora! : a.resultado_casa!))
                            const bDiff = Math.abs((clubHome(b) ? b.resultado_casa! : b.resultado_fora!) - (clubHome(b) ? b.resultado_fora! : b.resultado_casa!))
                            return bDiff > aDiff ? b : a
                        }) : null
                        const chartData = finished.slice().reverse().slice(-15).map(g => ({
                            nome: g.data.slice(5),
                            pts: clubHome(g) ? g.resultado_casa! : g.resultado_fora!,
                            sof: clubHome(g) ? g.resultado_fora! : g.resultado_casa!,
                        }))
                        if (!maxWin) return null
                        return (
                            <>
                                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5">
                                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Maior vitória</h3>
                                    <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-center">
                                        <p className="text-3xl font-black text-green-700 dark:text-green-300">
                                            +{Math.abs((clubHome(maxWin) ? maxWin.resultado_casa! : maxWin.resultado_fora!) - (clubHome(maxWin) ? maxWin.resultado_fora! : maxWin.resultado_casa!))}
                                        </p>
                                        <p className="text-xs text-green-600 dark:text-green-400/70 mt-1 truncate">
                                            {maxWin.equipa_casa} {maxWin.resultado_casa} - {maxWin.resultado_fora} {maxWin.equipa_fora}
                                        </p>
                                    </div>
                                </div>
                                {chartData.length > 0 && (
                                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5">
                                        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Últimos {chartData.length} jogos</h3>
                                        <div className="h-40">
                                            {chartData.map((d, i) => (
                                                <div key={i} className="flex items-center gap-2 text-[10px] mb-1.5">
                                                    <span className="w-8 text-right text-zinc-500 shrink-0">{d.nome}</span>
                                                    <div className="flex-1 flex gap-0.5 h-5">
                                                        <div className="h-full bg-green-500 rounded-l" style={{ width: `${(d.pts / Math.max(...chartData.map(x => x.pts + x.sof), 1)) * 100}%` }} />
                                                        <div className="h-full bg-red-400 rounded-r" style={{ width: `${(d.sof / Math.max(...chartData.map(x => x.pts + x.sof), 1)) * 100}%` }} />
                                                    </div>
                                                    <span className="w-14 text-right font-mono tabular-nums text-zinc-600 dark:text-zinc-400">{d.pts}-{d.sof}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-[10px] text-zinc-400 text-center mt-2">Verde = pontos marcados | Vermelho = pontos sofridos</p>
                                    </div>
                                )}
                            </>
                        )
                    })()}
                </div>
            )}

            {/* Agenda / Resultados */}
            {(tab === 'agenda' || tab === 'resultados') && (
                <>
                    {loading && <div><SkeletonGameGrid days={2} count={3} /></div>}
                    {!loading && sortedDates.length === 0 && <EmptyState view={tab === 'agenda' ? 'agenda' : 'results'} />}
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
                                            <GameCard key={match.id || match.slug} match={match} mode={tab === 'agenda' ? 'agenda' : 'results'} clubName={club.name} clubSlug={club.slug} />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Plantel tab */}
            {tab === 'plantel' && (
                <div className="px-3">
                    {plantel.length === 0 ? (
                        <p className="text-sm text-zinc-400 text-center py-8">Plantel não disponível.</p>
                    ) : (
                        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
                            {plantel.map((p, i) => (
                                <div key={i} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3 text-center">
                                    <div className="relative w-full pb-[133%] bg-zinc-100 dark:bg-zinc-800 rounded-xl overflow-hidden mb-2">
                                        {p.foto ? (
                                            <img src={p.foto} alt="" className="absolute inset-0 w-full h-full object-cover" />
                                        ) : (
                                            <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-zinc-400">{p.nome.charAt(0).toUpperCase()}</span>
                                        )}
                                    </div>
                                    {p.atletaUrl ? (
                                        <a href={p.atletaUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-dribly-purple truncate block">
                                            {p.nome}
                                        </a>
                                    ) : (
                                        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate">{p.nome}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

export default ClubTeamDetail
