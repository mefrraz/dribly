/**
 * Home — v12
 *
 * Data source: /api/jogos-do-dia (FPB direto → sempre fresco)
 * Accordions: "Seguidos" (♥ clubs/ligas) primeiro, depois competições
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

// ── League pills ──

const FEATURED_LEAGUES = [
    { name: 'Liga Betclic', id: 10902 },
    { name: 'Proliga', id: 10903 },
    { name: '1ª Divisão', id: 10904 },
]

// ── Date helpers ──

function toYYYYMMDD(d: Date): string { return d.toISOString().split('T')[0] }
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r }

function buildDayPills() {
    const hoje = new Date()
    const dias = []
    // Show 4 days back, today, 3 days forward
    for (let i = -4; i <= 3; i++) {
        const d = addDays(hoje, i)
        let label: string
        if (i === 0) label = 'Hoje'
        else if (i === -1) label = 'Ontem'
        else if (i === 1) label = 'Amanhã'
        else label = d.toLocaleDateString('pt-PT', { weekday: 'short' }) + ' ' + d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'numeric' })
        dias.push({ label, date: d })
    }
    return dias.map(d => ({ label: d.label, date: toYYYYMMDD(d.date), isToday: d.date.toDateString() === hoje.toDateString() }))
}

function formatHora(h: string | null): string {
    if (!h) return ''
    const nums = h.replace(/[^0-9]/g, '')
    return nums.length >= 4 ? nums.slice(0, 2) + ':' + nums.slice(2, 4) : h.replace(/[^0-9:]/g, '').slice(0, 5)
}

function slugify(s: string): string { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }

function parseFPBHtml(html: string, competicao: string): Match[] {
    if (!html || html.length < 100) return []
    const games: Match[] = []
    const monthMap: Record<string, string> = { 'JAN': '01', 'FEV': '02', 'MAR': '03', 'ABR': '04', 'MAI': '05', 'JUN': '06', 'JUL': '07', 'AGO': '08', 'SET': '09', 'OUT': '10', 'NOV': '11', 'DEZ': '12' }
    const dayBlocks = html.split(/<div class="day-wrapper[^"]*">/)
    for (let i = 1; i < dayBlocks.length; i++) {
        const block = dayBlocks[i]
        const dateMatch = block.match(/<h3 class="date">\s*(\d{1,2})\s*([A-Z]{3})\s*(\d{4})\s*<\/h3>/i)
        if (!dateMatch) continue
        const dateStr = `${dateMatch[3]}-${monthMap[dateMatch[2].toUpperCase()] || '01'}-${dateMatch[1].padStart(2, '0')}`
        const gameRegex = /<a[^>]*href="\/ficha-de-jogo\/?\?internalID=(\d+)"[^>]*class="game-wrapper-a[^"]*">([\s\S]*?)<\/a>/gi
        let m
        while ((m = gameRegex.exec(block)) !== null) {
            const id = m[1], gh = m[2]
            const teams = [...gh.matchAll(/<span class="fullName[^"]*">([^<]+)<\/span>/gi)].map(t => t[1].trim())
            if (teams.length < 2) continue
            const scores = [...gh.matchAll(/<h3 class="results_text[^"]*">\s*(\d+)\s*<\/h3>/gi)].map(s => parseInt(s[1]))
            const horaMatch = gh.match(/<div class="hour[^"]*">\s*<h3>\s*(\d{1,2})[Hh](\d{2})\s*<\/h3>/i)
            const hora = horaMatch ? `${horaMatch[1].padStart(2, '0')}:${horaMatch[2]}` : ''
            const logos = [...gh.matchAll(/<img[^>]*src="([^"]*\/CLU[^"]*)"[^>]*>/gi)].map(l => l[1])
            const isFinished = scores.length >= 2
            games.push({
                id, slug: `${dateStr}-${slugify(teams[0])}-${slugify(teams[1])}`,
                data: dateStr, hora,
                equipa_casa: teams[0], equipa_fora: teams[1],
                resultado_casa: isFinished ? scores[0] : null,
                resultado_fora: isFinished ? scores[1] : null,
                competicao, escalao: '',
                status: isFinished ? 'FINALIZADO' : 'AGENDADO',
                local: null,
                logotipo_casa: logos[0] || null, logotipo_fora: logos[1] || null,
            })
        }
    }
    return games
}

// ── League ranking for featured card ──
function leagueRank(comp: string): number {
    const c = comp.toLowerCase()
    if (c.includes('betclic')) return 0
    if (c.includes('proliga')) return 1
    if (/1[ªa]|i\s*divisão/.test(c)) return 2
    if (c.includes('2ª') || c.includes('ii')) return 3
    return 99
}

// ── Confrontos row ──

function ConfrontoRow({ match, clubs, isFollowed }: { match: Match; clubs: Club[]; isFollowed: boolean }) {
    const dc = normalizeTeamDisplay(match.equipa_casa, clubs)
    const df = normalizeTeamDisplay(match.equipa_fora, clubs)
    const isLive = match.status === 'A DECORRER'
    const hasScores = match.resultado_casa !== null && match.resultado_fora !== null
    const isFinished = match.status === 'FINALIZADO' || hasScores
    const slug = match.slug || `${match.data}-${match.equipa_casa.toLowerCase().replace(/\s+/g, '-')}-${match.equipa_fora.toLowerCase().replace(/\s+/g, '-')}`
    const club = clubs.find(c => c.name === match.equipa_casa || c.name === match.equipa_fora)
    const linkTo = club ? `/jogo/${slug}?clube=${club.slug}` : `/jogo/${slug}`
    const hora = formatHora(match.hora)

    return (
        <Link to={linkTo} className={`flex items-center gap-2 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group ${isFollowed ? 'bg-dribly-purple/[0.03] dark:bg-dribly-purple/[0.05]' : ''}`}>
            {isFollowed && <span className="w-1.5 h-1.5 rounded-full bg-dribly-purple shrink-0" />}
            <div className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 overflow-hidden border border-zinc-200 dark:border-zinc-700/50">
                {match.logotipo_casa ? <img src={match.logotipo_casa} alt="" className="w-5 h-5 object-contain" loading="lazy" /> : <span className="text-[9px] font-bold text-zinc-500">{dc.charAt(0)}</span>}
            </div>
            <span className="text-[12px] font-semibold truncate shrink-0 max-w-[100px] text-zinc-900 dark:text-white group-hover:text-dribly-purple transition-colors">{dc}</span>
            {isFinished ? <span className="text-zinc-900 dark:text-white font-bold text-xs tabular-nums shrink-0">{match.resultado_casa}-{match.resultado_fora}</span>
                : <span className="text-zinc-400 font-medium text-[10px] shrink-0">vs</span>}
            <span className="text-[12px] truncate shrink-0 max-w-[100px] text-zinc-500 dark:text-zinc-400">{df}</span>
            <div className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 overflow-hidden border border-zinc-200 dark:border-zinc-700/50">
                {match.logotipo_fora ? <img src={match.logotipo_fora} alt="" className="w-5 h-5 object-contain" loading="lazy" /> : <span className="text-[9px] font-bold text-zinc-500">{df.charAt(0)}</span>}
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

    const [pills] = useState(() => buildDayPills())
    const [selectedDate, setSelectedDate] = useState(() => toYYYYMMDD(new Date()))
    const [games, setGames] = useState<Match[]>([])
    const [loading, setLoading] = useState(true)
    const [openSections, setOpenSections] = useState<Set<string>>(new Set())
    const [searchOpen, setSearchOpen] = useState(false)
    const [showDatePicker, setShowDatePicker] = useState(false)
    const [compLogos, setCompLogos] = useState<Map<number, string | null>>(new Map())

    useEffect(() => { loadClubs() }, [loadClubs])
    useEffect(() => {
        const loadLogos = async () => {
            try { const { data } = await supabase.from('competitions_meta').select('id, logo_url')
            if (data) { const m = new Map<number, string | null>(); (data as { id: number; logo_url: string | null }[]).forEach(r => m.set(r.id, r.logo_url)); setCompLogos(m) }
            } catch { /* ignore */ }
        }; loadLogos()
    }, [])

    // Fetch games from FPB via /api/jogos-do-dia
    useEffect(() => {
        setLoading(true)
        setOpenSections(new Set(['seguidos']))
        const load = async () => {
            // Use existing /api/fpb proxy to fetch competition pages
            const comps = [
                { name: 'Liga Betclic Masculina', id: 10902 },
                { name: 'Proliga', id: 10903 },
            ]
            const allGames: Match[] = []

            // Fetch competition pages only — clean, fast, reliable
            for (const comp of comps) {
                for (const page of ['calendario', 'resultados']) {
                    try {
                        const res = await fetch(`/api/fpb?page=${page}&competicao=${comp.id}`)
                        const html = await res.text()
                        if (!html || html.startsWith('{')) continue
                        const parsed = parseFPBHtml(html, comp.name)
                        allGames.push(...parsed)
                    } catch { /* skip */ }
                }
            }

            if (allGames.length > 0) {
                // Filter strictly by selected date AND deduplicate
                const seen = new Set<string>()
                const filtered = allGames.filter(g => {
                    if (g.data !== selectedDate) return false
                    const key = g.slug || `${g.data}-${g.equipa_casa}-${g.equipa_fora}`
                    if (seen.has(key)) return false
                    seen.add(key)
                    return true
                })
                filtered.sort((a, b) => (a.hora || '99:99').localeCompare(b.hora || '99:99'))
                setGames(filtered)
            } else {
                // Fallback Supabase
                try {
                    const { data } = await supabase.from('games_2025_2026').select('*').eq('data', selectedDate).order('hora', { ascending: true })
                    setGames((data as Match[]) || [])
                } catch { setGames([]) }
            }
            setLoading(false)
        }
        load()
    }, [selectedDate])

    const followedNames = useMemo(() => new Set(clubs.filter(c => followedClubIds.includes(c.id)).map(c => c.name)), [clubs, followedClubIds])

    // Separate: followed club games, followed league games, other
    // Filter: hide past-day games without scores (stale data)
    const todayStr = toYYYYMMDD(new Date())
    const displayGames = useMemo(() => {
        return games.filter(g => {
            if (g.data < todayStr && g.resultado_casa === null && g.resultado_fora === null) return false
            return true
        })
    }, [games, todayStr])

    // Build accordion sections (NO hearts on accordions — only rows have indicators)
    const sections = useMemo(() => {
        const s: { key: string; label: string; games: Match[] }[] = []

        const compOrder = ['Liga Betclic Masculina', 'Proliga']
        for (const comp of compOrder) {
            const compGames = displayGames.filter(g => g.competicao === comp)
            if (compGames.length > 0) s.push({ key: comp, label: comp, games: compGames })
        }
        const remaining = displayGames.filter((g: Match) => !s.some(sec => sec.games.includes(g)))
        if (remaining.length > 0) s.push({ key: 'outros', label: 'Outros', games: remaining })

        return s
    }, [displayGames])

    const featuredGame = useMemo(() => {
        let best: Match | null = null, bestRank = 999
        for (const g of games) { const r = leagueRank(g.competicao || ''); if (r < bestRank) { bestRank = r; best = g } }
        return best
    }, [games])

    const toggleSection = (key: string) => setOpenSections(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n })
    const isEmpty = !loading && games.length === 0
    const liveCount = games.filter(g => g.status === 'A DECORRER').length

    return (
        <div className="max-w-2xl mx-auto pb-24">
            {/* ── Purple blur ── */}
            <div className="relative overflow-hidden -mt-16 pt-16">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-dribly-purple/20 dark:bg-dribly-purple/15 blur-[120px] pointer-events-none" />
                <div className="absolute top-4 left-1/4 w-48 h-48 rounded-full bg-dribly-purple-light/15 dark:bg-dribly-purple-light/10 blur-[70px] pointer-events-none" />
                <div className="relative z-10 max-w-2xl mx-auto px-4 pt-2 pb-5">
                    <div className="flex justify-center gap-2 mb-4 flex-wrap">
                        {FEATURED_LEAGUES.map(({ name, id }) => {
                            const logo = compLogos.get(id)
                            return (
                                <button key={id} onClick={() => navigate('/competicao/' + id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300 hover:border-dribly-purple/30 hover:text-dribly-purple hover:shadow-sm transition-all shrink-0">
                                    <span className="w-5 h-5 rounded-full bg-zinc-100 dark:bg-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                                        {logo ? <img src={logo} alt="" className="w-3.5 h-3.5 object-contain" decoding="async" /> : <Trophy size={10} className="text-dribly-purple" />}
                                    </span>
                                    {name}
                                </button>
                            )
                        })}
                    </div>
                    <div className="max-w-lg mx-auto">
                        <button onClick={() => setSearchOpen(true)} className="w-full flex items-center gap-3 pl-5 pr-4 py-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl text-left text-sm text-zinc-400 hover:border-dribly-purple/30 transition-colors shadow-lg shadow-zinc-200/50 dark:shadow-black/20">
                            <Search size={20} className="shrink-0" />Pesquisar clubes e competições...
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Date selector bar ── */}
            <div className="px-4 mb-5">
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-full p-1 flex items-center overflow-x-auto scrollbar-none">
                    {pills.map(p => (
                        <button key={p.date} onClick={() => setSelectedDate(p.date)} className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all ${selectedDate === p.date ? 'bg-dribly-purple text-white shadow-sm' : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5'}`}>{p.label}</button>
                    ))}
                    <button onClick={() => setShowDatePicker(!showDatePicker)} className="shrink-0 px-3 py-2 rounded-full text-xs font-bold text-zinc-400 hover:text-dribly-purple hover:bg-zinc-100 dark:hover:bg-white/5 transition-all" title="Escolher data">📅</button>
                </div>
                {showDatePicker && (
                    <div className="mt-2 flex justify-center">
                        <input type="date" value={selectedDate} onChange={e => { setSelectedDate(e.target.value); setShowDatePicker(false) }}
                            className="px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl text-sm text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-dribly-purple/30" />
                    </div>
                )}
            </div>

            {liveCount > 0 && (
                <div className="px-4 mb-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-[10px] font-bold animate-pulse"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />{liveCount} AO VIVO</span>
                </div>
            )}

            <div className="px-4">
                {loading ? <div className="flex justify-center py-12"><LoadingSpinner /></div>
                    : isEmpty ? <div className="text-center py-12"><Trophy size={28} className="text-zinc-300 dark:text-zinc-600 mx-auto mb-3" /><p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Nenhum jogo neste dia.</p></div>
                    : <>
                        {featuredGame && <div className="mb-4"><GameCard match={featuredGame} mode="agenda" clubs={clubs} /></div>}
                        <div className="space-y-2">
                            {sections.map(({ key, label, games: secGames }) => {
                                const isOpen = openSections.has(key)
                                return (
                                    <div key={key} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl overflow-hidden">
                                        <button onClick={() => toggleSection(key)} className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors">
                                            <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-dribly-purple" />
                                                {label}
                                                <span className="text-[11px] font-medium text-zinc-400">({secGames.length})</span>
                                            </h3>
                                            <ChevronDown size={16} className={`text-zinc-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                                        </button>
                                        {isOpen && (
                                            <div className="divide-y divide-zinc-100 dark:divide-white/5 border-t border-zinc-100 dark:border-white/5">
                                                {secGames.map((g, i) => (
                                                    <ConfrontoRow key={g.slug || i} match={g} clubs={clubs} isFollowed={followedNames.has(g.equipa_casa) || followedNames.has(g.equipa_fora)} />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </>}
            </div>

            {searchOpen && <SearchOverlay clubs={clubs} onClose={() => setSearchOpen(false)} />}
        </div>
    )
}

function SearchOverlay({ clubs, onClose }: { clubs: Club[]; onClose: () => void }) {
    const [q, setQ] = useState('')
    const results = useMemo(() => {
        if (!q.trim()) return []
        const nm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        const qn = nm(q)
        return clubs.filter(c => nm(displayName(c)).includes(qn) || nm(c.name).includes(qn) || nm(c.search_name || '').includes(qn)).slice(0, 6)
    }, [q, clubs])
    return (
        <div className="fixed inset-0 z-50 bg-zinc-50 dark:bg-zinc-950" onClick={onClose}>
            <div className="max-w-2xl mx-auto px-4 pt-4" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1 relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" /><input autoFocus type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="Pesquisar clubes..." className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl text-sm text-zinc-900 dark:text-white placeholder-zinc-400 outline-none focus:ring-2 focus:ring-dribly-purple/30" /></div>
                    <button onClick={onClose} className="text-sm font-medium text-zinc-500">Cancelar</button>
                </div>
                {q.trim() && results.length === 0 && <p className="text-sm text-zinc-400 text-center py-8">Nenhum clube encontrado.</p>}
                <div className="space-y-1">{results.map(club => (
                    <Link key={club.id} to={`/clube/${club.slug}/home`} onClick={onClose} className="flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors">
                        <div className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-white/10 flex items-center justify-center overflow-hidden shrink-0">
                            {club.logo_url ? <img src={club.logo_url} alt="" className="w-6 h-6 object-contain" /> : <span className="text-xs font-bold text-zinc-500">{displayName(club).charAt(0).toUpperCase()}</span>}
                        </div>
                        <span className="text-sm font-medium text-zinc-900 dark:text-white">{displayName(club)}</span>
                    </Link>
                ))}</div>
            </div>
        </div>
    )
}
