/**
 * Mapa de Pavilhões — Leaflet + CartoDB tiles (gratuito, users ilimitados).
 *
 * Features:
 * - Mapa de Portugal centrado com zoom automático
 * - Clustering: agrupa pins por proximidade, mostra número de pavilhões
 * - Marcadores coloridos: roxo (jogos futuros), cinza (sem jogos)
 * - Botão "Localizar-me" com geolocalização do browser
 * - Filtro por distrito/concelho
 * - Pin click → bottom sheet com jogos futuros no pavilhão
 * - Todos os dados via Supabase (pavilions + games_2025_2026)
 */
import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Search, X, MapPin, Navigation, Filter } from 'lucide-react'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { SeoHead } from '../components/SeoHead'
import { fetchPavilions, type Pavilion, displayPavilionName } from '../lib/mapData'
import { PavilionSheet } from '../components/PavilionSheet'
import { supabase } from '../lib/supabase'

/** Active pavilion marker — purple with glow */
function activeIcon(): L.DivIcon {
    return L.divIcon({
        html: `<div style="
            width:14px;height:14px;
            background:#7C3AED;
            border:2.5px solid white;
            border-radius:50%;
            box-shadow:0 0 8px rgba(124,58,237,0.6), 0 1px 4px rgba(0,0,0,0.3);
        "></div>`,
        className: '',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
    })
}

/** Inactive pavilion marker — gray */
function inactiveIcon(): L.DivIcon {
    return L.divIcon({
        html: `<div style="
            width:10px;height:10px;
            background:#9CA3AF;
            border:2px solid white;
            border-radius:50%;
            box-shadow:0 1px 3px rgba(0,0,0,0.2);
        "></div>`,
        className: '',
        iconSize: [10, 10],
        iconAnchor: [5, 5],
    })
}

/** Cluster icon factory — gradient based on count */
function clusterIcon(count: number): L.DivIcon {
    const colors: Record<string, string> = {
        small: count < 5 ? '#6366F1' : '',
        medium: count >= 5 && count < 20 ? '#7C3AED' : '',
        large: count >= 20 ? '#A855F7' : '',
    }
    const color = colors.small || colors.medium || colors.large || '#7C3AED'
    const size = count < 10 ? 36 : count < 30 ? 44 : 52
    return L.divIcon({
        html: `<div style="
            width:${size}px;height:${size}px;
            background:${color};
            border:3px solid white;
            border-radius:50%;
            display:flex;align-items:center;justify-content:center;
            color:white;font-weight:800;font-size:${size > 40 ? 14 : 12}px;
            box-shadow:0 2px 8px rgba(124,58,237,0.4);
        ">${count}</div>`,
        className: '',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
    })
}

/** Fit bounds on first load only */
function FitBounds({ pavilions, skip }: { pavilions: Pavilion[]; skip: boolean }) {
    const map = useMap()
    useEffect(() => {
        if (skip || pavilions.length === 0) return
        const bounds = L.latLngBounds(pavilions.map((p) => [p.lat, p.lng] as [number, number]))
        const isNarrow = typeof window !== 'undefined' && window.innerWidth < 768
        map.whenReady(() => {
            setTimeout(() => map.fitBounds(bounds, {
                padding: isNarrow ? [15, 15] : [30, 30],
                maxZoom: isNarrow ? 7 : 13,
            }), 300)
        })
    }, [map, pavilions, skip])
    return null
}

/** Cluster pavilions by proximity. At zoom >= 17 every pavilion gets its own marker. */
function useClusters(pavilions: Pavilion[], zoom: number): Map<string, Pavilion[]> {
    return useMemo(() => {
        // At high zoom, don't cluster — show individual pins
        const SINGLE_MARKER_ZOOM = 17
        if (zoom >= SINGLE_MARKER_ZOOM) {
            const singles = new Map<string, Pavilion[]>()
            for (const p of pavilions) {
                singles.set(`${p.id}`, [p])
            }
            return singles
        }
        const precision = Math.max(2, Math.pow(2, zoom - 5))
        const clusters = new Map<string, Pavilion[]>()
        for (const p of pavilions) {
            const latR = Math.round(p.lat * precision) / precision
            const lngR = Math.round(p.lng * precision) / precision
            const decimals = Math.max(3, Math.ceil(Math.log10(precision)) + 1)
            const key = `${latR.toFixed(decimals)},${lngR.toFixed(decimals)}`
            if (!clusters.has(key)) clusters.set(key, [])
            clusters.get(key)!.push(p)
        }
        return clusters
    }, [pavilions, zoom])
}

