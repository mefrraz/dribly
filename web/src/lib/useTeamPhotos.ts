import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { fetchTeams, type FPBTeam } from './fpbCompetitionsApi'

const CACHE_KEY = 'dribly_team_photos_v3'
const CACHE_TTL = 10 * 60 * 1000

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

function extractTeamIdFromName(fullName: string, clubName: string): string {
    const upperTeam = normalize(fullName)
    const upperClub = normalize(clubName)
    let suffix = upperTeam
        .replace(new RegExp(upperClub.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '')
        .replace(/^[\s\-–—/]+/, '')
        .replace(/[\s\-–—/]+$/, '')
        .trim()
    if (!suffix || suffix.length < 2) suffix = normalize(fullName)
    return suffix
}

/** Build lookup keys: try many variations to maximize match probability */
function buildKeys(nome: string, clubName: string): string[] {
    const clean = nome.replace(/\s+/g, ' ').trim()
    const id = extractTeamIdFromName(clean, clubName)
    const norm = normalize(clean)
    const keys = new Set<string>()

    // Exact forms
    keys.add(id)
    keys.add(id.toLowerCase())
    keys.add(id.toUpperCase())
    keys.add(clean)
    keys.add(clean.toLowerCase())
    keys.add(clean.toUpperCase())
    keys.add(norm)

    // Without gender suffix (e.g., "SENIOR MASCULINO" → "SENIOR")
    const noGender = id.replace(/\s+(MASCULINO|FEMININO)\s*$/i, '').trim()
    if (noGender && noGender !== id) {
        keys.add(noGender)
        keys.add(noGender.toLowerCase())
    }

    return Array.from(keys)
}

export function useTeamPhotos(clubName: string): { photos: PhotoMap; loading: boolean } {
    const [photos, setPhotos] = useState<PhotoMap>({})
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const key = clubName.toLowerCase().trim()
        const cache = getCache()
        if (cache[key] && Date.now() - cache[key].ts < CACHE_TTL) {
            setPhotos(cache[key].map)
            setLoading(false)
            return
        }

        let cancelled = false

        async function run() {
            try {
                const { data, error } = await supabase
                    .from('competitions')
                    .select('competition_id')
                    .contains('club_names', [clubName])
                    .eq('season', '2025/2026')

                if (error || !data || data.length === 0) {
                    if (!cancelled) setLoading(false)
                    return
                }

                const photoMap: PhotoMap = {}
                const seen = new Set<number>()
                for (const row of data) {
                    if (cancelled) return
                    if (seen.has(row.competition_id)) continue
                    seen.add(row.competition_id)
                    try {
                        const teams: FPBTeam[] = await fetchTeams(row.competition_id)
                        for (const t of teams) {
                            if (t.photo && t.nome && !t.photo.includes('ass_highlight_default')) {
                                const keys = buildKeys(t.nome, clubName)
                                for (const k of keys) {
                                    if (!photoMap[k]) photoMap[k] = t.photo
                                }
                            }
                        }
                    } catch { /* skip failed comps */ }
                }

                if (!cancelled) {
                    setCache(key, photoMap)
                    setPhotos(photoMap)
                }
            } catch {} finally {
                if (!cancelled) setLoading(false)
            }
        }

        run()
        return () => { cancelled = true }
    }, [clubName])

    return { photos, loading }
}
