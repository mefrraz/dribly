/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
/**
 * Script 2 v2: Geocode pavilions with MULTI-STRATEGY Nominatim search.
 * Tries up to 5 query variations per pavilion to get exact coordinates.
 * No fallback to generic city center — if all fail, marked as needing manual fix.
 *
 * Usage: cd web && npx tsx scripts/geocode-pavilions.ts
 *
 * Input:  ../scripts/pavilions_raw.json
 * Output: ../scripts/pavilions_enriched.json
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const INPUT = path.join(__dirname, '..', '..', 'scripts', 'pavilions_raw.json')
const OUTPUT = path.join(__dirname, '..', '..', 'scripts', 'pavilions_enriched.json')
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org'
const DELAY_MS = 1200

interface RawPavilion {
    nome: string
    nome_normalizado: string
    cidade: string
    variantes: string[]
    count: number
}

interface EnrichedPavilion {
    nome: string
    nome_normalizado: string
    cidade: string
    lat: number | null
    lng: number | null
    distrito: string | null
    concelho: string | null
    morada: string | null
    foto_url: null
    geocode_ok: boolean
    strategy: string // which strategy succeeded
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

/** Clean name for search: remove DB padding, expand abbreviations */
function clean(raw: string): string {
    let n = raw
    const commaIdx = n.indexOf(',')
    if (commaIdx >= 0) n = n.substring(0, commaIdx)
    n = n.replace(/\s+/g, ' ').trim()
    return n
}

/** Expand abbreviations for better Nominatim matching */
function expandAbdns(s: string): string {
    return s
        .replace(/\bEsc\b\.?\s*/gi, 'Escola ')
        .replace(/\bSec\b\.?/gi, 'Secundária')
        .replace(/\bPav\b\.?/gi, 'Pavilhão')
        .replace(/\bGim\b\.?/gi, 'Ginásio')
        .replace(/\bEB\b/gi, 'Escola Básica')
        .replace(/\bEBS?\b/gi, 'Escola Básica e Secundária')
        .replace(/\bMultiusos\b/gi, 'Pavilhão Multiusos')
        .replace(/\bn\.?\s*º\s*/gi, 'número ')
        .replace(/\bDesp\b\.?/gi, 'Desportivo')
        .replace(/\bMun\b\.?/gi, 'Municipal')
        .replace(/\s+/g, ' ').trim()
}

/** Remove common prefixes to help Nominatim */
function stripPrefix(s: string): string {
    return s
        .replace(/^Pavilhão\s+(Municipal\s+)?(Desportivo\s+)?(da\s+)?(do\s+)?(dos\s+)?/i, '')
        .replace(/^Complexo\s+Desportivo\s+(de\s+)?(da\s+)?(do\s+)?/i, '')
        .replace(/^Ginásio\s+(do\s+)?(da\s+)?/i, '')
        .replace(/^Escola\s+(Secundária\s+)?(Básica\s+)?(EB\s+)?/i, '')
        .replace(/\s+/g, ' ').trim()
}

async function tryGeocode(query: string): Promise<any | null> {
    const url = `${NOMINATIM_URL}/search?q=${encodeURIComponent(query)}&format=json&limit=3&addressdetails=1&accept-language=pt&countrycodes=pt&bounded=0`
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'DriblyPavilions/1.0 (dribly.pt; contact@dribly.pt)',
            },
        })
        if (!res.ok) return null
        const data = await res.json()
        if (!Array.isArray(data) || data.length === 0) return null
        return data
    } catch {
        return null
    }
}

function extractDistrict(address: any): string | null {
    if (address.state) return address.state
    if (address.county) return address.county
    if (address.district) return address.district
    return null
}

function extractConcelho(address: any): string | null {
    if (address.county) return address.county
    if (address.municipality) return address.municipality
    if (address.city) return address.city
    if (address.town) return address.town
    return null
}

/** Check if result is "too generic" — city center, not an actual pavilion */
function isTooGeneric(result: any, city: string): boolean {
    const type = result.type || ''
    const category = result.category || ''
    const osmType = result.osm_type || ''

    // If result type is "administrative" (city/town boundary), it's NOT a pavilion
    if (type === 'administrative' || category === 'boundary') return true
    if (osmType === 'relation' && (type === 'town' || type === 'city' || type === 'village')) return true

    // If display_name is just "City, District, Portugal" with no street/amenity
    const dn = (result.display_name || '').toLowerCase()
    const parts = dn.split(',').map((p: string) => p.trim())
    // A generic result has only city-level parts (2-3 parts)
    // A specific result has street or amenity (4+ parts)
    if (parts.length <= 3) return true

    return false
}

