import { useEffect, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchFPBGames } from '../lib/fpbApi'
import { fetchGameDetail, type FPBGameDetail } from '../lib/fpbCompetitionsApi'
import { ArrowLeft, MapPin, Share2, Trophy, Navigation, ExternalLink, Calendar, Check, Clock, Info } from 'lucide-react'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import L from 'leaflet'
import { SkeletonHero } from '../components/Skeleton'
import { Match } from '../components/types'
import { useClub, type Club } from '../lib/ClubContext'
import { fetchPavilions, type Pavilion } from '../lib/mapData'
import { semiAbrev, normalizeTeamDisplay, clubLogoUrl } from '../lib/fpbUtils'
import { logger } from '../lib/logger'
import { TeamBlock } from '../components/TeamBlock'
import { GameDueloCard } from '../components/GameDueloCard'
import { GameLeadersCard } from '../components/GameLeadersCard'
import { SeoHead } from '../components/SeoHead'

function detailToMatch(detail: FPBGameDetail): Match {
    return {
        id: detail.internalID,
        slug: detail.internalID,
        data: detail.data,
        hora: detail.hora || '',
        equipa_casa: detail.equipa_casa,
        equipa_fora: detail.equipa_fora,
        resultado_casa: detail.resultado_casa,
        resultado_fora: detail.resultado_fora,
        escalao: detail.fase,
        competicao: detail.competicao,
        local: detail.pavilhao,
        logotipo_casa: detail.logo_casa,
        logotipo_fora: detail.logo_fora,
        status: (detail.status || 'FINALIZADO') as Match['status'],
    }
}

