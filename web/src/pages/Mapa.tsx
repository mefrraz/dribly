/**
 * Mapa de Pavilhões — Leaflet + OpenStreetMap (100% gratuito, users ilimitados).
 *
 * Features:
 * - Mapa de Portugal centrado com zoom automático
 * - Clustering: agrupa pins por proximidade, mostra número de pavilhões
 * - Pin click → bottom sheet com jogos futuros no pavilhão
 * - Todos os dados via Supabase (pavilions + games_2025_2026)
 */
import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Loader2, Search, X, MapPin } from 'lucide-react'
import { fetchPavilions, type Pavilion, displayPavilionName } from '../lib/mapData'
import { PavilionSheet } from '../components/PavilionSheet'

/** Custom Dribly marker — purple circle with border */
const DRIBLY_ICON = L.divIcon({
    html: `<div style="
        width:12px;height:12px;
        background:#7C3AED;
        border:2px solid white;
        border-radius:50%;
        box-shadow:0 1px 4px rgba(0,0,0,0.3);
    "></div>`,
    className: '',
    iconSize: [12, 12],
    iconAnchor: [6, 6],
})

/** Cluster icon factory */
function clusterIcon(count: number): L.DivIcon {
    const size = count < 10 ? 36 : count < 30 ? 44 : 52
    return L.divIcon({
        html: `<div style="
            width:${size}px;height:${size}px;
            background:#7C3AED;
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

/** Fit bounds on first load only — respects URL-stored position on back-navigation */
function FitBounds({ pavilions, skip }: { pavilions: Pavilion[]; skip: boolean }) {
    const map = useMap()

    useEffect(() => {
        if (skip || pavilions.length === 0) return
        const bounds = L.latLngBounds(
            pavilions.map((p) => [p.lat, p.lng] as [number, number])
        )
        map.whenReady(() => {
            setTimeout(() => {
                map.fitBounds(bounds, { padding: [30, 30], maxZoom: 13 })
            }, 300)
        })
    }, [map, pavilions, skip])

    return null
}

/**
 * Cluster pavilions by proximity at current zoom using grid-based bucketing.
 * Formula: cell_size ≈ 14km at zoom 8, 220m at zoom 14, 14m at zoom 18.
 *
 *   zoom 8  → precision 8       → cell ~14km (district level)
 *   zoom 10 → precision 32      → cell ~3.5km (concelho level)
 *   zoom 12 → precision 128     → cell ~870m (neighborhood)
 *   zoom 14 → precision 512     → cell ~220m (individual pavilions start showing)
 *   zoom 16 → precision 2048    → cell ~55m (all individual)
 */
function useClusters(pavilions: Pavilion[], zoom: number): Map<string, Pavilion[]> {
    return useMemo(() => {
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

/** Track zoom + sync position to URL */
function ZoomWatcher({ onZoom, onMove }: { onZoom: (z: number) => void; onMove: (map: L.Map) => void }) {
    const map = useMap()
    useEffect(() => {
        onZoom(map.getZoom())
        const handler = () => {
            onZoom(map.getZoom())
            onMove(map)
        }
        map.on('moveend', handler)
        return () => { map.off('moveend', handler) }
    }, [map, onZoom, onMove])
    return null
}

export default function Mapa() {
    const [searchParams, setSearchParams] = useSearchParams()
    const [pavilions, setPavilions] = useState<Pavilion[]>([])
    const [loading, setLoading] = useState(true)
    const [zoom, setZoom] = useState(() => Number(searchParams.get('z')) || 8)
    const [center] = useState<[number, number]>(() => {
        const lat = searchParams.get('lat')
        const lng = searchParams.get('lng')
        return lat && lng ? [parseFloat(lat), parseFloat(lng)] : [39.7, -8.0]
    })
    const [selected, setSelected] = useState<Pavilion | null>(null)
    const [sheetOpen, setSheetOpen] = useState(false)
    const [initialFitDone] = useState(!!searchParams.get('z'))
    const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
    const [darkMode, setDarkMode] = useState(isDark)
    const [searchQuery, setSearchQuery] = useState('')
    const [searchOpen, setSearchOpen] = useState(false)
    
    useEffect(() => {
        const observer = new MutationObserver(() => {
            setDarkMode(document.documentElement.classList.contains('dark'))
        })
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
        return () => observer.disconnect()
    }, [])
    const mapRef = useRef<any>(null)

    useEffect(() => {
        fetchPavilions().then((data) => {
            setPavilions(data)
            setLoading(false)
        })
    }, [])

    const clusters = useClusters(pavilions, zoom)

    const handleMarkerClick = (pavilion: Pavilion) => {
        setSelected(pavilion)
        setSheetOpen(true)
    }

    /** Fly to a pavilion on the map */
    const flyToPavilion = useCallback((p: Pavilion) => {
        const m = mapRef.current
        if (m) {
            m.flyTo([p.lat, p.lng], 16, { duration: 0.8 })
            setTimeout(() => {
                setSelected(p)
                setSheetOpen(true)
            }, 900)
        }
    }, [])

    /** Sync map position to URL so back-navigation restores the exact view */
    const syncToUrl = useCallback((map: L.Map) => {
        const c = map.getCenter()
        const z = map.getZoom()
        setSearchParams({ lat: c.lat.toFixed(5), lng: c.lng.toFixed(5), z: String(z) }, { replace: true })
    }, [setSearchParams])

    // Filtered pavilions for search
    const searchResults = useMemo(() => {
        if (!searchQuery.trim()) return []
        const q = searchQuery.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        return pavilions
            .filter((p) => {
                const name = displayPavilionName(p).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                const city = (p.cidade || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                return name.includes(q) || city.includes(q)
            })
            .slice(0, 8)
    }, [searchQuery, pavilions])

    if (loading) {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 z-10">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 size={32} className="animate-spin text-dribly-purple" />
                    <span className="text-sm text-zinc-400">A carregar mapa...</span>
                </div>
            </div>
        )
    }

    return (
        <>
        {/* Full-screen map between navbars */}
        <div style={{
            position: 'fixed',
            top: '3.5rem',
            bottom: '4rem',
            left: 0,
            right: 0,
            zIndex: 10,
        }} className="md:top-16 md:bottom-0">

            {/* Search bar — floats over map */}
            <div className="absolute top-3 left-3 right-3 md:left-4 md:right-auto md:w-80 z-[1000]">
                <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true) }}
                        onFocus={() => searchQuery.trim() && setSearchOpen(true)}
                        onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
                        placeholder="Pesquisar pavilhões..."
                        className="w-full pl-9 pr-4 py-2.5 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-200 dark:border-white/10 rounded-xl text-sm text-zinc-900 dark:text-white placeholder-zinc-400 outline-none shadow-lg transition-all focus:ring-2 focus:ring-dribly-purple/30"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => { setSearchQuery(''); setSearchOpen(false) }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>

                {/* Search results dropdown */}
                {searchOpen && searchResults.length > 0 && (
                    <div className="mt-1.5 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-200 dark:border-white/10 rounded-xl shadow-xl overflow-hidden max-h-[50vh] overflow-y-auto">
                        {searchResults.map((p) => (
                            <button
                                key={p.id}
                                onMouseDown={() => {
                                    setSearchQuery('')
                                    setSearchOpen(false)
                                    flyToPavilion(p)
                                }}
                                className="w-full text-left px-3.5 py-2.5 flex items-center gap-3 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors"
                            >
                                <MapPin size={14} className="text-dribly-purple shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                                        {displayPavilionName(p)}
                                    </p>
                                    <p className="text-[10px] text-zinc-400 truncate">{p.cidade}{p.distrito ? `, ${p.distrito}` : ''}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Map */}
            {pavilions.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                    <p className="text-sm text-zinc-400">Nenhum pavilhão com localização disponível.</p>
                </div>
            ) : (
                <MapContainer
                    center={center}
                    zoom={zoom}
                    minZoom={6}
                    maxZoom={18}
                    ref={mapRef}
                    className="w-full h-full"
                    zoomControl={true}
                    scrollWheelZoom={true}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
                        url={darkMode
                            ? 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
                            : 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png'
                        }
                    />

                    <FitBounds pavilions={pavilions} skip={initialFitDone} />
                    <ZoomWatcher onZoom={setZoom} onMove={syncToUrl} />

                    {/* Render clusters */}
                    {Array.from(clusters.entries()).map(([key, group]) => {
                        const first = group[0]
                        if (group.length === 1) {
                            return (
                                <Marker
                                    key={key}
                                    position={[first.lat, first.lng]}
                                    icon={DRIBLY_ICON}
                                    eventHandlers={{ click: () => handleMarkerClick(first) }}
                                />
                            )
                        }

                        // Cluster
                        return (
                            <Marker
                                key={key}
                                position={[first.lat, first.lng]}
                                icon={clusterIcon(group.length)}
                                eventHandlers={{
                                    click: () => {
                                        const m = mapRef.current
                                        if (m) {
                                            m.flyTo([first.lat, first.lng], Math.min(zoom + 3, 18), { duration: 0.5 })
                                        }
                                    },
                                }}
                            />
                        )
                    })}
                </MapContainer>
            )}

            {/* Legend */}
            <div className="absolute bottom-4 left-4 z-[1000] bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md rounded-xl px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400 shadow-lg border border-zinc-200 dark:border-white/10">
                <p><span className="font-bold text-dribly-purple">{pavilions.length}</span> pavilhões mapeados</p>
                <p className="text-[10px] mt-0.5">232 com coordenadas exatas</p>
            </div>

        </div>

        {/* Sheet — rendered OUTSIDE the map div, at root stacking level */}
        {selected && (
            <PavilionSheet
                pavilion={selected}
                isOpen={sheetOpen}
                onClose={() => setSheetOpen(false)}
            />
        )}
    </>)
}
