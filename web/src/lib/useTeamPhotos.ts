import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const FPB_PROXY = '/api/fpb'
const CACHE_KEY = 'dribly_team_photos_v6'
const CACHE_TTL = 30 * 60 * 1000

interface PhotoMap { [teamId: string]: string }

function getCache(): Record<string, { ts: number; map: PhotoMap }> { try { return JSON.parse(sessionStorage.getItem(CACHE_KEY) || '{}') } catch { return {} } }
function setCache(k: string, m: PhotoMap) { const c = getCache(); c[k] = { ts: Date.now(), map: m }; try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(c)) } catch {} }

function norm(s: string) { return s.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim() }

/** Directly parse the WP AJAX HTML for team photos */
function parseTeamPhotos(html: string): { nome: string; photo: string | null }[] {
    const results: { nome: string; photo: string | null }[] = []
    // Match each .equipa block
    const blockRe = /<div class="equipa">\s*<a href="[^"]*">([\s\S]*?)<\/a>\s*<\/div>/g
    let m
    while ((m = blockRe.exec(html)) !== null) {
        const block = m[1]
        // Extract name from .equipa-name
        const nameMatch = block.match(/<div class="equipa-name">([^<]+)<\/div>/)
        const name = nameMatch?.[1]?.trim()
        if (!name) continue
        // Extract photo from .equipa-head background-image
        const bgMatch = block.match(/background-image:\s*url\(['"]?([^'")]+)['"]?\)/)
        const photo = bgMatch?.[1] || null
        // Skip default placeholders
        const isDefault = photo && /ass_highlight_default/i.test(photo)
        results.push({ nome: name, photo: isDefault ? null : photo })
    }
    return results
}

export function useTeamPhotos(clubId: number, clubName: string): { photos: PhotoMap; loading: boolean } {
    const [photos, setPhotos] = useState<PhotoMap>({})
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!clubId || !clubName) return
        const cacheKey = clubName.toLowerCase().trim()
        const cache = getCache()
        if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < CACHE_TTL) { setPhotos(cache[cacheKey].map); setLoading(false); return }

        let cancelled = false
        async function run() {
            try {
                const { data } = await supabase.from('competitions').select('competition_id').contains('club_names', [clubName]).eq('season', '2025/2026')
                if (cancelled || !data || data.length === 0) { setLoading(false); return }

                const photoMap: PhotoMap = {}
                const seen = new Set<number>()
                for (const row of data) {
                    if (cancelled) return
                    if (seen.has(row.competition_id)) continue
                    seen.add(row.competition_id)
                    try {
                        const res = await fetch(`${FPB_PROXY}?wp_action=get_equipas&idCompeticao=${row.competition_id}`)
                        if (!res.ok) continue
                        const html = await res.text()
                        const teams = parseTeamPhotos(html)
                        for (const t of teams) {
                            if (!t.photo) continue
                            const clean = t.nome.replace(/\s+/g, ' ').trim()
                            const allKeys = new Set<string>()
                            allKeys.add(clean); allKeys.add(clean.toLowerCase()); allKeys.add(norm(clean))
                            for (const w of clean.split(/\s+/)) { if (w.length > 2) { allKeys.add(w.toLowerCase()); allKeys.add(norm(w)) } }
                            for (const k of allKeys) { if (!photoMap[k]) photoMap[k] = t.photo }
                        }
                    } catch { /* skip */ }
                }
                if (!cancelled && Object.keys(photoMap).length > 0) {
                    setCache(cacheKey, photoMap)
                    setPhotos(photoMap)
                }
            } catch {} finally { if (!cancelled) setLoading(false) }
        }
        run()
        return () => { cancelled = true }
    }, [clubId, clubName])

    return { photos, loading }
}
