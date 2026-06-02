import { useMemo } from 'react'
import { Link, useParams, useOutletContext } from 'react-router-dom'
import { ArrowLeft, Clock, Users } from 'lucide-react'
import { useGames } from '../../hooks/useGames'
import { SkeletonGameGrid } from '../../components/Skeleton'
import { type Club, displayName } from '../../lib/ClubContext'

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
    const formatted = date.toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' })
    return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

function ClubTeamDetail() {
    const { club } = useOutletContext<{ club: Club }>()
    const { escalao } = useParams<{ escalao: string }>()
    const decoded = decodeURIComponent(escalao || '')
    const { games: allGames, loading } = useGames('2025/2026', club.id, club.name)
    const games = allGames || []
    const clubNameUpper = club.name.toUpperCase()

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

    const form = useMemo(() => {
        const results: ('W' | 'L' | 'D')[] = []
        finished.slice(0, 5).forEach(g => {
            if (g.resultado_casa === null || g.resultado_fora === null) return
            if (g.resultado_casa === g.resultado_fora) { results.push('D'); return }
            const clubHome = g.equipa_casa.toUpperCase().includes(clubNameUpper)
            if (clubHome) {
                results.push(g.resultado_casa > g.resultado_fora ? 'W' : 'L')
            } else {
                results.push(g.resultado_fora > g.resultado_casa ? 'W' : 'L')
            }
        })
        return results
    }, [finished, clubNameUpper])

    let wins = 0, losses = 0, draws = 0
    finished.forEach(g => {
        const clubHome = g.equipa_casa.toUpperCase().includes(clubNameUpper)
        if (g.resultado_casa === null || g.resultado_fora === null) return
        if (g.resultado_casa === g.resultado_fora) { draws++; return }
        if (clubHome ? g.resultado_casa > g.resultado_fora : g.resultado_fora > g.resultado_casa) wins++
        else losses++
    })
    const total = wins + losses + draws

    if (loading) {
        return (
            <div className="px-3 pt-4">
                <SkeletonGameGrid days={2} count={3} />
            </div>
        )
    }

    return (
        <div className="pb-20 space-y-6">
            <div className="flex items-center justify-between pt-3 px-3">
                <Link to={`/clube/${club.slug}/team`} className="p-2 -ml-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
                    <ArrowLeft size={22} />
                </Link>
                <span className="text-[10px] font-bold tracking-widest uppercase text-zinc-500">EQUIPA</span>
                <div className="w-10" />
            </div>

            {/* Header Card */}
            <div className="max-w-xl mx-auto px-3">
                <div className="glass-card p-5 ">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-[var(--club-color)]/10 dark:bg-[var(--club-color)]/20 flex items-center justify-center shrink-0">
                            <span className="text-xl font-black text-[var(--club-color)]">{decoded.charAt(0).toUpperCase()}</span>
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-lg font-bold text-zinc-900 dark:text-white truncate">{decoded}</h1>
                            <p className="text-xs text-zinc-500">{displayName(club)}</p>
                        </div>
                    </div>

                    {total > 0 && (
                        <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-zinc-100 dark:border-white/5">
                            <div className="text-center">
                                <span className="text-2xl font-bold text-zinc-900 dark:text-white">{total}</span>
                                <p className="text-[10px] text-zinc-500 uppercase">Jogos</p>
                            </div>
                            <div className="text-center">
                                <span className="text-2xl font-bold text-green-600 dark:text-green-400">{wins}</span>
                                <p className="text-[10px] text-zinc-500 uppercase">Vitórias</p>
                            </div>
                            <div className="text-center">
                                <span className="text-2xl font-bold text-red-500">{losses}</span>
                                <p className="text-[10px] text-zinc-500 uppercase">Derrotas</p>
                            </div>
                        </div>
                    )}

                    {form.length > 0 && (
                        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-zinc-100 dark:border-white/5">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase">Forma:</span>
                            <div className="flex gap-1">
                                {form.map((r, i) => (
                                    <span key={i} className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                        r === 'W' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' :
                                        r === 'L' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' :
                                        'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                    }`}>{r}</span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Upcoming Games — Horizontal carousel */}
            {upcoming.length > 0 && (
                <div className="">
                    <div className="flex items-center justify-between px-4 mb-3">
                        <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--club-color)] animate-pulse" />
                            Próximos Jogos
                        </h3>
                    </div>
                    <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-none">
                        {upcoming.map(match => {
                            const isClubHome = match.equipa_casa.toUpperCase().includes(clubNameUpper)
                            const slug = match.slug || ''
                            return (
                                <Link
                                    key={match.id || match.slug}
                                    to={`/game/${slug}?clube=${club.slug}`}
                                    className="min-w-[240px] glass-card p-4 flex flex-col gap-3 shrink-0 hover:border-[var(--club-color)]/30 group"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-[var(--club-color)] uppercase tracking-wide truncate max-w-[140px]">{match.competicao}</span>
                                        {match.hora && match.hora.replace(/[^0-9]/g, '').length > 0 && (
                                            <span className="text-[10px] font-bold text-zinc-500 flex items-center gap-1 shrink-0">
                                                <Clock size={10} />
                                                {match.hora.slice(0, 5)}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 flex items-center gap-2 min-w-0 justify-end">
                                            <p className="text-xs font-bold text-zinc-900 dark:text-white leading-tight line-clamp-1 text-right">
                                                {isClubHome ? (
                                                    <span className="text-[var(--club-color)] font-bold">{club.name.toUpperCase()}</span>
                                                ) : (
                                                    match.equipa_casa
                                                )}
                                            </p>
                                            {isClubHome ? null : (
                                                match.logotipo_casa ? (
                                                    <img src={match.logotipo_casa} alt="" className="w-7 h-7 object-contain rounded-full bg-zinc-50 dark:bg-zinc-800 shrink-0" />
                                                ) : (
                                                    <div className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-white/10 flex items-center justify-center shrink-0">
                                                        <span className="text-[9px] font-bold text-zinc-500">{match.equipa_casa?.charAt(0) || '?'}</span>
                                                    </div>
                                                )
                                            )}
                                        </div>
                                        <span className="text-[10px] font-black text-zinc-400 shrink-0">VS</span>
                                        <div className="flex-1 flex items-center gap-2 min-w-0">
                                            {!isClubHome ? null : (
                                                match.logotipo_casa ? (
                                                    <img src={match.logotipo_casa} alt="" className="w-7 h-7 object-contain rounded-full bg-zinc-50 dark:bg-zinc-800 shrink-0" />
                                                ) : (
                                                    <div className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-white/10 flex items-center justify-center shrink-0">
                                                        <span className="text-[9px] font-bold text-zinc-500">{match.equipa_casa?.charAt(0) || '?'}</span>
                                                    </div>
                                                )
                                            )}
                                            <p className="text-xs font-bold text-zinc-900 dark:text-white leading-tight line-clamp-1">
                                                {!isClubHome ? (
                                                    <span className="text-[var(--club-color)] font-bold">{club.name.toUpperCase()}</span>
                                                ) : (
                                                    match.equipa_fora
                                                )}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-center gap-2 text-[10px] text-zinc-500">
                                        <span className="capitalize">{formatDate(match.data)}</span>
                                        {match.local && <><span className="text-zinc-300">·</span><span className="text-zinc-400 truncate max-w-[80px]">{match.local}</span></>}
                                    </div>
                                </Link>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Finished Games — Horizontal carousel */}
            {finished.length > 0 && (
                <div className="">
                    <div className="flex items-center justify-between px-4 mb-3">
                        <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--club-color)]" />
                            Últimos Resultados
                        </h3>
                    </div>
                    <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-none">
                        {finished.map(match => {
                            const isClubHome = match.equipa_casa.toUpperCase().includes(clubNameUpper)
                            const clubScore = isClubHome ? match.resultado_casa : match.resultado_fora
                            const oppScore = isClubHome ? match.resultado_fora : match.resultado_casa
                            const won = clubScore !== null && oppScore !== null && clubScore > oppScore
                            const draw = clubScore !== null && oppScore !== null && clubScore === oppScore
                            const slug = match.slug || ''
                            return (
                                <Link
                                    key={match.id || match.slug}
                                    to={`/game/${slug}?clube=${club.slug}`}
                                    className="min-w-[240px] glass-card p-4 flex flex-col gap-3 shrink-0 hover:border-[var(--club-color)]/30 group"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-[var(--club-color)] uppercase tracking-wide truncate max-w-[120px]">{match.competicao}</span>
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                            draw ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' :
                                            won ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400' :
                                            'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                                        }`}>
                                            {draw ? 'E' : won ? 'V' : 'D'}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 text-right min-w-0">
                                            <p className="text-xs font-bold text-zinc-900 dark:text-white leading-tight line-clamp-1">
                                                {isClubHome ? (
                                                    <span className="text-[var(--club-color)] font-bold">{club.name.toUpperCase()}</span>
                                                ) : (
                                                    match.equipa_casa
                                                )}
                                            </p>
                                        </div>
                                        <span className="text-sm font-black text-zinc-900 dark:text-white tabular-nums shrink-0">
                                            {clubScore}-{oppScore}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-zinc-900 dark:text-white leading-tight line-clamp-1">
                                                {!isClubHome ? (
                                                    <span className="text-[var(--club-color)] font-bold">{club.name.toUpperCase()}</span>
                                                ) : (
                                                    match.equipa_fora
                                                )}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-center text-[10px] text-zinc-500 capitalize">
                                        {formatDate(match.data)}
                                    </div>
                                </Link>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Plantel placeholder */}
            <div className="px-4">
                <div className="max-w-xl mx-auto">
                    <div className="glass-card p-6 text-center">
                        <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-white/5 flex items-center justify-center mx-auto mb-3">
                            <Users size={24} className="text-zinc-400" />
                        </div>
                        <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-1">Plantel</h3>
                        <p className="text-xs text-zinc-500">A informação do plantel estará disponível em breve.</p>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ClubTeamDetail
