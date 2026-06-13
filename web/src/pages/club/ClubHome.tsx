import { useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { Calendar, Trophy, ChevronRight, Clock, MapPin, RefreshCw, AlertCircle, Heart, ExternalLink, TrendingUp } from 'lucide-react'
import { useGames } from '../../hooks/useGames'
import { useFollows } from '../../hooks/useFollows'
import { useAuth } from '../../lib/AuthContext'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { SeoHead } from '../../components/SeoHead'
import { type Club, displayName, useClub } from '../../lib/ClubContext'
import { normalizeTeamDisplay } from '../../lib/fpbUtils'

function ClubHome() {
    const { club } = useOutletContext<{ club: Club }>()
    const { clubs } = useClub()
    const dn = (name: string) => normalizeTeamDisplay(name, clubs)
    const { user } = useAuth()

    const { isFollowing, toggleFollow } = useFollows()
    const { games: allGames, loading, error, refresh } = useGames('2025/2026', club.id, club.name)
    const games = useMemo(() => allGames || [], [allGames])

    const nextGame = useMemo(() => {
        if (games.length === 0) return null
        const today = new Date().toISOString().split('T')[0]
        const upcoming = games
            .filter(g => g.status !== 'FINALIZADO' && g.data >= today)
            .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())
        return upcoming.length > 0 ? upcoming[0] : null
    }, [games])

    const upcomingGames = useMemo(() => {
        if (games.length === 0 || !nextGame) return []
        return games
            .filter(g => g.status !== 'FINALIZADO')
            .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())
            .slice(1, 4)
    }, [games, nextGame])

    const recentResults = useMemo(() => {
        if (games.length === 0) return []
        return games
            .filter(g => g.status === 'FINALIZADO')
            .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
            .slice(0, 3)
    }, [games])

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr)
        const formatted = date.toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'long' })
        return formatted.charAt(0).toUpperCase() + formatted.slice(1)
    }

    const followed = user ? isFollowing('club', club.id) : false
    const [followLoading, setFollowLoading] = useState(false)
    const [needsLogin, setNeedsLogin] = useState(false)


    const handleFollow = async () => {
        if (!user) { setNeedsLogin(true); setTimeout(() => setNeedsLogin(false), 2500); return }
        setFollowLoading(true)
        try {
            await toggleFollow('club', club.id)
        } catch {
            // Silently handle — follow state already managed by useFollows
        }
        setFollowLoading(false)
    }

    if (loading) {
        return <LoadingSpinner message="A atualizar dados..." />
    }

    if (error && games.length === 0) {
        return (
            <div className="max-w-xl mx-auto space-y-5 pb-20 px-3">
                <div className="glass-card p-6 text-center">
                    <AlertCircle size={32} className="mx-auto text-amber-500 mb-3" />
                    <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-4">{error}</p>
                    <button onClick={() => refresh()}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--club-color)] text-white text-sm font-bold hover:opacity-90 transition-opacity">
                        <RefreshCw size={14} />
                        Tentar novamente
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-xl mx-auto space-y-5 pb-20 px-3">
            <SeoHead title={displayName(club)} description={`Jogos, resultados e informações do ${displayName(club)} — Basquetebol Português.`} />
            {/* Club header bar with actions */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden shrink-0">
                    {club.logo_url ? (
                        <img src={club.logo_url} alt="" className="w-7 h-7 object-contain" decoding="async" />
                    ) : (
                        <span className="text-sm font-bold text-zinc-500">{displayName(club).charAt(0)}</span>
                    )}
                </div>
                <h1 className="text-lg font-bold text-zinc-900 dark:text-white truncate flex-1">
                    {displayName(club)}
                    {club.elo_rating != null && (
                        <Link to={`/ranking?destaque=${club.slug}`} className="ml-2 text-xs font-bold text-white bg-[var(--club-color)] px-1.5 py-0.5 rounded-md hover:opacity-80 transition-opacity inline-flex items-center gap-1"
                            title="Rating de força — baseado nos resultados históricos">
                            <TrendingUp size={11} />
                            {club.elo_rating}
                        </Link>
                    )}
                </h1>
                <div className="flex items-center gap-1">
                    <a href={`https://www.fpb.pt/equipas/clube_${club.id}/`} target="_blank" rel="noopener noreferrer"
                        className="p-2 rounded-full text-zinc-400 hover:text-dribly-purple hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
                        title="Ver na FPB">
                        <ExternalLink size={16} />
                    </a>
                    <button onClick={handleFollow} data-tour="follow"
                        className={`p-2 rounded-full transition-all active:scale-[0.9] ${
                            followLoading ? 'opacity-50' : ''
                        } ${
                            followed ? 'text-dribly-purple bg-dribly-purple/10' : 'text-zinc-400 hover:text-dribly-purple hover:bg-zinc-100 dark:hover:bg-white/5'
                        }`}
                        title={followed ? 'Deixar de seguir' : 'Seguir clube'}
                        disabled={followLoading}>
                        <Heart size={18} strokeWidth={followed ? 2.5 : 2} fill={followed ? 'currentColor' : 'none'} />
                    </button>
                </div>
            </div>
            {needsLogin && (
                <div className="text-center text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-xl py-2 px-3 ">
                    Inicia sessão para favoritar e seguir clubes.
                </div>
            )}

            {games.length === 0 && !loading && !error && (
                <div className="glass-card p-6 text-center ">
                    <Calendar size={32} className="mx-auto text-zinc-300 dark:text-zinc-600 mb-3" />
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">Este clube não tem jogos registados na FPB para esta época.</p>
                </div>
            )}
            {/* Hero: Next Game or Last Result */}
            {(() => {
                const heroGame = nextGame || recentResults[0]
                if (!heroGame) return null
                const isResult = !nextGame && !!recentResults[0]
                return (
                <Link to={`/jogo/${heroGame.slug || ''}?clube=${club.slug}`} className="block group ">
                    <div className="glass-card overflow-hidden group-hover:border-[var(--club-color)]/30 transition-all duration-200">
                        <div className="bg-gradient-to-r from-[var(--club-color)]/10 via-zinc-50 to-[var(--club-color)]/10 dark:from-[var(--club-color)]/5 dark:via-zinc-900 dark:to-[var(--club-color)]/5 border-b border-zinc-100 dark:border-white/5 p-3 flex justify-between items-center">
                            <span className="text-[10px] font-bold text-[var(--club-color)] dark:text-white/80 uppercase tracking-wide">
                                {isResult ? 'Último Resultado' : (heroGame.escalao || 'Sénior Masculino')}
                            </span>
                            <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase truncate ml-2">{heroGame.competicao || ''}</span>
                        </div>
                        <div className="px-6 py-8">
                            <div className="flex items-center justify-between gap-4">
                                <TeamBlock name={dn(heroGame.equipa_casa)} logo={heroGame.logotipo_casa} />
                                <div className="flex flex-col items-center gap-1 shrink-0">
                                    {isResult ? (
                                        <div className="flex items-center gap-1 sm:gap-2">
                                            <span className="text-2xl sm:text-3xl font-bold font-mono tabular-nums tracking-tighter text-zinc-900 dark:text-white">{heroGame.resultado_casa}</span>
                                            <span className="text-base sm:text-xl font-light text-zinc-400">:</span>
                                            <span className="text-2xl sm:text-3xl font-bold font-mono tabular-nums tracking-tighter text-zinc-900 dark:text-white">{heroGame.resultado_fora}</span>
                                        </div>
                                    ) : (
                                        <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                                            <span className="text-sm font-black text-zinc-400 dark:text-zinc-500">VS</span>
                                        </div>
                                    )}
                                </div>
                                <TeamBlock name={dn(heroGame.equipa_fora)} logo={heroGame.logotipo_fora} />
                            </div>
                            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                                <div className="h-px w-8 bg-zinc-200 dark:bg-white/10" />
                                <span className="capitalize font-medium">{formatDate(heroGame.data)} · {isResult ? 'Finalizado' : (heroGame.hora || '00:00').slice(0, 5)}</span>
                                <div className="h-px w-8 bg-zinc-200 dark:bg-white/10" />
                            </div>
                            {heroGame.local && (
                                <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400">
                                    <MapPin size={10} className="text-[var(--club-color)]" />
                                    <span className="truncate max-w-[220px]">{heroGame.local}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </Link>
                );
            })()}

            {/* Quick Links */}
            <div className="grid grid-cols-2 gap-3">
                <Link to={`/clube/${club.slug}/games?view=agenda`} className="relative overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-900 p-5 h-32 group shadow-sm transition-all active:scale-[0.98] hover:border-[var(--club-color)]/20">
                    <Calendar size={56} className="absolute top-0 right-0 text-zinc-200 dark:text-zinc-800 transform rotate-12 translate-x-4 -translate-y-2 group-hover:scale-110 transition-transform" />
                    <div className="relative z-10 h-full flex flex-col justify-between">
                        <div className="w-10 h-10 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
                            <Calendar size={20} />
                        </div>
                        <h3 className="text-zinc-900 dark:text-white font-bold text-lg leading-tight">Resultados<br />&amp; Agenda</h3>
                    </div>
                </Link>
                <Link to={`/clube/${club.slug}/team`} className="relative overflow-hidden rounded-2xl bg-[var(--club-color)] border border-[var(--club-color)] p-5 h-32 group shadow-sm shadow-[var(--club-color)]/10 transition-all active:scale-[0.98] hover:shadow-md">
                    {/* Real trophy SVG as background decoration */}
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"
                        className="absolute top-0 right-0 text-white/15 transform -rotate-12 translate-x-1 -translate-y-2 group-hover:scale-110 transition-transform">
                        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" strokeLinecap="round"/>
                        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" strokeLinecap="round"/>
                        <path d="M4 22h16" strokeLinecap="round"/>
                        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" strokeLinecap="round"/>
                        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" strokeLinecap="round"/>
                        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
                        <path d="M12 2v7" strokeLinecap="round"/>
                        <path d="M9 2v2M15 2v2" strokeLinecap="round"/>
                    </svg>
                    <div className="relative z-10 h-full flex flex-col justify-between">
                        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white">
                            <Trophy size={20} />
                        </div>
                        <h3 className="text-white font-bold text-lg leading-tight">Equipas<br />&amp; Escalões</h3>
                    </div>
                </Link>
            </div>

            {/* Recent Results */}
            {recentResults.length > 0 && (
                <div className="space-y-3 ">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Últimos Resultados</h3>
                        <Link to={`/clube/${club.slug}/games?view=results`} className="text-xs text-[var(--club-color)] dark:text-zinc-300 font-bold hover:underline">Ver todos</Link>
                    </div>
                    <div className="space-y-2">
                        {recentResults.map(match => {
                            const slug = match.slug || ''
                            return (
                                <Link to={`/jogo/${slug}?clube=${club.slug}`} key={slug} className="flex items-center gap-3 p-3 glass-card hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group">
                                    <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-zinc-300 dark:bg-zinc-600" />
                                    <div className="flex-1 min-w-0">
                                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate block leading-tight">{match.escalao || 'Sénior Masculino'}</span>
                                        <p className="text-xs text-zinc-900 dark:text-white truncate">
                                            <span>{dn(match.equipa_casa)}</span>
                                            <span className="text-zinc-400 mx-1">vs</span>
                                            <span>{dn(match.equipa_fora)}</span>
                                        </p>
                                    </div>
                                    <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300 tabular-nums">
                                        {match.resultado_casa}-{match.resultado_fora}
                                    </span>
                                    <ChevronRight size={12} className="text-zinc-400 group-hover:text-[var(--club-color)] shrink-0" />
                                </Link>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Upcoming Games */}
            {upcomingGames.length > 0 && (
                <div className="space-y-3 ">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Próximos Jogos</h3>
                        <Link to={`/clube/${club.slug}/games?view=agenda`} className="text-xs text-[var(--club-color)] dark:text-zinc-300 font-bold hover:underline">Ver agenda</Link>
                    </div>
                    <div className="space-y-2">
                        {upcomingGames.map(match => {
                            const slug = match.slug || ''
                            return (
                                <Link to={`/jogo/${slug}?clube=${club.slug}`} key={slug} className="flex items-center gap-3 p-3 glass-card hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group">
                                    <Clock size={12} className="text-[var(--club-color)] shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate block leading-tight">{match.escalao || 'Sénior Masculino'}</span>
                                        <p className="text-xs text-zinc-900 dark:text-white truncate">
                                            <span>{dn(match.equipa_casa)}</span>
                                            <span className="text-zinc-400 mx-1">vs</span>
                                            <span>{dn(match.equipa_fora)}</span>
                                        </p>
                                    </div>
                                    <span className="text-xs text-zinc-500">{formatDate(match.data)}</span>
                                    <ChevronRight size={12} className="text-zinc-400 group-hover:text-[var(--club-color)] shrink-0" />
                                </Link>
                            )
                        })}
                    </div>
                </div>
            )}

        </div>
    )
}

function TeamBlock({ name, logo }: { name: string; logo: string | null }) {
    return (
        <div className="flex-1 flex flex-col items-center text-center gap-2 min-w-0">
            <div className="w-20 h-20 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden shrink-0">
                {logo ? (
                    <img src={logo} alt="" className="w-14 h-14 object-contain" loading="lazy" decoding="async" />
                ) : (
                    <span className="text-2xl font-bold text-zinc-500">{name.charAt(0)}</span>
                )}
            </div>
            <p className="text-sm font-bold text-zinc-900 dark:text-white leading-tight truncate w-full">
                {name}
            </p>
        </div>
    )
}

export default ClubHome