/**
 * Merge single-pavilion clusters that share the exact same coordinates
 * into "co-located" groups. Returns a new cluster map where co-located
 * pavilions are grouped together under a coordinate-based key.
 */
function useCoLocatedClusters(
    clusters: Map<string, Pavilion[]>,
): Map<string, Pavilion[]> {
    return useMemo(() => {
        const merged = new Map(clusters)
        const coordMap = new Map<string, { key: string; group: Pavilion[] }>()

        // Find singles at same coordinates
        for (const [key, group] of merged) {
            if (group.length !== 1) continue
            const p = group[0]
            const coordKey = `${p.lat.toFixed(7)},${p.lng.toFixed(7)}`
            if (!coordMap.has(coordKey)) {
                coordMap.set(coordKey, { key, group: [] })
            }
            coordMap.get(coordKey)!.group.push(p)
        }

        // Replace co-located singles with a merged group
        for (const [, entry] of coordMap) {
            if (entry.group.length <= 1) continue
            // Remove individual keys, add merged key
            for (const p of entry.group) {
                merged.delete(`${p.id}`)
            }
            const mergedKey = entry.group.map(p => `${p.id}`).sort().join('+')
            merged.set(mergedKey, entry.group)
        }

        return merged
    }, [clusters])
}

/** Co-located pavilion badge — amber, smaller than regular clusters */
function coLocatedClusterIcon(count: number): L.DivIcon {
    return L.divIcon({
        html: `<div style="
            width:22px;height:22px;
            background:#F59E0B;
            border:2px solid white;
            border-radius:50%;
            display:flex;align-items:center;justify-content:center;
            color:white;font-weight:800;font-size:11px;
            box-shadow:0 2px 6px rgba(245,158,11,0.5);
        ">${count}</div>`,
        className: '',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
    })
}

/** Track zoom + sync position to URL */
function ZoomWatcher({ onZoom, onMove }: { onZoom: (z: number) => void; onMove: (map: L.Map) => void }) {
    const map = useMap()
    useEffect(() => {
        onZoom(map.getZoom())
        const handler = () => { onZoom(map.getZoom()); onMove(map) }
        map.on('moveend', handler)
        return () => { map.off('moveend', handler) }
    }, [map, onZoom, onMove])
    return null
}

/** Geolocation button — centers map on user's position */
function LocateButton({ mapRef }: { mapRef: React.RefObject<L.Map | null> }) {
    const [locating, setLocating] = useState(false)
    const [hasLocated, setHasLocated] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleLocate = () => {
        if (!navigator.geolocation) {
            setError('Geolocalização não disponível neste dispositivo.')
            setTimeout(() => setError(null), 4000)
            return
        }
        setLocating(true)
        setError(null)
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const m = mapRef.current
                if (m) {
                    m.flyTo([pos.coords.latitude, pos.coords.longitude], 15, { duration: 1 })
                    setTimeout(() => {
                        L.circleMarker([pos.coords.latitude, pos.coords.longitude], {
                            radius: 8,
                            color: '#3B82F6',
                            fillColor: '#3B82F6',
                            fillOpacity: 0.3,
                            weight: 2,
                        }).addTo(m)
                    }, 1100)
                }
                setLocating(false)
                setHasLocated(true)
            },
            (err) => {
                setLocating(false)
                const messages: Record<number, string> = {
                    1: 'Permissão negada. Verifica as definições de privacidade.',
                    2: 'Posição indisponível. Tenta outra vez.',
                    3: 'Tempo esgotado. Verifica a ligação.',
                }
                setError(messages[err.code] || 'Erro ao obter localização.')
                setTimeout(() => setError(null), 4000)
            },
            { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
        )
    }

    return (
        <div className="relative shrink-0">
            <button
                onClick={handleLocate}
                disabled={locating}
                className="p-2.5 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-200 dark:border-white/10 rounded-xl shadow-lg hover:bg-white dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                title="Localizar-me"
            >
                <Navigation size={18} className={locating ? 'animate-spin text-dribly-purple' : hasLocated ? 'text-blue-500' : 'text-dribly-purple'} />
            </button>
            {error && (
                <div className="absolute top-full right-0 mt-1.5 w-56 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-[11px] text-red-700 dark:text-red-300 shadow-lg whitespace-normal">
                    {error}
                </div>
            )}
        </div>
    )
}

