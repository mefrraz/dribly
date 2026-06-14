/**
 * Home — v12
 *
 * Data source: /api/jogos-do-dia (FPB direto → sempre fresco)
 * Accordions: "Seguidos" (♥ clubs/ligas) primeiro, depois competições
 */

import { useState, useEffect, useMemo, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Search, Trophy, ChevronDown, MapPin } from 'lucide-react'
import { MapContainer, TileLayer, Marker, Tooltip, Circle } from 'react-leaflet'
import L from 'leaflet'
import { supabase } from '../lib/supabase'
import { useFollows } from '../hooks/useFollows'
import { type Club, useClub, displayName } from '../lib/ClubContext'
import { normalizeTeamDisplay, clubLogoUrl, semiAbrev } from '../lib/fpbUtils'
import type { Match } from '../components/types'
import { GameCard } from '../components/GameCard'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { useGeolocation, haversineKm, normalizeLocation } from '../lib/geolocation'
import { fetchPavilions, type Pavilion } from '../lib/mapData'

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
    const dias = [
        { label: 'Ontem', date: addDays(hoje, -1) },
        { label: 'Hoje', date: hoje },
        { label: 'Amanhã', date: addDays(hoje, 1) },
    ]
    for (let i = 2; i <= 4; i++) {
        const d = addDays(hoje, i)
        dias.push({ label: d.toLocaleDateString('pt-PT', { weekday: 'short' }) + ' ' + d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'numeric' }), date: d })
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
            // Scores: handle multiline h3 tags (results page has newlines before class=)
            const scores = [...gh.matchAll(/<h3[^>]*class="results_text[^"]*"[^>]*>\s*(\d+)\s*<\/h3>/gi)].map(s => parseInt(s[1]))
            const horaMatch = gh.match(/<div class="hour[^"]*">\s*<h3>\s*(\d{1,2})[Hh](\d{2})\s*<\/h3>/i)
            let hora = horaMatch ? `${horaMatch[1].padStart(2, '0')}:${horaMatch[2]}` : ''
            // Fallback: results page may show score in hour position ("78-65")
            if (!horaMatch && scores.length < 2) {
                const altHora = gh.match(/<div class="hour[^"]*">\s*<h3>\s*([^<]+)\s*<\/h3>/i)
                if (altHora) {
                    const txt = altHora[1].trim()
                    if (txt.includes('-') && !txt.includes('H')) {
                        const parts = txt.split('-')
                        const s1 = parseInt(parts[0]), s2 = parseInt(parts[1])
                        if (!isNaN(s1) && !isNaN(s2)) { scores.push(s1, s2) }
                    } else {
                        hora = txt.replace(/[^0-9]/g, '').slice(0, 4)
                        if (hora.length === 4) hora = hora.slice(0, 2) + ':' + hora.slice(2)
                    }
                }
            }
            // Extract competition from inline HTML (club pages have per-game competition)
            const compMatch = gh.match(/<div class="competition"[^>]*>\s*<span>\s*([^<]+?)\s*<\/span>/i)
            let comp = competicao, esc = ''
            if (compMatch) {
                const raw = compMatch[1].trim()
                if (raw.includes('|')) {
                    const parts = raw.split('|')
                    esc = parts[0]?.trim() || ''
                    comp = parts[1]?.trim() || raw
                } else if (raw) {
                    comp = raw
                }
            }
            // Extract location from HTML (for "Jogos perto de mim")
            const localMatch = gh.match(/<div class="location-wrapper[^"]*">[\s\S]*?<b>([^<]+)<\/b>/i)
            const local = localMatch ? localMatch[1].trim().replace(/\s+/g, ' ') : null
            const isFinished = scores.length >= 2
            games.push({
                id, slug: `${dateStr}-${slugify(teams[0])}-${slugify(teams[1])}`,
                data: dateStr, hora,
                equipa_casa: teams[0], equipa_fora: teams[1],
                resultado_casa: isFinished ? scores[0] : null,
                resultado_fora: isFinished ? scores[1] : null,
                competicao: comp, escalao: esc,
                status: isFinished ? 'FINALIZADO' : 'AGENDADO',
                local,
                logotipo_casa: null, logotipo_fora: null, // logos come from clubLogoUrl() bucket
            })
        }
    }
    return games
}

