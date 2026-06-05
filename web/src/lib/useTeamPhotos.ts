import { useState, useEffect } from 'react'
import { fetchClubTeamPhotos } from './fpbCompetitionsApi'

const CACHE_KEY = 'dribly_team_photos_v4'
const CACHE_TTL = 30 * 60 * 1000 // 30 minutes

interface PhotoMap {
    [teamId: string]: string
}

function getCache(): Record<string, { ts: number; map: PhotoMap }> {
    try {
        return JSON.parse(sessionStorage.getItem(CACHE_KEY) || '{}')
    } catch { return {} }
}

function setCache(clubKey: string, map: PhotoMap) {
    const cache = getCache()
    cache[clubKey] = { ts: Date.now(), map }
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache)) } catch {}
}

function normalize(text: string): string {
    return text.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()
}

/** Build lookup keys: try many variations to maximize match probability */
function buildKeys(nome: string, clubName: string): string[] {
    const clean = nome.replace(/\s+/g, ' ').trim()
    const upperClub = normalize(clubName)
    let id = normalize(clean)
        .replace(new RegExp(upperClub.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '')
        .replace(/^[\s\-–—/]+/, '')
        .replace(/[\s\-–—/]+$/, '')
        .trim()
    if (!id || id.length < 2) id = normalize(clean)

    const keys = new Set<string>()
    keys.add(id)
    keys.add(id.toLowerCase())
    keys.add(id.toUpperCase())
    keys.add(clean)
    keys.add(clean.toLowerCase())
    keys.add(normalize(clean))

    const noGender = id.replace(/\s+(MASCULINO|FEMININO)\s*$/i, '').trim()
    if (noGender && noGender !== id) {
        keys.add(noGender)
        keys.add(noGender.toLowerCase())
    }

    return Array.from(keys)
}

export function useTeamPhotos(clubId: number, clubName: string): { photos: PhotoMap; loading: boolean } {
    const [photos, setPhotos] = useState<PhotoMap>({})
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!clubId) return

        const key = `${clubName.toLowerCase().trim()}_${clubId}`
        const cache = getCache()
        if (cache[key] && Date.now() - cache[key].ts < CACHE_TTL) {
            setPhotos(cache[key].map)
            setLoading(false)
            return
        }

        let cancelled = false

        async function run() {
            try {
                const teams = await fetchClubTeamPhotos(clubId)
                if (cancelled) return

                const photoMap: PhotoMap = {}
                for (const t of teams) {
                    if (t.photo_url) {
                        const keys = buildKeys(t.nome, clubName)
                        for (const k of keys) {
                            if (!photoMap[k]) photoMap[k] = t.photo_url
                        }
                    }
                }

                setCache(key, photoMap)
                setPhotos(photoMap)
            } catch {} finally {
                if (!cancelled) setLoading(false)
            }
        }

        run()
        return () => { cancelled = true }
    }, [clubId, clubName])

    return { photos, loading }
}