export default function Mapa() {
    const [searchParams, setSearchParams] = useSearchParams()
    const [pavilions, setPavilions] = useState<Pavilion[]>([])
    const [activePavilionIds, setActivePavilionIds] = useState<Set<number>>(new Set())
    const [loading, setLoading] = useState(true)
    const [zoom, setZoom] = useState(() => Number(searchParams.get('z')) || 8)
    const [center] = useState<[number, number]>(() => {
        const lat = searchParams.get('lat')
        const lng = searchParams.get('lng')
        return lat && lng ? [parseFloat(lat), parseFloat(lng)] : [39.7, -8.0]
    })
    const [selected, setSelected] = useState<Pavilion | null>(null)
    const [sheetOpen, setSheetOpen] = useState(false)
    const [coLocatedGroup, setCoLocatedGroup] = useState<Pavilion[] | null>(null)
    const [initialFitDone] = useState(!!searchParams.get('z'))
    const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
    const [darkMode, setDarkMode] = useState(isDark)
    const [searchQuery, setSearchQuery] = useState('')
    const [searchOpen, setSearchOpen] = useState(false)
    const [showFilters, setShowFilters] = useState(false)
    const [selectedDistrict, setSelectedDistrict] = useState('')
    const mapRef = useRef<L.Map | null>(null)

    useEffect(() => {
        const observer = new MutationObserver(() => {
            setDarkMode(document.documentElement.classList.contains('dark'))
        })
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
        return () => observer.disconnect()
    }, [])

    useEffect(() => {
        Promise.all([
            fetchPavilions(),
            supabase.from('games_2025_2026').select('local').not('local', 'is', null).gte('data', new Date().toISOString().split('T')[0])
        ]).then(([pavs, { data: gamesData }]) => {
            setPavilions(pavs)
            // Build set of pavilion IDs that have upcoming games (match by name)
            if (gamesData) {
                const activeIds = new Set<number>()
                const gameLocals = new Set((gamesData as { local: string | null }[]).map((g) => g.local?.toLowerCase().trim()).filter(Boolean) as string[])
                for (const p of pavs) {
                    const cleanName = p.nome.replace(/^Pavilhão\s+/i, '').replace(/^Pav\.\s*/i, '').toLowerCase().trim()
                    if (gameLocals.has(cleanName) || Array.from(gameLocals).some(l => l.includes(cleanName) || cleanName.includes(l))) {
                        activeIds.add(p.id)
                    }
                }
                setActivePavilionIds(activeIds)
            }
            setLoading(false)
        })
    }, [])

    // Unique districts for filter
    const districts = useMemo(() => {
        const set = new Set<string>()
        for (const p of pavilions) {
            if (p.distrito) set.add(p.distrito)
        }
        return Array.from(set).sort()
    }, [pavilions])

    // Filtered pavilions
    const filteredPavilions = useMemo(() => {
        if (!selectedDistrict) return pavilions
        return pavilions.filter(p => p.distrito === selectedDistrict)
    }, [pavilions, selectedDistrict])

    const clusters = useClusters(filteredPavilions, zoom)
    const coLocatedClusters = useCoLocatedClusters(clusters)

    const handleMarkerClick = (pavilion: Pavilion) => {
        setSelected(pavilion)
        setSheetOpen(true)
    }

    const flyToPavilion = useCallback((p: Pavilion) => {
        const m = mapRef.current
        if (m) {
            m.flyTo([p.lat, p.lng], 16, { duration: 0.8 })
            setTimeout(() => { setSelected(p); setSheetOpen(true) }, 900)
        }
    }, [])

    const syncToUrl = useCallback((map: L.Map) => {
        const c = map.getCenter()
        const z = map.getZoom()
        setSearchParams({ lat: c.lat.toFixed(5), lng: c.lng.toFixed(5), z: String(z) }, { replace: true })
    }, [setSearchParams])

    const searchResults = useMemo(() => {
        if (!searchQuery.trim()) return []
        const q = searchQuery.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        return pavilions.filter((p) => {
            const name = displayPavilionName(p).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            const city = (p.cidade || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            return name.includes(q) || city.includes(q)
        }).slice(0, 8)
    }, [searchQuery, pavilions])

    if (loading) {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 z-10">
                <LoadingSpinner message="A carregar mapa..." size={32} />
            </div>
        )
    }

    return (
        <>
        <SeoHead title="Mapa de Pavilhões" description="Mais de 400 pavilhões de basquetebol em Portugal. Encontra jogos perto de ti." />
        <div style={{ position: 'fixed', top: '3.5rem', bottom: 0, left: 0, right: 0, zIndex: 10 }} className="md:top-16">

            {/* Top bar: search + locate + filter */}
            <div className="absolute top-7 left-3 right-3 md:left-4 md:right-auto z-[1100] flex items-start gap-2">
                {/* Search bar */}
                <div className="relative flex-1 md:flex-none md:w-72">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input type="text" value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true) }}
                        onFocus={() => searchQuery.trim() && setSearchOpen(true)}
                        onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
                        placeholder="Pesquisar pavilhões..."
                        className="w-full pl-9 pr-8 py-2.5 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-200 dark:border-white/10 rounded-xl text-sm text-zinc-900 dark:text-white placeholder-zinc-400 outline-none shadow-lg transition-all focus:ring-2 focus:ring-dribly-purple/30"
                    />
                    {searchQuery && (
                        <button onClick={() => { setSearchQuery(''); setSearchOpen(false) }}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                            <X size={14} />
                        </button>
                    )}
                    {searchOpen && searchResults.length > 0 && (
                        <div className="absolute top-full mt-1.5 left-0 right-0 md:w-72 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-200 dark:border-white/10 rounded-xl shadow-xl overflow-hidden max-h-[50vh] overflow-y-auto">
                            {searchResults.map((p) => (
                                <button key={p.id} onMouseDown={() => { setSearchQuery(''); setSearchOpen(false); flyToPavilion(p) }}
                                    className="w-full text-left px-3.5 py-2.5 flex items-center gap-3 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors">
                                    <MapPin size={14} className="text-dribly-purple shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">{displayPavilionName(p)}</p>
                                        <p className="text-[10px] text-zinc-400 truncate">{p.cidade}{p.distrito ? `, ${p.distrito}` : ''}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Locate button */}
                <LocateButton mapRef={mapRef} />

                {/* Filter button */}
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`shrink-0 p-2.5 rounded-xl shadow-lg border border-zinc-200 dark:border-white/10 transition-colors ${showFilters ? 'bg-dribly-purple text-white' : 'bg-white/95 dark:bg-zinc-900/95 text-dribly-purple'}`}
                    title="Filtrar por distrito"
                >
                    <Filter size={18} />
                </button>
            </div>

            {/* District filter dropdown */}
            {showFilters && (
                <div className="absolute top-[5rem] left-3 right-3 md:left-4 md:right-auto md:w-52 z-[1100] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-200 dark:border-white/10 rounded-xl shadow-xl p-2 max-h-[40vh] overflow-y-auto">
                    <button
                        onClick={() => { setSelectedDistrict(''); setShowFilters(false) }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${!selectedDistrict ? 'bg-dribly-purple text-white' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5'}`}
                    >
                        Todos os distritos
                    </button>
                    {districts.map(d => (
                        <button key={d}
                            onClick={() => { setSelectedDistrict(d); setShowFilters(false) }}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${selectedDistrict === d ? 'bg-dribly-purple text-white' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5'}`}
                        >
                            {d}
                        </button>
                    ))}
                </div>
            )}

            {/* Map */}
            {filteredPavilions.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                    <p className="text-sm text-zinc-400">Nenhum pavilhão neste distrito.</p>
                </div>
            ) : (
                <MapContainer center={center} zoom={zoom} minZoom={5} maxZoom={18} ref={mapRef}
                    className="w-full h-full" zoomControl={true} scrollWheelZoom={true}>
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
                        url={darkMode ? 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png' : 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png'}
                    />
                    <FitBounds pavilions={filteredPavilions} skip={initialFitDone || !!selectedDistrict} />
                    <ZoomWatcher onZoom={setZoom} onMove={syncToUrl} />

                    {Array.from(coLocatedClusters.entries()).map(([key, group]) => {
                        const first = group[0]
                        // Co-located group: multiple pavilions at exact same coordinates
                        const isCoLocated = group.length > 1 && key.includes('+')
                        if (isCoLocated) {
                            return (
                                <Marker key={key} position={[first.lat, first.lng]}
                                    icon={coLocatedClusterIcon(group.length)}
                                    eventHandlers={{
                                        click: () => {
                                            // Show floating popup instead of zooming in
                                            setCoLocatedGroup(group)
                                        },
                                    }}
                                />
                            )
                        }
                        // Normal single marker
                        if (group.length === 1) {
                            const isActive = activePavilionIds.has(first.id)
                            return (
                                <Marker key={key} position={[first.lat, first.lng]}
                                    icon={isActive ? activeIcon() : inactiveIcon()}
                                    eventHandlers={{ click: () => handleMarkerClick(first) }}
                                />
                            )
                        }
                        // Normal geographic cluster
                        return (
                            <Marker key={key} position={[first.lat, first.lng]}
                                icon={clusterIcon(group.length)}
                                eventHandlers={{
                                    click: () => {
                                        const m = mapRef.current
                                        if (m) m.flyTo([first.lat, first.lng], Math.min(zoom + 3, 18), { duration: 0.5 })
                                    },
                                }}
                            />
                        )
                    })}
                </MapContainer>
            )}

            {/* Map footer bar — floating card on the left */}
            <div className="absolute bottom-20 md:bottom-4 left-4 z-[1000] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-200 dark:border-white/10 rounded-xl px-3 py-2 flex items-center gap-3 text-[10px] text-zinc-500 dark:text-zinc-400 shadow-lg">
                <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#7C3AED] shadow-sm shadow-purple-500/50" />
                    {activePavilionIds.size} com jogos
                </span>
                <span className="w-px h-3 bg-zinc-300 dark:bg-zinc-700" />
                <span className="flex items-center gap-1.5">
                    <Search size={10} className="text-dribly-purple" />
                    Pesquisa por nome
                </span>
                <span className="w-px h-3 bg-zinc-300 dark:bg-zinc-700" />
                <span className="flex items-center gap-1.5">
                    <MapPin size={10} className="text-dribly-purple" />
                    Clique num ponto
                </span>
            </div>

        </div>

        {/* Co-located pavilion popup — floating card with list of pavilions */}
        {coLocatedGroup && coLocatedGroup.length > 1 && (
            <div className="absolute bottom-28 md:bottom-16 left-1/2 -translate-x-1/2 z-[1200] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-amber-200 dark:border-amber-800 rounded-2xl shadow-2xl p-3 min-w-[240px] max-w-[320px] animate-slide-up">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                        {coLocatedGroup.length} pavilhões neste local
                    </span>
                    <button
                        onClick={() => setCoLocatedGroup(null)}
                        className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                    >
                        <X size={14} />
                    </button>
                </div>
                <div className="space-y-0.5">
                    {coLocatedGroup.map((p) => (
                        <button
                            key={p.id}
                            onClick={() => {
                                setCoLocatedGroup(null)
                                handleMarkerClick(p)
                            }}
                            className="w-full text-left px-3 py-2 rounded-xl hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors flex items-center gap-3"
                        >
                            <MapPin size={14} className="text-dribly-purple shrink-0" />
                            <span className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                                {displayPavilionName(p)}
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        )}

        {selected && (
            <PavilionSheet pavilion={selected} isOpen={sheetOpen} onClose={() => setSheetOpen(false)} />
        )}
    </>)
}