function Game() {
    const { slug } = useParams()
    const [searchParams] = useSearchParams()
    const clubSlug = searchParams.get('clube') || ''
    const internalID = searchParams.get('internalID') || ''
    const { getClubBySlug, clubs } = useClub()

    const [match, setMatch] = useState<Match | null>(null)
    const [club, setClub] = useState<Club | null>(null)
    const [detailLeaders, setDetailLeaders] = useState<FPBGameDetail['gameLeaders']>([])
    const [parciais, setParciais] = useState<FPBGameDetail['parciais']>([])
    const [topPerfCasa, setTopPerfCasa] = useState<{ nome: string; foto: string }>({ nome: '', foto: '' })
    const [topPerfFora, setTopPerfFora] = useState<{ nome: string; foto: string }>({ nome: '', foto: '' })
    const [topPerfStats, setTopPerfStats] = useState<{ label: string; casa: string; fora: string }[]>([])

    const [recentGames, setRecentGames] = useState<Match[]>([])
    const [upcomingH2H, setUpcomingH2H] = useState<Match[]>([])
    const [pavilion, setPavilion] = useState<Pavilion | null>(null)
    const [loading, setLoading] = useState(true)
    const [detailLoading, setDetailLoading] = useState(false)
    const [copied, setCopied] = useState(false)
    const [darkMode, setDarkMode] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'))

    useEffect(() => {
        const observer = new MutationObserver(() => {
            setDarkMode(document.documentElement.classList.contains('dark'))
        })
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
        return () => observer.disconnect()
    }, [])

    useEffect(() => {
        if (clubSlug) {
            getClubBySlug(clubSlug).then(setClub)
        }
    }, [clubSlug, getClubBySlug])

    useEffect(() => {
        if (!slug) return
        setLoading(true)

        const tryLoad = async () => {
            // 1) Try all Supabase seasons in parallel
            const tables = ['games_2025_2026', 'games_2024_2025', 'games_2023_2024', 'games_2022_2023']
            const results = await Promise.all(tables.map(table =>
                supabase.from(table).select('*').eq('slug', slug).single()
            ))
            for (const { data, error } of results) {
                if (!error && data) {
                    const m = data as Match

                    // If game is from today and scheduled time + 1h has passed,
                    // fetch FPB first to avoid flash of stale Supabase data
                    const today = new Date().toISOString().split('T')[0]
                    const isToday = m.data === today
                    const horaClean = (m.hora || '').replace(/[^0-9]/g, '')
                    const gameShouldBeOver = isToday && horaClean.length >= 4 && (() => {
                        const h = parseInt(horaClean.slice(0, 2))
                        const min = parseInt(horaClean.slice(2, 4))
                        const end = new Date(today + 'T' + String(h).padStart(2, '0') + ':' + String(min).padStart(2, '0') + ':00')
                        end.setHours(end.getHours() + 1)
                        return new Date() > end
                    })()

                    if (gameShouldBeOver && m.id) {
                        // Await FPB before showing anything — no flash
                        setDetailLoading(true)
                        try {
                            const detail = await fetchGameDetail(String(m.id))
                            if (detail) {
                                setDetailLeaders(detail.gameLeaders)
                                setParciais(detail.parciais)
                                setTopPerfCasa(detail.topPerfCasa)
                                setTopPerfFora(detail.topPerfFora)
                                setTopPerfStats(detail.topPerfStats)
                                const updated = {
                                    ...m,
                                    resultado_casa: detail.resultado_casa ?? m.resultado_casa,
                                    resultado_fora: detail.resultado_fora ?? m.resultado_fora,
                                    status: (detail.status || m.status) as Match['status'],
                                    local: (detail.pavilhao && m.local && m.local.includes('|'))
                                        ? detail.pavilhao : m.local,
                                }
                                setMatch(updated)
                                if (detail.resultado_casa !== null || detail.resultado_fora !== null) {
                                    const season = m.data ? m.data.slice(0, 4) : '2025'
                                    const nextSeason = String(parseInt(season) + 1)
                                    const tableName = `games_${season}_${nextSeason}`
                                    supabase.from(tableName).upsert({
                                        ...updated,
                                        updated_at: new Date().toISOString(),
                                    }, { onConflict: 'slug' }).then(() => {}, () => {})
                                }
                            } else {
                                setMatch(m)
                            }
                        } catch {
                            setMatch(m)
                        }
                        setDetailLoading(false)
                        setLoading(false)
                        return
                    }

                    // Game is in the future or old — show Supabase immediately, refresh FPB in background
                    setMatch(m)
                    setLoading(false)
                    if (m.id) {
                        setDetailLoading(true)
                        fetchGameDetail(String(m.id)).then(detail => {
                            if (detail) {
                                setDetailLeaders(detail.gameLeaders)
                                setParciais(detail.parciais)
                                setTopPerfCasa(detail.topPerfCasa)
                                setTopPerfFora(detail.topPerfFora)
                                setTopPerfStats(detail.topPerfStats)
                                const updated = {
                                    ...m,
                                    resultado_casa: detail.resultado_casa ?? m.resultado_casa,
                                    resultado_fora: detail.resultado_fora ?? m.resultado_fora,
                                    status: (detail.status || m.status) as Match['status'],
                                    local: (detail.pavilhao && m.local && m.local.includes('|'))
                                        ? detail.pavilhao : m.local,
                                }
                                setMatch(updated)
                                if (detail.resultado_casa !== null || detail.resultado_fora !== null) {
                                    const season = m.data ? m.data.slice(0, 4) : '2025'
                                    const nextSeason = String(parseInt(season) + 1)
                                    const tableName = `games_${season}_${nextSeason}`
                                    supabase.from(tableName).upsert({
                                        ...updated,
                                        updated_at: new Date().toISOString(),
                                    }, { onConflict: 'slug' }).then(() => {}, () => {})
                                }
                            }
                        }).catch(() => {}).finally(() => setDetailLoading(false))
                    }
                    return
                }
            }

            // If internalID provided in URL, try direct FPB game detail fetch
            if (internalID) {
                try {
                    setDetailLoading(true)
                    const detail = await fetchGameDetail(internalID)
                    if (detail) {
                        setMatch(detailToMatch(detail))
                        setDetailLeaders(detail.gameLeaders)
                        setParciais(detail.parciais)
                        setTopPerfCasa(detail.topPerfCasa)
                        setTopPerfFora(detail.topPerfFora)
                        setTopPerfStats(detail.topPerfStats)
                    }
                    setDetailLoading(false)
                } catch { /* ignore */ }
                setLoading(false)
                return
            }

            if (!clubSlug && /^\d+$/.test(slug)) {
                try {
                    setDetailLoading(true)
                    const detail = await fetchGameDetail(slug)
                    if (detail) {
                        setMatch(detailToMatch(detail))
                        setDetailLeaders(detail.gameLeaders)
                        setParciais(detail.parciais)
                        setTopPerfCasa(detail.topPerfCasa)
                        setTopPerfFora(detail.topPerfFora)
                        setTopPerfStats(detail.topPerfStats)
                    }
                    setDetailLoading(false)
                } catch { /* ignore */ }
                setLoading(false)
                return
            }

            if (!clubSlug) {
                setLoading(false)
                return
            }

            if (!club) return

            try {
                const seasons = ['2025/2026', '2024/2025', '2023/2024', '2022/2023']
                for (const season of seasons) {
                    const fpbGames = await fetchFPBGames(season, club.id)
                    const found = fpbGames.find(g => g.slug === slug)
                    if (found) {
                        setMatch(found)
                        setLoading(false)
                        return
                    }
                }
            } catch (err) {
                logger.warn('FPB fallback failed:', err)
            }

            setLoading(false)
        }

        tryLoad()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [slug, club])

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && slug) {
                supabase
                    .from('games_2025_2026')
                    .select('*')
                    .eq('slug', slug)
                    .single()
                    .then(({ data, error }) => {
                        if (!error && data) setMatch(data as Match)
                    })
            }
        }
        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
    }, [slug, club])

    useEffect(() => {
        if (!match) return
        const home = match.equipa_casa
        const away = match.equipa_fora
        const seasons = ['2025_2026', '2024_2025', '2023_2024', '2022_2023']
        Promise.all(
            seasons.map(s =>
                supabase
                    .from(`games_${s}`)
                    .select('*')
                    .eq('escalao', match.escalao)
                    .neq('slug', slug)
                    .eq('status', 'FINALIZADO')
                    .order('data', { ascending: false })
                    .then(({ data }) => (data || []) as Match[])
            )
        ).then(results => {
            const all = results.flat()
            const unique = Array.from(new Map(all.map(g => [g.slug, g])).values())
            const h2h = unique
                .filter(g =>
                    (g.equipa_casa.toUpperCase().includes(home.toUpperCase()) && g.equipa_fora.toUpperCase().includes(away.toUpperCase())) ||
                    (g.equipa_casa.toUpperCase().includes(away.toUpperCase()) && g.equipa_fora.toUpperCase().includes(home.toUpperCase()))
                )
                .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
                .slice(0, 3)
            setRecentGames(h2h)
        })
    }, [match, slug])

    useEffect(() => {
        if (!match) return
        const home = match.equipa_casa
        const away = match.equipa_fora
        supabase
            .from('games_2025_2026')
            .select('*')
            .neq('slug', slug)
            .eq('status', 'AGENDADO')
            .gte('data', new Date().toISOString().split('T')[0])
            .order('data', { ascending: true })
            .limit(10)
            .then(({ data }) => {
                if (!data) return
                const future = (data as Match[]).filter(g =>
                    (g.equipa_casa.toUpperCase().includes(home.toUpperCase()) && g.equipa_fora.toUpperCase().includes(away.toUpperCase())) ||
                    (g.equipa_casa.toUpperCase().includes(away.toUpperCase()) && g.equipa_fora.toUpperCase().includes(home.toUpperCase()))
                ).slice(0, 3)
                setUpcomingH2H(future)
            })
    }, [match, slug])

    // Look up pavilion by recinto_id (exact) or fallback to name match
    useEffect(() => {
        if (!match) return
        const lookupPavilion = async () => {
            // 1. Try recinto_id from game data (exact match)
            if (match.recinto_id) {
                const { data } = await supabase.from('pavilions').select('*').eq('recinto_id', match.recinto_id).single()
                if (data) { setPavilion(data as Pavilion); return }
            }
            // 2. Fallback: fuzzy name match (legacy)
            if (!match.local) { setPavilion(null); return }
            const clean = match.local.split('|')[0].replace(/\s+/g, ' ').trim()
            const core = clean.toLowerCase()
                .replace(/^pavilhão\s+/i, '').replace(/^pav\.?\s*/i, '')
                .replace(/^mun\.?\s*/i, '').replace(/^municipal\s+/i, '')
                .replace(/\s*,.+$/, '').trim()
            const pavs = await fetchPavilions()
            const q = core
            let bestScore = 0
            let bestPav: Pavilion | null = null
            for (const p of pavs) {
                const pn = p.nome.toLowerCase()
                    .replace(/^pavilhão\s+/i, '').replace(/^pav\.?\s*/i, '')
                    .replace(/^mun\.?\s*/i, '').replace(/^municipal\s+/i, '')
                    .replace(/\s*,.+$/, '').trim()
                let score = 0
                if (pn === q || q === pn) score = 100
                else if (pn.includes(q) || q.includes(pn)) score = 80
                else {
                    const qWords = q.split(/\s+/).filter(w => w.length > 2)
                    const pWords = pn.split(/\s+/).filter(w => w.length > 2)
                    let matches = 0
                    for (const w of qWords) {
                        if (pWords.some(pw => pw === w || pw.includes(w) || w.includes(pw))) matches++
                    }
                    if (matches >= 2) score = 40 + matches * 10
                    else if (matches === 1 && qWords.length === 1 && qWords[0].length > 4) score = 20
                }
                if (score > bestScore) { bestScore = score; bestPav = p }
            }
            setPavilion(bestScore >= 20 ? bestPav : null)
        }
        lookupPavilion().catch(() => {})
    }, [match?.local, match?.recinto_id])

    const shareGame = async () => {
        if (!match) return
        const hasScore = match.resultado_casa !== null && match.resultado_fora !== null
        const scoreText = hasScore ? `${match.resultado_casa} - ${match.resultado_fora}` : 'vs'

        const shareData = {
            title: `${match.equipa_casa} ${scoreText} ${match.equipa_fora}`,
            text: `🏀 ${match.equipa_casa} ${scoreText} ${match.equipa_fora}\n📅 ${new Date(match.data).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })}\n🏆 ${match.competicao}\n\n🔗 ${window.location.href}`,
            url: window.location.href
        }

        if (navigator.share) {
            try {
                await navigator.share(shareData)
            } catch { /* user cancelled */ }
        } else {
            await navigator.clipboard.writeText(shareData.text)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    if (loading) {
        return (
            <div className="max-w-xl mx-auto pb-24 px-3">
                <div className="flex items-center justify-between pt-3 mb-4">
                    <div className="h-10 w-10 bg-zinc-200 dark:bg-zinc-800 rounded-xl animate-pulse" />
                    <div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                    <div className="h-10 w-10 bg-zinc-200 dark:bg-zinc-800 rounded-xl animate-pulse" />
                </div>
                <SkeletonHero />
            </div>
        )
    }

    if (!match) {
        return (
            <div className="max-w-xl mx-auto px-3 py-32 text-center">
                <Trophy size={40} className="mx-auto text-zinc-300 dark:text-zinc-700 mb-4" strokeWidth={1} />
                <p className="text-sm text-zinc-500 mb-4">Jogo não encontrado</p>
                <button onClick={() => window.history.back()} className="inline-flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors group">
                    <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                    Voltar
                </button>
            </div>
        )
    }

    const isFinished = match.status === 'FINALIZADO'
    const isLive = match.status === 'A DECORRER'
    const hasScores = match.resultado_casa !== null && match.resultado_fora !== null
    const casaHighlight = hasScores && match.resultado_casa! > match.resultado_fora!
    const foraHighlight = hasScores && match.resultado_fora! > match.resultado_casa!
    const dateFormatted = new Date(match.data).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    const hasHora = match.hora && match.hora.replace(/[^0-9]/g, "").length > 0

    const clubUpper = club ? club.name.toUpperCase() : ''
    const clubSearchName = club?.search_name?.toUpperCase() || ''
    const clubShortName = club?.short_name?.toUpperCase() || ''
    const clubSemiAbrev = club ? semiAbrev(club.name).toUpperCase() : ''
    const matchClub = (teamName: string) => {
        const t = teamName.toUpperCase()
        return t.includes(clubUpper) || clubUpper.includes(t)
            || (clubSearchName && (t.includes(clubSearchName) || clubSearchName.includes(t)))
            || (clubShortName && (t.includes(clubShortName) || clubShortName.includes(t)))
            || (clubSemiAbrev && (t.includes(clubSemiAbrev) || clubSemiAbrev.includes(t)))
    }
    const isClubWin = clubUpper && hasScores ? (
        (matchClub(match.equipa_casa) && match.resultado_casa! > match.resultado_fora!) ||
        (matchClub(match.equipa_fora) && match.resultado_fora! > match.resultado_casa!)
    ) : null

    const displayCasa = normalizeTeamDisplay(match.equipa_casa, clubs)
    const displayFora = normalizeTeamDisplay(match.equipa_fora, clubs)
    const clubCasa = clubs.find(c => c.name.toUpperCase() === match.equipa_casa.trim().toUpperCase() || c.search_name?.toUpperCase() === match.equipa_casa.trim().toUpperCase())
    const clubFora = clubs.find(c => c.name.toUpperCase() === match.equipa_fora.trim().toUpperCase() || c.search_name?.toUpperCase() === match.equipa_fora.trim().toUpperCase())
    const logoCasa = clubLogoUrl(clubCasa) || match.logotipo_casa
    const logoFora = clubLogoUrl(clubFora) || match.logotipo_fora
    const dn = (name: string) => normalizeTeamDisplay(name, clubs)
    // Clean location: if it contains "|", it has competition data mixed in — strip it
    const cleanLocal = match.local
        ? match.local.split('|')[0].replace(/\s+/g, ' ').trim()
        : null
    const isDraw = hasScores && match.resultado_casa === match.resultado_fora

    return (
        <div className="max-w-xl mx-auto pb-24 px-3 space-y-3">
            <SeoHead title={match ? `${match.equipa_casa} vs ${match.equipa_fora}` : 'Jogo'} description={match ? `${match.equipa_casa} vs ${match.equipa_fora} — ${match.competicao || 'Basquetebol Português'}` : 'Ficha de jogo detalhada — Basquetebol Português.'} />
            {/* Header */}
            <div className="flex items-center justify-between pt-3 ">
                <button onClick={() => window.history.back()} className="p-2 -ml-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
                    <ArrowLeft size={22} />
                </button>
                <span className="text-[10px] font-bold tracking-widest uppercase text-zinc-500">FICHA DE JOGO</span>
                <button onClick={shareGame} className={`p-2 -mr-2 transition-colors ${copied ? 'text-green-500' : 'text-zinc-500 hover:text-dribly-blue'}`}>
                    {copied ? <Check size={18} /> : <Share2 size={18} />}
                </button>
            </div>

            {/* Hero Card */}
            <div className="glass-card overflow-hidden group hover:border-dribly-blue/30 transition-all duration-200">
                <div className="bg-gradient-to-r from-dribly-blue/10 via-zinc-50 to-dribly-blue/10 dark:from-dribly-blue/5 dark:via-zinc-900 dark:to-dribly-blue/5 border-b border-zinc-100 dark:border-white/5 p-3 flex justify-between items-center">
                    <span className="text-[10px] font-bold text-dribly-blue uppercase">{match.escalao}</span>
                    <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase truncate ml-2">{match.competicao}</span>
                </div>

                <div className="p-6 pt-8 pb-6">
                    <div className="flex justify-center mb-5 min-h-[1.5rem]">
                        {isFinished && hasScores && (
                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${
                                !clubUpper
                                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                                    : isDraw
                                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                                        : isClubWin
                                            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                                            : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                            }`}>
                                {!clubUpper ? 'FINALIZADO' : isDraw ? 'EMPATE' : isClubWin ? 'VITÓRIA' : 'DERROTA'}
                            </span>
                        )}
                        {isLive && (
                            <span className="px-3 py-1 rounded-full bg-red-500 text-white text-[10px] font-bold animate-pulse">AO VIVO</span>
                        )}
                        {match.status === 'AGENDADO' && hasHora && (
                            <span className="px-3 py-1 rounded-full bg-dribly-purple/10 text-dribly-purple text-[10px] font-bold flex items-center gap-1">
                                <Clock size={10} /> {match.hora!.slice(0, 5)}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center justify-between gap-4">
                        <TeamBlock name={displayCasa} logo={logoCasa} clubSlug={findClubSlug(match.equipa_casa, clubs)} />
                        <div className="flex flex-col items-center gap-1 shrink-0">
                            {isFinished || isLive ? (
                                <>
                                    <div className="flex items-center gap-1 sm:gap-2">
                                        <span className={`text-2xl sm:text-4xl font-bold font-mono tabular-nums tracking-tighter ${
                                            casaHighlight ? 'text-zinc-900 dark:text-white' : 'text-zinc-400 dark:text-zinc-500'
                                        }`}>{match.resultado_casa ?? '-'}</span>
                                        <span className="text-base sm:text-2xl font-light text-zinc-400">:</span>
                                        <span className={`text-2xl sm:text-4xl font-bold font-mono tabular-nums tracking-tighter ${
                                            foraHighlight ? 'text-zinc-900 dark:text-white' : 'text-zinc-400 dark:text-zinc-500'
                                        }`}>{match.resultado_fora ?? '-'}</span>
                                    </div>
                                    {/* Period scores — two compact lines, home above away. Winner of each period highlighted. */}
                                    {parciais.length > 0 && (
                                        <div className="flex flex-col items-center gap-0 mt-0.5">
                                            <div className="flex gap-1.5 text-[11px] font-mono tabular-nums">
                                                {parciais.map((p, i) => {
                                                    const casaWon = p.casa > p.fora
                                                    return (
                                                        <span key={i} className={`min-w-[2ch] text-center ${casaWon ? 'font-bold text-zinc-900 dark:text-white' : 'text-zinc-400 dark:text-zinc-500'}`}>{p.casa}</span>
                                                    )
                                                })}
                                            </div>
                                            <div className="flex gap-1.5 text-[11px] font-mono tabular-nums">
                                                {parciais.map((p, i) => {
                                                    const foraWon = p.fora > p.casa
                                                    return (
                                                        <span key={i} className={`min-w-[2ch] text-center ${foraWon ? 'font-bold text-zinc-900 dark:text-white' : 'text-zinc-400 dark:text-zinc-500'}`}>{p.fora}</span>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                                    <span className="text-sm font-black text-zinc-400 dark:text-zinc-500">VS</span>
                                </div>
                            )}
                        </div>
                        <TeamBlock name={displayFora} logo={logoFora} clubSlug={findClubSlug(match.equipa_fora, clubs)} />
                    </div>

                    {/* Detail loading indicator */}
                    {detailLoading && (
                        <div className="mt-4 flex justify-center">
                            <span className="text-[10px] text-zinc-400 animate-pulse">A carregar detalhes...</span>
                        </div>
                    )}

                    {/* FPB Link */}
                    <div className="mt-4 flex justify-center">
                        {match.id && (
                            <a href={`https://www.fpb.pt/ficha-de-jogo?internalID=${match.id}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 hover:text-dribly-blue transition-colors">
                                <ExternalLink size={10} />
                                Ver jogo na FPB
                            </a>
                        )}
                    </div>
                </div>
            </div>

            {/* Location Card — full-width, map on top, info below */}
            {cleanLocal ? (
                <div className="glass-card overflow-hidden">
                    {/* Mini map — full card width */}
                    {pavilion && pavilion.lat && pavilion.lng ? (
                        <Link to={`/pavilhao/${pavilion.recinto_id || pavilion.id}`} className="block h-40 w-full relative cursor-pointer group">
                            <MapContainer
                                center={[pavilion.lat, pavilion.lng]}
                                zoom={15}
                                zoomControl={false}
                                dragging={false}
                                scrollWheelZoom={false}
                                doubleClickZoom={false}
                                touchZoom={false}
                                attributionControl={false}
                                className="w-full h-full pointer-events-none"
                            >
                                <TileLayer url={darkMode ? 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png' : 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png'} />
                                <Marker position={[pavilion.lat, pavilion.lng]}
                                    icon={L.divIcon({
                                        html: `<div style="width:16px;height:16px;background:#7C3AED;border:2px solid white;border-radius:50%;box-shadow:0 0 6px rgba(124,58,237,0.8)"></div>`,
                                        className: '', iconSize: [16, 16], iconAnchor: [8, 8]
                                    })}
                                />
                            </MapContainer>
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                <span className="opacity-90 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm text-xs font-bold text-dribly-purple px-3 py-1.5 rounded-full shadow-sm">Ver pavilhão →</span>
                            </div>
                        </Link>
                    ) : cleanLocal ? (
                        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cleanLocal)}`}
                           target="_blank" rel="noopener noreferrer"
                           className="block h-40 w-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors group">
                            <div className="text-center">
                                <MapPin size={28} className="mx-auto text-dribly-purple mb-1" />
                                <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-300">Ver no Google Maps</span>
                            </div>
                        </a>
                    ) : null}
                    {/* Info row */}
                    <div className="p-3 flex items-center gap-3">
                        <div className="p-2 rounded-full bg-zinc-100 dark:bg-white/5 text-dribly-blue shrink-0">
                            <MapPin size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">{cleanLocal}</p>
                            {pavilion && <p className="text-[10px] text-zinc-400 truncate">{pavilion.cidade}{pavilion.distrito ? `, ${pavilion.distrito}` : ''}</p>}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                            <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(cleanLocal)}`}
                               target="_blank" rel="noopener noreferrer"
                               className="p-1.5 rounded-lg bg-zinc-100 dark:bg-white/5 text-dribly-blue hover:bg-dribly-blue hover:text-white transition-colors"
                               title="Google Maps">
                                <Navigation size={14} />
                            </a>
                            {pavilion && (
                                <Link to={`/pavilhao/${pavilion.recinto_id || pavilion.id}`}
                                    className="p-1.5 rounded-lg bg-dribly-purple/10 text-dribly-purple hover:bg-dribly-purple hover:text-white transition-colors"
                                    title="Página do pavilhão">
                                    <Info size={14} />
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="glass-card p-5 flex items-start gap-4">
                    <div className="p-3 rounded-full bg-zinc-100 dark:bg-white/5 text-dribly-blue shrink-0">
                        <MapPin size={20} />
                    </div>
                    <div>
                        <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide mb-1">Localização</h4>
                        <p className="text-sm text-zinc-500 italic">A definir</p>
                    </div>
                </div>
            )}

            {/* Date Card */}
            <div className="glass-card p-5 flex items-start gap-4 ">
                <div className="p-3 rounded-full bg-zinc-100 dark:bg-white/5 text-dribly-blue shrink-0">
                    <Calendar size={20} />
                </div>
                <div>
                    <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide mb-1">Data</h4>
                    <p className="text-sm font-medium text-zinc-900 dark:text-white capitalize">{dateFormatted}</p>
                </div>
            </div>

            <GameDueloCard topPerfCasa={topPerfCasa} topPerfFora={topPerfFora} topPerfStats={topPerfStats} />

            <GameLeadersCard detailLeaders={detailLeaders} />

            {/* H2H History */}
            {recentGames.length > 0 && (
                <div className="glass-card overflow-hidden ">
                    <div className="p-3.5 border-b border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-white/[0.02]">
                        <h3 className="text-xs font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-dribly-blue" />
                            Últimos Confrontos
                        </h3>
                    </div>
                    <div className="divide-y divide-zinc-100 dark:divide-white/5">
                        {recentGames.map((game) => {
                            const isHome = game.equipa_casa.toUpperCase().includes(match.equipa_casa.toUpperCase().substring(0, 5))
                            const firstTeam = isHome ? dn(game.equipa_casa) : dn(game.equipa_fora)
                            const secondTeam = isHome ? dn(game.equipa_fora) : dn(game.equipa_casa)
                            const firstScore = isHome ? game.resultado_casa : game.resultado_fora
                            const secondScore = isHome ? game.resultado_fora : game.resultado_casa
                            const shortDate = new Date(game.data).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' })
                            const homeLogo = game.logotipo_casa
                            const awayLogo = game.logotipo_fora
                            const firstLogo = isHome ? homeLogo : awayLogo
                            const secondLogo = isHome ? awayLogo : homeLogo

                            return (
                                <Link to={`/jogo/${game.slug}${clubSlug ? `?clube=${clubSlug}` : ''}`} key={game.slug} className="flex items-center gap-2 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group">
                                    <div className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 overflow-hidden border border-zinc-200 dark:border-zinc-700/50">
                                        {firstLogo ? (
                                            <img src={firstLogo} alt="" className="w-5 h-5 object-contain" loading="lazy" decoding="async" />
                                        ) : (
                                            <span className="text-[9px] font-bold text-zinc-500">{firstTeam.charAt(0)}</span>
                                        )}
                                    </div>
                                    <span className="text-[12px] font-semibold text-zinc-900 dark:text-white group-hover:text-dribly-blue transition-colors shrink-0">{firstTeam}</span>
                                    <span className="text-zinc-400 font-medium text-xs tabular-nums shrink-0">{firstScore}-{secondScore}</span>
                                    <span className="text-[12px] text-zinc-500 dark:text-zinc-400 shrink-0">{secondTeam}</span>
                                    <div className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 overflow-hidden border border-zinc-200 dark:border-zinc-700/50">
                                        {secondLogo ? (
                                            <img src={secondLogo} alt="" className="w-5 h-5 object-contain" loading="lazy" decoding="async" />
                                        ) : (
                                            <span className="text-[9px] font-bold text-zinc-500">{secondTeam.charAt(0)}</span>
                                        )}
                                    </div>
                                    <span className="flex-1" />
                                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase shrink-0 font-medium ml-auto">{shortDate}</span>
                                </Link>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Próximos Confrontos */}
            {upcomingH2H.length > 0 && (
                <div className="glass-card overflow-hidden ">
                    <div className="p-3.5 border-b border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-white/[0.02]">
                        <h3 className="text-xs font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-dribly-blue" />
                            Próximos Confrontos
                        </h3>
                    </div>
                    <div className="divide-y divide-zinc-100 dark:divide-white/5">
                        {upcomingH2H.map((game) => {
                            const isHome = game.equipa_casa.toUpperCase().includes(match.equipa_casa.toUpperCase().substring(0, 5))
                            const opponent = isHome ? dn(game.equipa_fora) : dn(game.equipa_casa)
                            const clubLogo = isHome ? game.logotipo_casa : game.logotipo_fora
                            const oppLogo = isHome ? game.logotipo_fora : game.logotipo_casa
                            const shortDate = new Date(game.data).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' })

                            return (
                                <Link to={`/jogo/${game.slug}${clubSlug ? `?clube=${clubSlug}` : ''}`} key={game.slug} className="flex items-center gap-2 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group">
                                    <div className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 overflow-hidden border border-zinc-200 dark:border-zinc-700/50">
                                        {clubLogo ? (
                                            <img src={clubLogo} alt="" className="w-5 h-5 object-contain" loading="lazy" decoding="async" />
                                        ) : (
                                            <span className="text-[9px] font-bold text-zinc-500">{displayCasa.charAt(0)}</span>
                                        )}
                                    </div>
                                    <span className="text-[12px] font-semibold text-zinc-900 dark:text-white group-hover:text-dribly-blue transition-colors shrink-0">{displayCasa}</span>
                                    <span className="text-zinc-400 font-medium text-[10px]">vs</span>
                                    <span className="text-[12px] text-zinc-500 dark:text-zinc-400 shrink-0">{opponent}</span>
                                    <div className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 overflow-hidden border border-zinc-200 dark:border-zinc-700/50">
                                        {oppLogo ? (
                                            <img src={oppLogo} alt="" className="w-5 h-5 object-contain" loading="lazy" decoding="async" />
                                        ) : (
                                            <span className="text-[9px] font-bold text-zinc-500">{opponent.charAt(0)}</span>
                                        )}
                                    </div>
                                    <span className="flex-1" />
                                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase shrink-0">{shortDate}</span>
                                </Link>
                            )
                        })}
                    </div>
                </div>
            )}

        </div>
    )
}

function findClubSlug(name: string, clubs: Club[]): string | null {
    if (!name) return null
    const n = name.toUpperCase().trim()
    // Try exact match first, then semi-abbreviated, then substring both ways
    for (const c of clubs) {
        const cn = c.name.toUpperCase()
        const sn = (c.search_name || '').toUpperCase()
        const sa = semiAbrev(c.name).toUpperCase()
        if (n === cn || n === sn || n === sa) return c.slug
    }
    for (const c of clubs) {
        const cn = c.name.toUpperCase()
        const sn = (c.search_name || '').toUpperCase()
        const sa = semiAbrev(c.name).toUpperCase()
        if (cn.includes(n) || n.includes(cn) || sn.includes(n) || n.includes(sn) || sa.includes(n) || n.includes(sa)) return c.slug
    }
    return null
}

export default Game