// ── Cache helpers ──

interface CacheEntry {
    games: Match[]
    compTimes: Record<string, string>
    ts: number
}

function dedupAndFilter(games: Match[], date: string): Match[] {
    const seen = new Set<string>()
    const filtered = games.filter(g => {
        if (g.data !== date) return false
        const key = g.slug || `${g.data}-${g.equipa_casa}-${g.equipa_fora}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
    })
    filtered.sort((a, b) => (a.hora || '99:99').localeCompare(b.hora || '99:99'))
    return filtered
}

function saveCache(key: string, games: Match[], competitions: { name: string }[]) {
    const compTimes: Record<string, string> = {}
    for (const comp of competitions) {
        const compGames = games.filter(g => g.competicao === comp.name)
        if (compGames.length > 0) {
            // Find the latest game time for this competition
            const latest = compGames.reduce((max, g) => (g.hora || '') > (max.hora || '') ? g : max, compGames[0])
            compTimes[comp.name] = formatHora(latest.hora) || '23:59'
        }
    }
    const cache: CacheEntry = { games, compTimes, ts: Date.now() }
    try { localStorage.setItem(key, JSON.stringify(cache)) } catch { /* quota exceeded */ }
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

// ── Club lookup helper ──

function findClubByTeam(teamName: string, clubs: Club[]): Club | undefined {
    const n = teamName.trim().toUpperCase()
    // 1. Exact match (including semi-abbreviated form: "SC Farense" ↔ "Sporting Clube Farense")
    for (const c of clubs) {
        const cn = c.name.toUpperCase()
        const sn = (c.search_name || '').toUpperCase()
        const sa = semiAbrev(c.name).toUpperCase()
        if (n === cn || n === sn || n === sa) return c
    }
    // 2. Substring both ways (handles partial abbreviations)
    for (const c of clubs) {
        const cn = c.name.toUpperCase()
        const sn = (c.search_name || '').toUpperCase()
        const sa = semiAbrev(c.name).toUpperCase()
        if (cn.includes(n) || n.includes(cn) || sn.includes(n) || n.includes(sn) || sa.includes(n) || n.includes(sa)) return c
    }
    // 3. Word-level: match if ≥50% of significant words match (handles "SC FARENSE" → "Sporting Clube Farense")
    const teamWords = n.split(/\s+/).filter(w => w.length > 1)
    if (teamWords.length >= 1) {
        for (const c of clubs) {
            const allWords = new Set([
                ...c.name.toUpperCase().split(/\s+/),
                ...(c.search_name || '').toUpperCase().split(/\s+/),
                ...semiAbrev(c.name).toUpperCase().split(/\s+/),
            ])
            const matches = teamWords.filter(w => allWords.has(w)).length
            if (matches >= teamWords.length * 0.5 && matches >= 1) return c
        }
    }
    return undefined
}

// ── Confrontos row ──

function ConfrontoRow({ match, clubs, isFollowed, showCompetition }: { match: Match; clubs: Club[]; isFollowed: boolean; showCompetition?: boolean }) {
    const dc = normalizeTeamDisplay(match.equipa_casa, clubs)
    const df = normalizeTeamDisplay(match.equipa_fora, clubs)
    const clubCasa = findClubByTeam(match.equipa_casa, clubs)
    const clubFora = findClubByTeam(match.equipa_fora, clubs)
    // Primary: our Supabase bucket (reliable, always correct). Fallback: FPB scrape.
    const logoCasa = clubLogoUrl(clubCasa) || match.logotipo_casa
    const logoFora = clubLogoUrl(clubFora) || match.logotipo_fora
    const isLive = match.status === 'A DECORRER'
    const hasScores = match.resultado_casa !== null && match.resultado_fora !== null
    const isFinished = match.status === 'FINALIZADO' || hasScores
    const slug = match.slug || `${match.data}-${match.equipa_casa.toLowerCase().replace(/\s+/g, '-')}-${match.equipa_fora.toLowerCase().replace(/\s+/g, '-')}`
    const club = clubCasa || clubFora
    const idParam = match.id && /^\d+$/.test(match.id) ? `&internalID=${match.id}` : ''
    const linkTo = club ? `/jogo/${slug}?clube=${club.slug}${idParam}` : idParam ? `/jogo/${slug}?internalID=${match.id}` : `/jogo/${slug}`
    const hora = formatHora(match.hora)

    return (
        <Link to={linkTo} className={`flex items-center gap-2 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group ${isFollowed ? 'bg-dribly-purple/[0.03] dark:bg-dribly-purple/[0.05]' : ''}`}>
            {isFollowed && <span className="w-1.5 h-1.5 rounded-full bg-dribly-purple shrink-0" />}
            <div className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 overflow-hidden border border-zinc-200 dark:border-zinc-700/50">
                {logoCasa ? <img src={logoCasa} alt="" className="w-5 h-5 object-contain" loading="lazy" /> : <span className="text-[9px] font-bold text-zinc-500">{dc.charAt(0)}</span>}
            </div>
            <span className="text-[12px] font-semibold truncate shrink-0 max-w-[100px] text-zinc-900 dark:text-white group-hover:text-dribly-purple transition-colors">{dc}</span>
            {isFinished ? <span className="text-zinc-900 dark:text-white font-bold text-xs tabular-nums shrink-0">{match.resultado_casa}-{match.resultado_fora}</span>
                : <span className="text-zinc-400 font-medium text-[10px] shrink-0">vs</span>}
            <span className="text-[12px] truncate shrink-0 max-w-[100px] text-zinc-500 dark:text-zinc-400">{df}</span>
            <div className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 overflow-hidden border border-zinc-200 dark:border-zinc-700/50">
                {logoFora ? <img src={logoFora} alt="" className="w-5 h-5 object-contain" loading="lazy" /> : <span className="text-[9px] font-bold text-zinc-500">{df.charAt(0)}</span>}
            </div>
            <span className="flex-1" />
            {/* Escalão label for Seguidos — right next to hora */}
            {showCompetition && match.escalao ? (
                <span className="text-[10px] text-zinc-400 shrink-0 mr-1.5 max-w-[90px] truncate">{match.escalao}</span>
            ) : null}
            {isLive ? <span className="text-[11px] font-bold text-red-500 animate-pulse shrink-0 uppercase">LIVE</span>
                : isFinished ? <span className="text-[11px] text-zinc-400 shrink-0 font-medium uppercase">FIN</span>
                : <span className="text-[11px] text-zinc-400 shrink-0 font-medium tabular-nums">{hora || '--:--'}</span>}
        </Link>
    )
}

// ── Main ──

export default function Home() {
    const { followedClubIds } = useFollows()
    const { clubs, loadClubs } = useClub()
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()

    const [pills] = useState(() => buildDayPills())
    const [selectedDate, setSelectedDate] = useState(() => searchParams.get('data') || toYYYYMMDD(new Date()))
    const [games, setGames] = useState<Match[]>([])
    const [followedGames, setFollowedGames] = useState<Match[]>([])
    const [loading, setLoading] = useState(true)
    const [hasLoadedFollowed, setHasLoadedFollowed] = useState(false)
    const [openSections, setOpenSections] = useState<Set<string>>(new Set())
    const [searchOpen, setSearchOpen] = useState(false)
    const [showDatePicker, setShowDatePicker] = useState(false)
    const [compLogos, setCompLogos] = useState<Map<number, string | null>>(new Map())

    // ── Dark mode ──
    const [darkMode, setDarkMode] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'))
    useEffect(() => {
        const obs = new MutationObserver(() => setDarkMode(document.documentElement.classList.contains('dark')))
        obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
        return () => obs.disconnect()
    }, [])

    // ── Jogos perto de mim ──
    const geo = useGeolocation()
    const [nearbyGames, setNearbyGames] = useState<{ game: Match; pavilion: Pavilion; distance: number }[]>([])
    const [nearbyComputed, setNearbyComputed] = useState(false)
    const pavsRef = useRef<Pavilion[] | null>(null)
    const gamesHashRef = useRef('')
    useEffect(() => {
        if (!geo.lat || !geo.lng) return
        const allGames = [...games, ...followedGames].filter(g => g.local)
        const todayStr = new Date().toISOString().split('T')[0]
        const recent = allGames.filter(g => g.data >= todayStr)
        if (recent.length === 0) { setNearbyGames([]); setNearbyComputed(true); return }
        // Only recompute if games content changed (avoids re-fetch on every render)
        const hash = recent.map(g => g.slug || g.id).sort().join(',')
        if (hash === gamesHashRef.current) return
        gamesHashRef.current = hash
        const compute = async () => {
            try {
                if (!pavsRef.current) pavsRef.current = await fetchPavilions()
                const pavs = pavsRef.current
                const matches: { game: Match; pavilion: Pavilion; distance: number }[] = []
                for (const g of recent) {
                    const locNorm = normalizeLocation(g.local!.split('|')[0])
                    for (const p of pavs) {
                        const pavNorm = normalizeLocation(p.nome)
                        if (locNorm.includes(pavNorm) || pavNorm.includes(locNorm) || 
                            (g.local!.toLowerCase().includes(p.cidade?.toLowerCase() || '') && locNorm.split(/\s+/).some(w => pavNorm.includes(w)))) {
                            const dist = haversineKm(geo.lat!, geo.lng!, p.lat, p.lng)
                            if (dist <= 5) matches.push({ game: g, pavilion: p, distance: dist })
                            break
                        }
                    }
                }
                matches.sort((a, b) => a.distance - b.distance)
                setNearbyGames(matches)
                setNearbyComputed(true)
            } catch { /* ignore */ }
            gamesHashRef.current = ''
        }
        compute()
    }, [geo.lat, geo.lng, games, followedGames])

    useEffect(() => { loadClubs() }, [loadClubs])
    useEffect(() => {
        const loadLogos = async () => {
            try { const { data } = await supabase.from('competitions_meta').select('id, logo_url')
            if (data) { const m = new Map<number, string | null>(); (data as { id: number; logo_url: string | null }[]).forEach(r => m.set(r.id, r.logo_url)); setCompLogos(m) }
            } catch { /* ignore */ }
        }; loadLogos()
    }, [])

    // Smart cache: fetch 7 leagues, cache 2h after last game ends
    useEffect(() => {
        setLoading(true)
        setOpenSections(new Set())
        setFollowedGames([])

        const COMPETITIONS = [
            { name: 'Liga Betclic', id: 10902 },
            { name: 'Proliga', id: 10903 },
            { name: '1ª Divisão', id: 10904 },
            { name: '2ª Divisão', id: 10905 },
            { name: 'Liga Betclic Fem', id: 10906 },
            { name: '1ª Divisão Fem', id: 10907 },
            { name: '2ª Divisão Fem', id: 10908 },
        ]

        const CACHE_KEY = `dribly_games_${selectedDate}`
        const now = Date.now()

        const load = async () => {
            // 1. Check cache
            const cached = localStorage.getItem(CACHE_KEY)
            if (cached) {
                try {
                    const cache: { games: Match[]; compTimes: Record<string, string>; ts: number } = JSON.parse(cached)
                    // Check if any competition's last game ended more than 2h ago
                    let needsRefresh = false
                    const toRefresh: typeof COMPETITIONS = []
                    for (const comp of COMPETITIONS) {
                        const lastTime = cache.compTimes[comp.name]
                        if (lastTime) {
                            const [h, m] = lastTime.split(':').map(Number)
                            const gameEnd = new Date(selectedDate + 'T' + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':00')
                            gameEnd.setHours(gameEnd.getHours() + 2) // game duration ~2h
                            if (now > gameEnd.getTime()) {
                                needsRefresh = true
                                toRefresh.push(comp)
                            }
                        }
                    }
                    if (!needsRefresh) {
                        setGames(cache.games)
                        setLoading(false)
                        return
                    }
                    // Partial refresh: only refetch competitions whose games just ended
                    if (toRefresh.length < COMPETITIONS.length) {
                        const freshGames = [...cache.games.filter(g => !toRefresh.some(c => c.name === g.competicao))]
                        for (const comp of toRefresh) {
                            for (const page of ['resultados', 'calendario']) {
                                try {
                                    const res = await fetch(`/api/fpb?page=${page}&competicao=${comp.id}`)
                                    const html = await res.text()
                                    if (!html || html.startsWith('{')) continue
                                    freshGames.push(...parseFPBHtml(html, comp.name))
                                } catch { /* skip */ }
                            }
                        }
                        const filtered = dedupAndFilter(freshGames, selectedDate)
                        saveCache(CACHE_KEY, filtered, COMPETITIONS)
                        setGames(filtered)
                        setLoading(false)
                        return
                    }
                } catch { /* corrupt cache — full fetch */ }
            }

            // 2. Full fetch (first load or cache expired)
            const allGames: Match[] = []
            await Promise.all(COMPETITIONS.map(async (comp) => {
                for (const page of ['resultados', 'calendario']) {
                    try {
                        const res = await fetch(`/api/fpb?page=${page}&competicao=${comp.id}`)
                        const html = await res.text()
                        if (!html || html.startsWith('{')) continue
                        allGames.push(...parseFPBHtml(html, comp.name))
                    } catch { /* skip */ }
                }
            }))

            const filtered = dedupAndFilter(allGames, selectedDate)
            saveCache(CACHE_KEY, filtered, COMPETITIONS)
            setGames(filtered.length > 0 ? filtered : [])
            if (filtered.length === 0) {
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

    // Background fetch for followed clubs (runs once per date+follows combo)
    const lastFollowedFetch = useRef('')
    useEffect(() => {
        const key = `${selectedDate}-${followedClubIds.join(',')}`
        if (followedClubIds.length === 0 || clubs.length === 0 || key === lastFollowedFetch.current) {
            if (followedClubIds.length === 0) setFollowedGames([])
            return
        }
        lastFollowedFetch.current = key
        setHasLoadedFollowed(false)
        const fetchFollowed = async () => {
            const followedClubs = clubs.filter(c => followedClubIds.includes(c.id))
            // Merge resultados + calendario: keep scores from resultados, hora from calendario
            const clubGamesMap = new Map<string, Match>()
            for (const club of followedClubs.slice(0, 8)) {
                // Fetch resultados first so scores take priority in the merge
                for (const page of ['resultados', 'calendario']) {
                    try {
                        const res = await fetch(`/api/fpb?page=${page}&clube=${club.id}&epoca=2025/2026`)
                        const html = await res.text()
                        if (!html || html.startsWith('{')) continue
                        const parsed = parseFPBHtml(html, '')
                        for (const g of parsed.filter(g => g.data === selectedDate)) {
                            const key = g.slug || `${g.data}-${g.equipa_casa}-${g.equipa_fora}`
                            const existing = clubGamesMap.get(key)
                            if (existing) {
                                clubGamesMap.set(key, {
                                    ...g,
                                    hora: g.hora || existing.hora,
                                    resultado_casa: g.resultado_casa ?? existing.resultado_casa,
                                    resultado_fora: g.resultado_fora ?? existing.resultado_fora,
                                    status: (g.resultado_casa !== null && g.resultado_fora !== null) ? 'FINALIZADO' : existing.status,
                                })
                            } else {
                                clubGamesMap.set(key, g)
                            }
                        }
                    } catch { /* skip */ }
                }
            }
            const unique = Array.from(clubGamesMap.values())
            unique.sort((a, b) => (a.hora || '99:99').localeCompare(b.hora || '99:99'))
            setFollowedGames(unique)
            setHasLoadedFollowed(true)
        }
        fetchFollowed()
    }, [followedClubIds, clubs.length, selectedDate])

    // Filter: hide past-day games without scores (stale data)
    const todayStr = toYYYYMMDD(new Date())
    const displayGames = useMemo(() => {
        return games.filter(g => {
            if (g.data < todayStr && g.resultado_casa === null && g.resultado_fora === null) return false
            return true
        })
    }, [games, todayStr])

    const featuredGame = useMemo(() => {
        // Use league games; fallback to followed games if no league games today
        const pool = games.length > 0 ? games : followedGames
        let best: Match | null = null, bestRank = 999
        for (const g of pool) { const r = leagueRank(g.competicao || ''); if (r < bestRank) { bestRank = r; best = g } }
        return best
    }, [games, followedGames])

    // Build accordion sections — Seguidos (por escalão) first, then leagues
    const sections = useMemo(() => {
        const s: { key: string; label: string; games: Match[]; isFollowed?: boolean; count?: number }[] = []

        // "Seguidos" — um accordion por escalão, aparece depois do fetch
        if (followedClubIds.length > 0 && hasLoadedFollowed) {
            const byEscalao = new Map<string, Match[]>()
            for (const g of followedGames) {
                const esc = g.escalao || 'Outros'
                if (!byEscalao.has(esc)) byEscalao.set(esc, [])
                byEscalao.get(esc)!.push(g)
            }
            // Sort: seniors first, then by age, then alphabetical
            const order = Array.from(byEscalao.keys()).sort((a, b) => {
                const aNum = parseInt((a.match(/sub\s*(\d+)/i) || [])[1] || '99')
                const bNum = parseInt((b.match(/sub\s*(\d+)/i) || [])[1] || '99')
                if (aNum !== bNum) return aNum - bNum
                return a.localeCompare(b)
            })
            for (const esc of order) {
                const games = byEscalao.get(esc)!
                games.sort((a, b) => (a.hora || '99:99').localeCompare(b.hora || '99:99'))
                s.push({ key: `seguidos-${esc}`, label: esc, games, isFollowed: true, count: games.length })
            }
        }

        const compOrder = ['Liga Betclic', 'Proliga', '1ª Divisão', '2ª Divisão', 'Liga Betclic Fem', '1ª Divisão Fem', '2ª Divisão Fem']
        for (const comp of compOrder) {
            const compGames = displayGames.filter(g =>
                g.competicao === comp &&
                !followedGames.includes(g) &&
                g.slug !== featuredGame?.slug
            )
            if (compGames.length > 0) s.push({ key: comp, label: comp, games: compGames })
        }
        const remaining = displayGames.filter((g: Match) => !s.some(sec => sec.games.includes(g)) && g.slug !== featuredGame?.slug)
        if (remaining.length > 0) s.push({ key: 'outros', label: 'Outros', games: remaining })

        return s
    }, [displayGames, followedGames, followedClubIds, selectedDate, featuredGame, hasLoadedFollowed])

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
                            {sections.map(({ key, label, games: secGames, isFollowed, count }) => {
                                const isOpen = openSections.has(key)
                                return (
                                    <div key={key} className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl overflow-hidden ${isFollowed ? 'border-dribly-purple/20 dark:border-dribly-purple/10' : ''}`}>
                                        <button onClick={() => toggleSection(key)} className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors">
                                            <div className="flex items-center gap-2 min-w-0">
                                                {isFollowed ? (
                                                    <svg className="w-4 h-4 text-dribly-purple shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                                                    </svg>
                                                ) : (
                                                    <span className="w-1.5 h-1.5 rounded-full bg-dribly-purple shrink-0" />
                                                )}
                                                <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 truncate">{label}</h3>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                {count !== undefined && (
                                                    <span className="text-[10px] font-bold text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full tabular-nums">
                                                        {count}
                                                    </span>
                                                )}
                                                <ChevronDown size={16} className={`text-zinc-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                                            </div>
                                        </button>
                                        {isOpen && (
                                            secGames.length === 0 ? (
                                                <div className="px-4 py-6 text-center border-t border-zinc-100 dark:border-white/5">
                                                    <p className="text-xs text-zinc-400">Nenhum jogo neste escalão.</p>
                                                </div>
                                            ) : (
                                                <div className="divide-y divide-zinc-100 dark:divide-white/5 border-t border-zinc-100 dark:border-white/5">
                                                    {secGames.map((g, i) => (
                                                        <ConfrontoRow key={g.slug || i} match={g} clubs={clubs} isFollowed={!!isFollowed} showCompetition={!!isFollowed} />
                                                    ))}
                                                </div>
                                            )
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </>}
            </div>

            {/* ── Jogos perto de mim ── */}
            {!geo.error && !loading && nearbyComputed && (
                <div className="px-4 mt-5">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl overflow-hidden">
                        <div className="px-4 py-3.5 flex items-center gap-2.5 border-b border-zinc-100 dark:border-white/5">
                            <MapPin size={16} className="text-dribly-purple shrink-0" />
                            <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Jogos perto de ti</h3>
                            <span className="text-[10px] text-zinc-400 ml-auto">até 5 km</span>
                        </div>
                        {nearbyGames.length === 0 ? (
                            <div className="px-4 py-6 text-center">
                                <p className="text-xs text-zinc-400">Nenhum jogo próximo encontrado.</p>
                            </div>
                        ) : (
                            <>
                                <div className="h-48 w-full">
                                    <MapContainer
                                        key={darkMode ? 'dark' : 'light'}
                                        center={[geo.lat!, geo.lng!]}
                                        zoom={13}
                                        zoomControl={false}
                                        dragging={false}
                                        scrollWheelZoom={false}
                                        doubleClickZoom={false}
                                        touchZoom={false}
                                        attributionControl={false}
                                        className="w-full h-full z-0"
                                    >
                                        <TileLayer url={darkMode
                                            ? 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
                                            : 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png'
                                        } />
                                        <Circle center={[geo.lat!, geo.lng!]} radius={5000}
                                            pathOptions={{ color: '#7C3AED', fillColor: '#7C3AED', fillOpacity: 0.08, weight: 1.5 }}
                                        />
                                        {nearbyGames.map(({ pavilion }) => (
                                            <Marker key={pavilion.id}
                                                position={[pavilion.lat, pavilion.lng]}
                                                icon={L.divIcon({
                                                    html: `<div style="width:14px;height:14px;background:#7C3AED;border:2px solid white;border-radius:50%;box-shadow:0 0 6px rgba(124,58,237,0.8);cursor:pointer"></div>`,
                                                    className: '', iconSize: [14, 14], iconAnchor: [7, 7]
                                                })}
                                                eventHandlers={{
                                                    click: () => navigate(`/pavilhao/${pavilion.recinto_id || pavilion.id}`),
                                                }}
                                            >
                                                <Tooltip direction="top" offset={[0, -10]} opacity={0.95}>
                                                    <div className="text-center">
                                                        <p className="text-[11px] font-bold">{pavilion.nome}</p>
                                                        {pavilion.cidade && <p className="text-[9px] text-zinc-400">{pavilion.cidade}</p>}
                                                        <p className="text-[8px] text-dribly-purple mt-0.5">ver pavilhão →</p>
                                                    </div>
                                                </Tooltip>
                                            </Marker>
                                        ))}
                                    </MapContainer>
                                </div>
                                <div className="divide-y divide-zinc-100 dark:divide-white/5 border-t border-zinc-100 dark:border-white/5">
                                    {nearbyGames.map(({ game }) => (
                                        <ConfrontoRow key={game.slug || game.id} match={game} clubs={clubs} isFollowed={false} />
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

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