async function geocodeOne(rawName: string, rawCity: string, index: number, total: number): Promise<{
    lat: number | null; lng: number | null; distrito: string | null; concelho: string | null
    morada: string | null; strategy: string
}> {
    const city = (rawCity || '').trim()
    const name = clean(rawName)
    const expanded = expandAbdns(name)

    // Strategy 1: Full expanded name + city
    let query = city ? `${expanded}, ${city}, Portugal` : `${expanded}, Portugal`
    let results = await tryGeocode(query)
    if (results) {
        const good = results.find((r: any) => !isTooGeneric(r, city)) || results[0]
        if (!isTooGeneric(good, city)) {
            return {
                lat: parseFloat(good.lat), lng: parseFloat(good.lon),
                distrito: extractDistrict(good.address), concelho: extractConcelho(good.address),
                morada: good.display_name, strategy: 'S1-full'
            }
        }
    }

    // Strategy 2: Original raw name (as stored in DB) + city
    query = city ? `${name}, ${city}, Portugal` : `${name}, Portugal`
    results = await tryGeocode(query)
    if (results) {
        const good = results.find((r: any) => !isTooGeneric(r, city)) || results[0]
        if (!isTooGeneric(good, city)) {
            return {
                lat: parseFloat(good.lat), lng: parseFloat(good.lon),
                distrito: extractDistrict(good.address), concelho: extractConcelho(good.address),
                morada: good.display_name, strategy: 'S2-raw'
            }
        }
    }

    // Strategy 3: Expand abbreviations + add "Pavilhão" prefix if missing
    const withPav = expanded.toLowerCase().includes('pavilhao') ? expanded : `Pavilhão ${expanded}`
    query = city ? `${withPav}, ${city}, Portugal` : `${withPav}, Portugal`
    results = await tryGeocode(query)
    if (results) {
        const good = results.find((r: any) => !isTooGeneric(r, city)) || results[0]
        if (!isTooGeneric(good, city)) {
            return {
                lat: parseFloat(good.lat), lng: parseFloat(good.lon),
                distrito: extractDistrict(good.address), concelho: extractConcelho(good.address),
                morada: good.display_name, strategy: 'S3-prefix'
            }
        }
    }

    // Strategy 4: No prefix, just the core name + city
    const stripped = stripPrefix(expanded)
    if (stripped && stripped !== expanded) {
        query = city ? `${stripped}, ${city}, Portugal` : `${stripped}, Portugal`
        results = await tryGeocode(query)
        if (results) {
            const good = results.find((r: any) => !isTooGeneric(r, city)) || results[0]
            if (!isTooGeneric(good, city)) {
                return {
                    lat: parseFloat(good.lat), lng: parseFloat(good.lon),
                    distrito: extractDistrict(good.address), concelho: extractConcelho(good.address),
                    morada: good.display_name, strategy: 'S4-stripped'
                }
            }
        }
    }

    // Strategy 5: Just city + "pavilhão desportivo" (last resort, might match if town has 1 pavilion)
    if (city) {
        query = `Pavilhão Desportivo, ${city}, Portugal`
        results = await tryGeocode(query)
        if (results) {
            const good = results.find((r: any) => !isTooGeneric(r, city)) || results[0]
            if (!isTooGeneric(good, city)) {
                return {
                    lat: parseFloat(good.lat), lng: parseFloat(good.lon),
                    distrito: extractDistrict(good.address), concelho: extractConcelho(good.address),
                    morada: good.display_name, strategy: 'S5-generic'
                }
            }
        }
    }

    // All strategies failed
    return { lat: null, lng: null, distrito: null, concelho: null, morada: null, strategy: 'FAIL' }
}

async function main() {
    console.log('📖 Reading pavilions_raw.json...')
    const raw = JSON.parse(fs.readFileSync(INPUT, 'utf-8')) as RawPavilion[]
    console.log(`📋 ${raw.length} pavilions — multi-strategy geocoding (no city fallback)\n`)

    const results: EnrichedPavilion[] = []
    let exactCount = 0
    let failCount = 0
    const strategyStats: Record<string, number> = {}

    for (let i = 0; i < raw.length; i++) {
        const p = raw[i]
        const geo = await geocodeOne(p.nome, p.cidade, i + 1, raw.length)

        const ok = geo.lat !== null
        if (ok) exactCount++
        else failCount++

        strategyStats[geo.strategy] = (strategyStats[geo.strategy] || 0) + 1

        const icon = ok ? '✅' : '❌'
        const detail = ok ? `→ ${geo.lat!.toFixed(4)}, ${geo.lng!.toFixed(4)} [${geo.strategy}]` : `[${geo.strategy}]`
        console.log(`  [${i + 1}/${raw.length}] ${icon} ${clean(p.nome)} ${detail}`)

        results.push({
            nome: p.nome,
            nome_normalizado: p.nome_normalizado,
            cidade: p.cidade,
            lat: geo.lat,
            lng: geo.lng,
            distrito: geo.distrito,
            concelho: geo.concelho,
            morada: geo.morada,
            foto_url: null,
            geocode_ok: ok,
            strategy: geo.strategy,
        })

        // Save every 20
        if ((i + 1) % 20 === 0) {
            const ckpt = path.join(__dirname, '..', '..', 'scripts', 'pavilions_enriched_ckpt.json')
            fs.writeFileSync(ckpt, JSON.stringify(results, null, 2), 'utf-8')
        }

        if (i < raw.length - 1) await sleep(DELAY_MS)
    }

    // Clean checkpoint
    const ckpt = path.join(__dirname, '..', '..', 'scripts', 'pavilions_enriched_ckpt.json')
    if (fs.existsSync(ckpt)) fs.unlinkSync(ckpt)

    fs.writeFileSync(OUTPUT, JSON.stringify(results, null, 2), 'utf-8')

    console.log(`\n✅ Saved to ${OUTPUT}`)
    console.log(`📊 Results: ${exactCount} exact, ${failCount} failed (${((exactCount / results.length) * 100).toFixed(1)}%)`)
    console.log(`📊 Strategies:`, JSON.stringify(strategyStats))

    if (failCount > 0) {
        console.log(`\n❌ Need manual geocoding:`)
        for (const r of results.filter((r) => !r.geocode_ok)) {
            console.log(`  - ${r.nome} (${r.cidade})`)
        }
    }
}

main().catch((err) => {
    console.error('Fatal:', err)
    process.exit(1)
})
