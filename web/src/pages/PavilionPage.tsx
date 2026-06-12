/**
 * Pavilion detail page on Dribly.
 * Route: /pavilhao/:recintoId  (param is the pavilion id)
 *
 * Tabs:
 *   Geral      — pavilion info (hero image, rating, address, phone, website,
 *                hours, accessibility, services, nearby places)
 *   Agenda     — upcoming games at this pavilion (date-separated)
 *   Resultados — past results at this pavilion (date-separated)
 */
import { useEffect, useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { MapPin, CalendarDays, Trophy, Info, Navigation, Star, ArrowUpRight } from 'lucide-react'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { PageHeader } from '../components/PageHeader'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import L from 'leaflet'
import { supabase } from '../lib/supabase'
import type { Pavilion, PeopleAlsoSearchItem } from '../lib/mapData'
import { displayPavilionName } from '../lib/mapData'
import { GameCard } from '../components/GameCard'
import { EmptyState } from '../components/EmptyState'
import type { Match } from '../components/types'

type Tab = 'geral' | 'agenda' | 'resultados'

function formatDate(dateStr: string) {
    const date = new Date(dateStr)
    const formatted = date.toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'long' })
    return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

/** Group matches by date, sorted */
function groupByDate(matches: Match[]): [string, Match[]][] {
    const groups: Record<string, Match[]> = {}
    for (const m of matches) {
        if (!groups[m.data]) groups[m.data] = []
        groups[m.data].push(m)
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
}

/** Translate day names from PT to short form */
const DAY_MAP: Record<string, string> = {
    'segunda-feira': 'Seg',
    'terça-feira': 'Ter',
    'quarta-feira': 'Qua',
    'quinta-feira': 'Qui',
    'sexta-feira': 'Sex',
    'sábado': 'Sáb',
    'domingo': 'Dom',
}

export default function PavilionPage() {
    const { recintoId } = useParams<{ recintoId: string }>()
    const [pavilion, setPavilion] = useState<Pavilion | null>(null)
    const [games, setGames] = useState<Match[]>([])
    const [loading, setLoading] = useState(true)
    const [tab, setTab] = useState<Tab>('geral')
    const [darkMode, setDarkMode] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'))
    const [showHours, setShowHours] = useState(false)
    const [nearbyPavs, setNearbyPavs] = useState<Map<string, number>>(new Map()) // title → id

    useEffect(() => {
        const observer = new MutationObserver(() => {
            setDarkMode(document.documentElement.classList.contains('dark'))
        })
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
        return () => observer.disconnect()
    }, [])

    useEffect(() => {
        if (!recintoId) return
        const id = parseInt(recintoId)
        if (isNaN(id)) { setLoading(false); return }
        setLoading(true)

        const loadData = async () => {
            // Try by id first, then by recinto_id for backward compat
            let pavRes = await supabase.from('pavilions').select('*').eq('id', id).single()
            if (!pavRes.data) {
                pavRes = await supabase.from('pavilions').select('*').eq('recinto_id', id).single()
            }

            if (!pavRes.data) { setLoading(false); return }

            const pav = pavRes.data as Pavilion
            setPavilion(pav)

            // Cross-reference nearby places with pavilion IDs (word-level fuzzy match)
            const nearby = (pav.people_also_search || []) as PeopleAlsoSearchItem[]
            if (nearby.length > 0) {
                const { data: allPavs } = await supabase
                    .from('pavilions')
                    .select('id, nome')
                if (allPavs) {
                    const all = allPavs as { id: number; nome: string }[]
                    const map = new Map<string, number>()
                    for (const place of nearby) {
                        const qWords = place.title.toLowerCase()
                            .replace(/^pavilhão\s+/i, '').replace(/^pav\.?\s*/i, '')
                            .replace(/^mun\.?\s*/i, '').replace(/^municipal\s+/i, '')
                            .split(/\s+/).filter(w => w.length > 2)
                        let bestScore = 0
                        let bestId = 0
                        for (const p of all) {
                            const pn = p.nome.toLowerCase()
                                .replace(/^pavilhão\s+/i, '').replace(/^pav\.?\s*/i, '')
                                .replace(/^mun\.?\s*/i, '').replace(/^municipal\s+/i, '')
                                .trim()
                            // Exact or substring match = instant win
                            if (pn === qWords.join(' ') || pn.includes(qWords.join(' ')) || qWords.join(' ').includes(pn)) {
                                bestScore = qWords.length + 1
                                bestId = p.id
                                break
                            }
                            // Word-level: count matching words
                            const pWords = pn.split(/\s+/)
                            let score = 0
                            for (const w of qWords) {
                                if (pWords.some(pw => pw === w || pw.includes(w) || w.includes(pw))) score++
                            }
                            const threshold = Math.min(qWords.length, pWords.length) * 0.5
                            if (score > bestScore && score >= threshold) {
                                bestScore = score
                                bestId = p.id
                            }
                        }
                        if (bestId > 0) map.set(place.title, bestId)
                    }
                    setNearbyPavs(map)
                }
            }

            const searchName = pav.nome
                .replace(/^Pavilhão\s+/i, '').replace(/^Pav\.\s*/i, '').replace(/^Mun\.\s*/i, '')
                .trim().substring(0, 40)

            const gamesRes = await supabase.from('games_2025_2026').select('*')
                .ilike('local', `%${searchName}%`)
                .order('data', { ascending: false })
                .limit(100)

            if (gamesRes.data) {
                setGames(gamesRes.data.map((g: Record<string, unknown>) => ({
                    ...g, id: g.id || g.slug, status: g.status as Match['status'],
                })) as Match[])
            }
            setLoading(false)
        }

        loadData().catch(() => setLoading(false))
    }, [recintoId])

    const upcoming = useMemo(() => games
        .filter((g) => g.status === 'AGENDADO' && g.data >= new Date().toISOString().split('T')[0])
        .sort((a, b) => a.data.localeCompare(b.data)),
    [games])

    const results = useMemo(() => games
        .filter((g) => g.status === 'FINALIZADO')
        .sort((a, b) => b.data.localeCompare(a.data)),
    [games])

    const upcomingByDate = useMemo(() => groupByDate(upcoming), [upcoming])
    const resultsByDate = useMemo(() => groupByDate(results), [results])

    const address = [pavilion?.rua, pavilion?.codigo_postal, pavilion?.cidade].filter(Boolean).join(', ')
    // Best image: prefer high-res from image_urls[0] for hero, fallback to image_url/foto_url
    const imageSrc = pavilion?.image_urls?.[0] || pavilion?.foto_url || pavilion?.image_url
    const info = pavilion?.additional_info
    const nearby = (pavilion?.people_also_search || []) as PeopleAlsoSearchItem[]

    // Extract flat lists from additional_info
    const accessibilityItems = info?.Acessibilidade?.flatMap(a => Object.keys(a)) || []
    const servicesItems = info?.Serviços?.flatMap(a => Object.keys(a)) || []
    const parkingItems = info?.Estacionamento?.flatMap(a => Object.keys(a)) || []

    const tabs: { value: Tab; label: string; icon: React.ComponentType<Record<string, unknown>> }[] = [
        { value: 'geral', label: 'Geral', icon: Info },
        { value: 'agenda', label: 'Agenda', icon: CalendarDays },
        { value: 'resultados', label: 'Resultados', icon: Trophy },
    ]

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center"><LoadingSpinner /></div>
        )
    }

    if (!pavilion) {
        return (
            <div className="max-w-xl mx-auto px-4 py-16 text-center">
                <p className="text-zinc-500">Pavilhão não encontrado.</p>
                <PageHeader />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-[#09090b] dark:via-zinc-950 dark:to-[#09090b]">
            <div className="max-w-6xl mx-auto px-4 pt-6 pb-24">
                <PageHeader />

                {/* Hero image — 16:9, full width */}
                {imageSrc && (
                    <div className="rounded-2xl overflow-hidden aspect-[16/9] mb-6 bg-zinc-100 dark:bg-zinc-800">
                        <img
                            src={imageSrc}
                            alt={pavilion.nome}
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                    </div>
                )}

                {/* Header with icon + name + rating */}
                <div className="flex items-start gap-4 mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-dribly-purple/10 flex items-center justify-center shrink-0">
                        <MapPin size={24} className="text-dribly-purple" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-zinc-900 dark:text-white">
                            {displayPavilionName(pavilion)}
                        </h1>
                        {/* Rating */}
                        {pavilion.google_rating && (
                            <div className="flex items-center gap-1.5 mt-1">
                                <Star size={14} className="text-amber-500 fill-amber-500" />
                                <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                                    {pavilion.google_rating.toFixed(1)}
                                </span>
                                {pavilion.reviews_count && (
                                    <span className="text-xs text-zinc-400">
                                        ({pavilion.reviews_count} avaliações)
                                    </span>
                                )}
                            </div>
                        )}
                        {pavilion.distrito && (
                            <div className="flex items-center gap-2 mt-1">
                                <span className="inline-block px-2 py-0.5 rounded-md bg-dribly-purple/10 text-[10px] font-bold text-dribly-purple">
                                    {pavilion.distrito}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1.5 mb-6 overflow-x-auto">
                    {tabs.map((t) => {
                        const active = tab === t.value
                        const Icon = t.icon
                        return (
                            <button key={t.value} onClick={() => setTab(t.value)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                    active ? 'bg-dribly-purple text-white' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/5'
                                }`}>
                                <Icon size={14} />
                                {t.label}
                            </button>
                        )
                    })}
                </div>

                {tab === 'geral' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                            {/* 1. Localização — mini mapa + morada */}
                            <div className="bg-white dark:bg-zinc-900/60 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 overflow-hidden">
                                <div className="h-36 relative group">
                                    <MapContainer
                                        center={[pavilion.lat, pavilion.lng]}
                                        zoom={15}
                                        zoomControl={false}
                                        dragging={false}
                                        scrollWheelZoom={false}
                                        doubleClickZoom={false}
                                        attributionControl={false}
                                        className="w-full h-full"
                                    >
                                        <TileLayer url={darkMode ? 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png' : 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png'} />
                                        <Marker position={[pavilion.lat, pavilion.lng]}
                                            icon={L.divIcon({
                                                html: `<div style="width:20px;height:20px;background:#7C3AED;border:3px solid white;border-radius:50%;box-shadow:0 0 10px rgba(124,58,237,0.6)"></div>`,
                                                className: '', iconSize: [20, 20], iconAnchor: [10, 10]
                                            })}
                                        />
                                    </MapContainer>
                                    <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address || pavilion.nome)}`}
                                       target="_blank" rel="noopener noreferrer"
                                       className="absolute top-3 right-3 px-2.5 py-1.5 rounded-lg bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm text-[10px] font-bold text-dribly-purple shadow-lg hover:bg-dribly-purple hover:text-white transition-colors inline-flex items-center gap-1 opacity-0 group-hover:opacity-100">
                                        <Navigation size={11} /> Maps
                                    </a>
                                </div>
                                <div className="p-5 space-y-3">
                                    <div>
                                        <p className="text-[10px] text-zinc-400 uppercase tracking-wider mb-0.5">Morada</p>
                                        <p className="text-sm font-medium text-zinc-900 dark:text-white break-words">{pavilion.rua || pavilion.morada_completa || '—'}</p>
                                    </div>
                                    <div className="flex gap-4 text-sm text-zinc-500 dark:text-zinc-400">
                                        {pavilion.codigo_postal && <span>{pavilion.codigo_postal}</span>}
                                        {pavilion.distrito && <span>· {pavilion.distrito}</span>}
                                    </div>
                                </div>
                            </div>

                            {/* 2. Contactos + Rating + Horários */}
                            <div className="bg-white dark:bg-zinc-900/60 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 p-5 space-y-4">
                                {/* Rating — bigger, centered */}
                                {pavilion.google_rating && (
                                    <div className="text-center py-2">
                                        <p className="text-3xl font-black text-zinc-900 dark:text-white">
                                            {pavilion.google_rating.toFixed(1)}
                                        </p>
                                        <div className="flex items-center justify-center gap-0.5 mt-1">
                                            {[1,2,3,4,5].map(s => (
                                                <Star key={s} size={14}
                                                    className={s <= Math.round(pavilion.google_rating!) ? 'text-amber-500 fill-amber-500' : 'text-zinc-200 dark:text-zinc-700'} />
                                            ))}
                                        </div>
                                        {pavilion.reviews_count && (
                                            <p className="text-[10px] text-zinc-400 mt-1">{pavilion.reviews_count} avaliações no Google</p>
                                        )}
                                    </div>
                                )}
                                {/* Phone + Website — clean text */}
                                <div className="space-y-2.5">
                                    {pavilion.phone && (
                                        <div>
                                            <p className="text-[10px] text-zinc-400 uppercase tracking-wider mb-0.5">Telefone</p>
                                            <p className="text-sm font-medium text-zinc-900 dark:text-white">{pavilion.phone}</p>
                                        </div>
                                    )}
                                    {pavilion.website && (
                                        <div>
                                            <p className="text-[10px] text-zinc-400 uppercase tracking-wider mb-0.5">Website</p>
                                            <a href={pavilion.website} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-zinc-900 dark:text-white hover:underline inline-flex items-center gap-1">
                                                {(() => { try { return new URL(pavilion.website).hostname.replace('www.', '') } catch { return pavilion.website } })()}
                                                <ArrowUpRight size={11} className="text-zinc-400" />
                                            </a>
                                        </div>
                                    )}
                                </div>
                                {/* Horários — inline */}
                                {pavilion.opening_hours && pavilion.opening_hours.length > 0 && (
                                    <div>
                                        <button onClick={() => setShowHours(!showHours)}
                                            className="w-full text-left">
                                            <p className="text-[10px] text-zinc-400 uppercase tracking-wider mb-0.5">Horários</p>
                                            <p className="text-sm font-medium text-zinc-900 dark:text-white">
                                                {pavilion.opening_hours[0].hours.replace(' to ', '–')}
                                                <span className="text-[10px] text-dribly-purple font-bold ml-2">
                                                    {showHours ? '▲' : '▼'} ver todos
                                                </span>
                                            </p>
                                        </button>
                                        {showHours && (
                                            <div className="mt-2 ml-0 space-y-1">
                                                {pavilion.opening_hours.map((h, i) => (
                                                    <div key={i} className="flex justify-between text-xs py-1 border-b border-zinc-50 dark:border-white/5 last:border-0">
                                                        <span className="text-zinc-500">{DAY_MAP[h.day] || h.day}</span>
                                                        <span className="font-medium text-zinc-700 dark:text-zinc-300">{h.hours.replace(' to ', ' – ')}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                                {/* Links */}
                                <div className="flex items-center gap-3 pt-1">
                                    {pavilion.google_maps_url && (
                                        <a href={pavilion.google_maps_url} target="_blank" rel="noopener noreferrer"
                                            className="text-[10px] text-dribly-purple hover:underline font-bold">
                                            Google Maps <ArrowUpRight size={10} className="inline" />
                                        </a>
                                    )}
                                    {pavilion.fpb_url && (
                                        <a href={pavilion.fpb_url} target="_blank" rel="noopener noreferrer"
                                            className="text-[10px] text-dribly-purple hover:underline font-bold">
                                            FPB <ArrowUpRight size={10} className="inline" />
                                        </a>
                                    )}
                                </div>
                            </div>

                            {/* 3. Acessibilidade + Serviços — clean text only */}
                            <div className="bg-white dark:bg-zinc-900/60 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 p-5 space-y-4">
                                {accessibilityItems.length > 0 && (
                                    <div>
                                        <p className="text-[10px] text-zinc-400 uppercase tracking-wider mb-2">Acessibilidade</p>
                                        <div className="space-y-1.5">
                                            {accessibilityItems.map((item) => (
                                                <p key={item} className="text-sm font-medium text-zinc-900 dark:text-white">{item}</p>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {servicesItems.length > 0 && (
                                    <div>
                                        <p className="text-[10px] text-zinc-400 uppercase tracking-wider mb-2">Serviços</p>
                                        <div className="space-y-1.5">
                                            {servicesItems.map((item) => (
                                                <p key={item} className="text-sm font-medium text-zinc-900 dark:text-white">{item}</p>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {parkingItems.length > 0 && (
                                    <div>
                                        <p className="text-[10px] text-zinc-400 uppercase tracking-wider mb-2">Estacionamento</p>
                                        <div className="space-y-1.5">
                                            {parkingItems.map((item) => (
                                                <p key={item} className="text-sm font-medium text-zinc-900 dark:text-white">{item}</p>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* 4. Pavilhões próximos — inline compact */}
                            <div className="bg-white dark:bg-zinc-900/60 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 p-5">
                                <p className="text-[10px] text-zinc-400 uppercase tracking-wider mb-2">
                                    Pavilhões próximos
                                    <span className="text-zinc-300 ml-1">· {nearby.length}</span>
                                </p>
                                {nearby.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {nearby.slice(0, 8).map((place, i) => {
                                            const pavId = nearbyPavs.get(place.title)
                                            const chip = (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-white/5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-dribly-purple/10 hover:text-dribly-purple transition-colors">
                                                    {place.title}
                                                    {pavId && <ArrowUpRight size={10} className="text-dribly-purple" />}
                                                </span>
                                            )
                                            return pavId
                                                ? <Link key={i} to={`/pavilhao/${pavId}`}>{chip}</Link>
                                                : <span key={i}>{chip}</span>
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-sm text-zinc-400">Sem dados</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {tab === 'agenda' && (
                    upcoming.length === 0 ? (
                        <EmptyState view="agenda" />
                    ) : (
                        <div className="space-y-6 px-2 md:px-4">
                            {upcomingByDate.map(([date, dateGames]) => (
                                <div key={date}>
                                    <div className="flex items-center gap-3 mb-3 px-2">
                                        <h3 className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-widest">{formatDate(date)}</h3>
                                        <div className="flex-1 h-px bg-zinc-200 dark:bg-white/5" />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {dateGames.map((match) => (
                                            <GameCard key={match.id || match.slug} match={match} mode="agenda" />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                )}

                {tab === 'resultados' && (
                    results.length === 0 ? (
                        <EmptyState view="results" />
                    ) : (
                        <div className="space-y-6 px-2 md:px-4">
                            {resultsByDate.map(([date, dateGames]) => (
                                <div key={date}>
                                    <div className="flex items-center gap-3 mb-3 px-2">
                                        <h3 className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-widest">{formatDate(date)}</h3>
                                        <div className="flex-1 h-px bg-zinc-200 dark:bg-white/5" />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {dateGames.map((match) => (
                                            <GameCard key={match.id || match.slug} match={match} mode="results" />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                )}
            </div>
        </div>
    )
}
