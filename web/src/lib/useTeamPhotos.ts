import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { fetchTeams, type FPBTeam } from './fpbCompetitionsApi'

const CACHE_KEY = 'dribly_team_photos_v5'
const CACHE_TTL = 30 * 60 * 1000

interface PhotoMap { [teamId: string]: string }

function getCache(): Record<string, { ts: number; map: PhotoMap }> {
    try { return JSON.parse(sessionStorage.getItem(CACHE_KEY) || '{}') } catch { return {} }
}
function setCache(clubKey: string, map: PhotoMap) {
    const cache = getCache()
    cache[clubKey] = { ts: Date.now(), map }
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache)) } catch {}
}

function normalize(text: string): string {
    return text.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()
}

/** Build multiple lookup keys from a team name and club name */
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
    keys.add(id); keys.add(id.toLowerCase()); keys.add(id.toUpperCase())
    keys.add(clean); keys.add(clean.toLowerCase()); keys.add(normalize(clean))

    const noGender = id.replace(/\s+(MASCULINO|FEMININO)\s*$/i, '').trim()
    if (noGender && noGender !== id) {
        keys.add(noGender); keys.add(noGender.toLowerCase())
    }
    // Also try just the escalão part (e.g., "SENIOR" from "SENIOR MASCULINO")
    const escParts = id.split(/\s+/)
    if (escParts.length >= 2) {
        const esc = escParts[0]
        keys.add(esc); keys.add(esc.toLowerCase())
    }

    return Array.from(keys)
}

export function useTeamPhotos(clubId: number, clubName: string): { photos: PhotoMap; loading: boolean } {
    const [photos, setPhotos] = useState<PhotoMap>({})
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!clubId || !clubName) return

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
                // Find competitions this club participates in
                const { data } = await supabase
                    .from('competitions')
                    .select('competition_id')
                    .contains('club_names', [clubName])
                    .eq('season', '2025/2026')

                if (cancelled || !data || data.length === 0) { setLoading(false); return }

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
                    console.log(`📸 useTeamPhotos: ${Object.keys(photoMap).length} photos for "${clubName}"`)
                }
            } catch {} finally {
                if (!cancelled) setLoading(false)
            }
        }

        run()
        return () => { cancelled = true }
    }, [clubId, clubName])

    return { photos, loading }
}
