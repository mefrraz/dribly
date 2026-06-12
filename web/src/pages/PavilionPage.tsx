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
import { useParams } from 'react-router-dom'
import { MapPin, CalendarDays, Trophy, Info, Navigation, Home, Mail, Phone, Globe, Star, Clock, ChevronDown, ChevronUp, ExternalLink, Wheelchair, BadgeCheck } from 'lucide-react'
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
    const imageSrc = pavilion?.image_url || pavilion?.foto_url
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

                {/* Hero image — full width, rounded */}
                {imageSrc && (
                    <div className="rounded-2xl overflow-hidden h-48 md:h-64 mb-6 bg-zinc-100 dark:bg-zinc-800">
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
                        {/* Map */}
                        <div className="rounded-2xl overflow-hidden h-52 border border-zinc-200 dark:border-zinc-800 relative group">
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
                            <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address || pavilion.nome)}`}
                                   target="_blank" rel="noopener noreferrer"
                                   className="px-2.5 py-1.5 rounded-lg bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm text-[10px] font-bold text-dribly-blue shadow-lg hover:bg-dribly-blue hover:text-white transition-colors inline-flex items-center gap-1">
                                    <Navigation size={11} />
                                    Maps
                                </a>
                            </div>
                        </div>

                        {/* Info cards */}
                        <div className="bg-white dark:bg-zinc-900/60 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 p-5 space-y-4">
                            {/* Address + Postal Code */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex items-start gap-2.5">
                                    <Home size={14} className="text-zinc-400 shrink-0 mt-0.5" />
                                    <div className="min-w-0">
                                        <p className="text-[10px] text-zinc-400 uppercase mb-0.5">Morada</p>
                                        <p className="text-sm font-medium text-zinc-900 dark:text-white break-words">{pavilion.rua || pavilion.morada_completa || '—'}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2.5">
                                    <Mail size={14} className="text-zinc-400 shrink-0 mt-0.5" />
                                    <div className="min-w-0">
                                        <p className="text-[10px] text-zinc-400 uppercase mb-0.5">Código Postal</p>
                                        <p className="text-sm font-medium text-zinc-900 dark:text-white">{pavilion.codigo_postal || '—'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Phone + Website */}
                            {(pavilion.phone || pavilion.website) && (
                                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-zinc-100 dark:border-white/5">
                                    {pavilion.phone && (
                                        <div className="flex items-start gap-2.5">
                                            <Phone size={14} className="text-zinc-400 shrink-0 mt-0.5" />
                                            <div className="min-w-0">
                                                <p className="text-[10px] text-zinc-400 uppercase mb-0.5">Telefone</p>
                                                <a href={`tel:${pavilion.phone}`} className="text-sm font-medium text-dribly-blue hover:underline break-words">
                                                    {pavilion.phone}
                                                </a>
                                            </div>
                                        </div>
                                    )}
                                    {pavilion.website && (
                                        <div className="flex items-start gap-2.5">
                                            <Globe size={14} className="text-zinc-400 shrink-0 mt-0.5" />
                                            <div className="min-w-0">
                                                <p className="text-[10px] text-zinc-400 uppercase mb-0.5">Website</p>
                                                <a href={pavilion.website} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-dribly-blue hover:underline break-words inline-flex items-center gap-1">
                                                    {new URL(pavilion.website).hostname.replace('www.', '')}
                                                    <ExternalLink size={10} />
                                                </a>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Opening hours — collapsible */}
                        {pavilion.opening_hours && pavilion.opening_hours.length > 0 && (
                            <div className="bg-white dark:bg-zinc-900/60 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 overflow-hidden">
                                <button
                                    onClick={() => setShowHours(!showHours)}
                                    className="w-full p-5 flex items-center justify-between text-left hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <Clock size={14} className="text-zinc-400" />
                                        <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Horários</span>
                                    </div>
                                    {showHours ? <ChevronUp size={14} className="text-zinc-400" /> : <ChevronDown size={14} className="text-zinc-400" />}
                                </button>
                                {showHours && (
                                    <div className="px-5 pb-4 space-y-1">
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

                        {/* Accessibility */}
                        {accessibilityItems.length > 0 && (
                            <div className="bg-white dark:bg-zinc-900/60 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 p-5">
                                <div className="flex items-center gap-2.5 mb-3">
                                    <Wheelchair size={14} className="text-green-600" />
                                    <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Acessibilidade</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {accessibilityItems.map((item) => (
                                        <span key={item} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-50 dark:bg-green-900/20 text-[11px] font-medium text-green-700 dark:text-green-400">
                                            <BadgeCheck size={11} />
                                            {item}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Services */}
                        {servicesItems.length > 0 && (
                            <div className="bg-white dark:bg-zinc-900/60 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 p-5">
                                <div className="flex items-center gap-2.5 mb-3">
                                    <Trophy size={14} className="text-dribly-purple" />
                                    <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Serviços</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {servicesItems.map((item) => (
                                        <span key={item} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-dribly-purple/10 text-[11px] font-medium text-dribly-purple">
                                            {item}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Parking */}
                        {parkingItems.length > 0 && (
                            <div className="bg-white dark:bg-zinc-900/60 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 p-5">
                                <div className="flex items-center gap-2.5 mb-3">
                                    <span className="text-sm">🅿️</span>
                                    <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Estacionamento</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {parkingItems.map((item) => (
                                        <span key={item} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-[11px] font-medium text-blue-700 dark:text-blue-400">
                                            {item}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Nearby places (peopleAlsoSearch) */}
                        {nearby.length > 0 && (
                            <div className="bg-white dark:bg-zinc-900/60 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 p-5">
                                <div className="flex items-center gap-2.5 mb-3">
                                    <MapPin size={14} className="text-amber-500" />
                                    <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Locais próximos</span>
                                </div>
                                <div className="space-y-1.5">
                                    {nearby.slice(0, 6).map((place, i) => (
                                        <div key={i} className="flex items-center justify-between py-1.5 border-b border-zinc-50 dark:border-white/5 last:border-0">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <MapPin size={11} className="text-zinc-400 shrink-0" />
                                                <span className="text-xs text-zinc-700 dark:text-zinc-300 truncate">{place.title}</span>
                                            </div>
                                            {place.totalScore > 0 && (
                                                <span className="text-[10px] text-zinc-400 shrink-0 ml-2 flex items-center gap-0.5">
                                                    <Star size={9} className="text-amber-500 fill-amber-500" />
                                                    {place.totalScore.toFixed(1)}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Google Maps link */}
                        {pavilion.google_maps_url && (
                            <a href={pavilion.google_maps_url} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs text-dribly-blue hover:underline font-medium">
                                Ver no Google Maps →
                            </a>
                        )}

                        {/* FPB link (legacy) */}
                        {pavilion.fpb_url && (
                            <a href={pavilion.fpb_url} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 ml-4 text-xs text-dribly-purple hover:underline font-medium">
                                Ver na FPB →
                            </a>
                        )}
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
