/**
 * Mapa de Pavilhões — Leaflet + OpenStreetMap (100% gratuito, users ilimitados).
 *
 * Features:
 * - Mapa de Portugal centrado com zoom automático
 * - Clustering: agrupa pins por proximidade, mostra número de pavilhões
 * - Pin click → bottom sheet com jogos futuros no pavilhão
 * - Todos os dados via Supabase (pavilions + games_2025_2026)
 */
import { useEffect, useState, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Loader2 } from 'lucide-react'
import { fetchPavilions, type Pavilion } from '../lib/mapData'
import { PavilionSheet } from '../components/PavilionSheet'

// Fix default marker icons in bundler
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl })

/** Custom Dribly marker icon */
const DRIBLY_ICON = new L.Icon({
    iconUrl: '/logo.svg',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
    className: 'dribly-marker',
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

/** Zoom to bounds of all markers */
function FitBounds({ pavilions }: { pavilions: Pavilion[] }) {
    const map = useMap()

    useEffect(() => {
        if (pavilions.length === 0) return
        const bounds = L.latLngBounds(
            pavilions.map((p) => [p.lat, p.lng] as [number, number])
        )
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 13 })
    }, [map, pavilions])

    return null
}

/** Simple clustering: group pavilions by grid cell at current zoom */
function useClusters(pavilions: Pavilion[], zoom: number): Map<string, Pavilion[]> {
    return useMemo(() => {
        const precision = Math.max(2, Math.min(6, Math.floor(zoom / 3)))
        const clusters = new Map<string, Pavilion[]>()

        for (const p of pavilions) {
            const latR = Math.round(p.lat * precision) / precision
            const lngR = Math.round(p.lng * precision) / precision
            const key = `${latR.toFixed(4)},${lngR.toFixed(4)}`

            if (!clusters.has(key)) clusters.set(key, [])
            clusters.get(key)!.push(p)
        }

        return clusters
    }, [pavilions, zoom])
}

/** Track current zoom level */
function ZoomWatcher({ onZoom }: { onZoom: (z: number) => void }) {
    const map = useMap()
    useEffect(() => {
        onZoom(map.getZoom())
        map.on('zoomend', () => onZoom(map.getZoom()))
    }, [map, onZoom])
    return null
}

export default function Mapa() {
    const [pavilions, setPavilions] = useState<Pavilion[]>([])
    const [loading, setLoading] = useState(true)
    const [zoom, setZoom] = useState(8)
    const [selected, setSelected] = useState<Pavilion | null>(null)
    const [sheetOpen, setSheetOpen] = useState(false)
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

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 size={32} className="animate-spin text-dribly-purple" />
                    <span className="text-sm text-zinc-400">A carregar mapa...</span>
                </div>
            </div>
        )
    }

    return (
        <div className="relative w-full h-[calc(100vh-7rem)] md:h-[calc(100vh-5rem)]">
            {pavilions.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                    <p className="text-sm text-zinc-400">Nenhum pavilhão com localização disponível.</p>
                </div>
            ) : (
                <MapContainer
                    ref={mapRef}
                    center={[39.7, -8.0]}
                    zoom={8}
                    className="w-full h-full"
                    zoomControl={true}
                    scrollWheelZoom={true}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    <FitBounds pavilions={pavilions} />
                    <ZoomWatcher onZoom={setZoom} />

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
                                        // Zoom in to this cluster
                                        const m = mapRef.current
                                        if (m) {
                                            m.flyTo([first.lat, first.lng], zoom + 2, {
                                                duration: 0.5,
                                            })
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

            {/* Bottom Sheet */}
            {selected && (
                <PavilionSheet
                    pavilion={selected}
                    isOpen={sheetOpen}
                    onClose={() => setSheetOpen(false)}
                />
            )}
        </div>
    )
}
