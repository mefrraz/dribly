import { useState, useEffect } from 'react'

interface GeoState {
    lat: number | null
    lng: number | null
    error: string | null
    loading: boolean
}

/**
 * Browser geolocation hook.
 * Returns user's coordinates or error if denied/unavailable.
 */
export function useGeolocation(): GeoState {
    const [state, setState] = useState<GeoState>({ lat: null, lng: null, error: null, loading: true })

    useEffect(() => {
        if (!('geolocation' in navigator)) {
            setState({ lat: null, lng: null, error: 'Geolocalização não suportada', loading: false })
            return
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => setState({ lat: pos.coords.latitude, lng: pos.coords.longitude, error: null, loading: false }),
            (err) => setState({ lat: null, lng: null, error: err.message, loading: false }),
            { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }, // cache 5 min, low accuracy ok
        )
    }, [])

    return state
}

/**
 * Haversine distance in km between two lat/lng points.
 */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Normalize a location/pavilion name for fuzzy matching:
 * lowercase, remove accents, strip common prefixes.
 */
export function normalizeLocation(s: string): string {
    return s.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
        .replace(/^pavilhão\s+/i, '').replace(/^pav\.?\s*/i, '')
        .replace(/^mun\.?\s*/i, '').replace(/^municipal\s+/i, '')
        .replace(/\s+/g, ' ').trim()
}
