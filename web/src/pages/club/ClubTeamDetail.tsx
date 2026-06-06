import { useState, useEffect, useMemo } from 'react'
import { Link, useParams, useSearchParams, useOutletContext } from 'react-router-dom'
import { ArrowLeft, Calendar, CalendarDays, Trophy, Users, Info } from 'lucide-react'
import { useGames } from '../../hooks/useGames'
import { useEquipaGames } from '../../hooks/useEquipaGames'
import { LoadingSpinner } from '../../components/LoadingSpinner'
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

    const clubHome = (g: Match) => g.equipa_casa.toUpperCase().includes(clubNameUpper)
    let wins = 0, losses = 0, draws = 0
    finished.forEach(g => {
        if (g.resultado_casa === null || g.resultado_fora === null) return
        if (g.resultado_casa === g.resultado_fora) { draws++; return }
        if (clubHome(g) ? g.resultado_casa > g.resultado_fora : g.resultado_fora > g.resultado_casa) wins++
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
                <div className="px-3 space-y-5">
                    {/* Row 1 — Team card + Stat cards */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                        {/* Team card */}
                        <div className="lg:col-span-5 bg-white dark:bg-zinc-900/60 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 p-5 flex items-center gap-4">
                            <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-2xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center border border-zinc-200 dark:border-zinc-700/50 overflow-hidden">
                                {club.logo_url ? (
                                    <img src={club.logo_url} alt="" className="w-14 h-14 sm:w-[72px] sm:h-[72px] object-contain" />
                                ) : (
                                    <span className="text-2xl font-bold text-zinc-500">{club.name.charAt(0)}</span>
                                )}
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{escalao || 'Equipa'}</span>
                                </div>
                                <p className="text-sm sm:text-base font-black text-zinc-900 dark:text-white truncate leading-tight">{teamName}</p>
                                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-1 flex items-center gap-1.5 flex-wrap">
                                    <span className="tabular-nums">{total} jogos</span>
                                    <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                                    <span className="text-emerald-600 dark:text-emerald-400 tabular-nums font-bold">{wins}V</span>
                                    <span className="text-red-500 dark:text-red-400 tabular-nums font-bold">{losses}D</span>
                                </p>
                            </div>
                        </div>

                        {/* Stat cards — 2×2 */}
                        <div className="lg:col-span-7 grid grid-cols-2 gap-2.5">
                            {[
                                { label: 'Jogos', value: total, sub: `${wins}V · ${losses}D` },
                                { label: 'Vitórias', value: wins, sub: draws > 0 ? `${draws} empates` : '' },
                                { label: 'Derrotas', value: losses, sub: '' },
                                { label: '% Vitórias', value: pct !== null ? pct + '%' : '—', sub: pct !== null && pct >= 50 ? 'Positivo' : pct !== null ? 'Negativo' : '' },
                            ].map(s => (
                                <div key={s.label} className="rounded-2xl border p-3 flex flex-col justify-center bg-white dark:bg-zinc-900/60 border-zinc-200/50 dark:border-zinc-800/50">
                                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{s.label}</p>
                                    <p className="text-2xl font-black text-dribly-purple tabular-nums mt-1">{s.value}</p>
                                    {s.sub && <p className="text-[10px] text-zinc-400 mt-0.5">{s.sub}</p>}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Row 2 — Próximos Jogos + Últimos Resultados */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        {/* Próximos Jogos */}
                        <div className="bg-white dark:bg-zinc-900/60 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 p-4">
                            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <CalendarDays size={14} className="text-dribly-purple" />
                                Próximos Jogos
                            </h3>
                            {upcoming.length > 0 ? (
                                <div className="space-y-2">
                                    {upcoming.slice(0, 3).map((m, i) => (
                                        <GameCard key={i} match={m} mode="agenda" clubName={club.name} clubSlug={club.slug} />
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-zinc-400 py-4 text-center">Sem jogos agendados.</p>
                            )}
                        </div>

                        {/* Últimos Resultados */}
                        <div className="bg-white dark:bg-zinc-900/60 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 p-4">
                            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <Trophy size={14} className="text-dribly-purple" />
                                Últimos Resultados
                            </h3>
                            {finished.length > 0 ? (
                                <div className="space-y-2">
                                    {finished.slice(0, 3).map((m, i) => (
                                        <GameCard key={i} match={m} mode="results" clubName={club.name} clubSlug={club.slug} />
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-zinc-400 py-4 text-center">Sem resultados disponíveis.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Agenda / Resultados */}
            {(tab === 'agenda' || tab === 'resultados') && (
                <>
                    {loading && <LoadingSpinner />}
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
                                        <Link to={`/atleta/${(p.atletaUrl.match(/atletas\/(\d+)/) || [])[1] || ''}?clube=${club.slug}`} className="text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-dribly-purple truncate block">
                                            {p.nome}
                                        </Link>
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
