/**
 * Geocode missing pavilions — fetch from Supabase, query Nominatim, update coords.
 *
 * Uses pavilion address fields (rua, codigo_postal, cidade) for better accuracy
 * than name-only queries. Multi-strategy fallback like the original script.
 *
 * Optional AI (NVIDIA NIM): cleans abbreviations in addresses for better matching.
 * Set NVIDIA_API_KEY to enable. AI is only used to normalize the query text,
 * NEVER to suggest coordinates.
 *
 * Usage:
 *   cd web
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx tsx scripts/geocode-missing-pavilions.ts
 *
 *   With AI address cleaning:
 *   NVIDIA_API_KEY=nvapi-... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx tsx scripts/geocode-missing-pavilions.ts
 *
 * Pass --apply to write to Supabase (default: dry-run).
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const NVIDIA_KEY = process.env.NVIDIA_API_KEY || ''
const APPLY = process.argv.includes('--apply')
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org'
const DELAY_MS = 1200

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

interface Pavilion {
    id: number
    nome: string
    rua: string | null
    codigo_postal: string | null
    cidade: string | null
    distrito: string | null
    concelho: string | null
    lat: number | null
    lng: number | null
}

// ── AI address cleaner (optional) ──────────────────────

async function cleanAddressWithAI(name: string, rua: string | null, cp: string | null, cidade: string | null): Promise<string> {
    if (!NVIDIA_KEY) {
        // Basic cleanup without AI
        let q = [name, rua, cidade, 'Portugal'].filter(Boolean).join(', ')
        q = q.replace(/\bEsc\b\.?\s*/gi, 'Escola ')
             .replace(/\bSec\b\.?/gi, 'Secundária')
             .replace(/\bPav\b\.?/gi, 'Pavilhão')
             .replace(/\bGim\b\.?/gi, 'Ginásio')
             .replace(/\bMun\b\.?/gi, 'Municipal')
             .replace(/\bDesp\b\.?/gi, 'Desportivo')
             .replace(/\bEB\b/gi, 'Escola Básica')
             .replace(/\bn\.?\s*º\s*/gi, 'número ')
             .replace(/\s+/g, ' ').trim()
        return q
    }

    try {
        const input = `Name: ${name}\nStreet: ${rua || ''}\nPostal: ${cp || ''}\nCity: ${cidade || ''}`
        const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${NVIDIA_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'meta/llama-3.1-8b-instruct',
                messages: [
                    { role: 'system', content: 'You are a Portuguese address formatter. Given pavilion name + address fields, return ONLY a clean Nominatim search query. Expand all abbreviations (Esc.→Escola, Pav.→Pavilhão, Mun.→Municipal, Desp.→Desportivo, EB→Escola Básica, Sec.→Secundária, n.º→número). Include city and "Portugal". Return ONLY the query string, no explanation. Example output: "Pavilhão Municipal Escola Secundária de Valbom, Rua Professor José Marques, Valbom, Porto, Portugal"' },
                    { role: 'user', content: input },
                ],
                temperature: 0,
                max_tokens: 150,
            }),
        })
        if (!res.ok) throw new Error('NVIDIA API failed')
        const json = await res.json() as { choices: Array<{ message: { content: string } }> }
        const cleaned = json.choices?.[0]?.message?.content?.trim()
        return cleaned || input
    } catch {
        // Fallback to basic cleanup
        let q = [name, rua, cidade, 'Portugal'].filter(Boolean).join(', ')
        return q.replace(/\s+/g, ' ').trim()
    }
}

// ── Nominatim ──────────────────────────────────────────

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function tryGeocode(query: string): Promise<any | null> {
    const url = `${NOMINATIM_URL}/search?q=${encodeURIComponent(query)}&format=json&limit=3&addressdetails=1&accept-language=pt&countrycodes=pt`
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'DriblyPavilions/2.0 (dribly.pt; contact@dribly.pt)' },
        })
        if (!res.ok) return null
        const data = await res.json()
        return Array.isArray(data) && data.length > 0 ? data : null
    } catch { return null }
}

function isTooGeneric(result: any): boolean {
    const type = result.type || ''
    const category = result.category || ''
    if (type === 'administrative' || category === 'boundary') return true
    const parts = (result.display_name || '').split(',').map((p: string) => p.trim())
    return parts.length <= 3
}

function extractDistrict(address: any): string | null {
    return address.state || address.county || address.district || null
}

function extractConcelho(address: any): string | null {
    return address.county || address.municipality || address.city || address.town || null
}

async function geocodeOne(p: Pavilion, query: string): Promise<{ lat: number | null; lng: number | null; distrito: string | null; concelho: string | null; strategy: string }> {
    // S1: Full query (AI-cleaned or basic)
    let results = await tryGeocode(query)
    if (results) {
        const good = results.find((r: any) => !isTooGeneric(r)) || results[0]
        if (!isTooGeneric(good)) {
            return { lat: parseFloat(good.lat), lng: parseFloat(good.lon), distrito: extractDistrict(good.address), concelho: extractConcelho(good.address), strategy: 'S1-full' }
        }
    }

    // S2: Name + city only
    const city = p.cidade || ''
    const q2 = city ? `${p.nome}, ${city}, Portugal` : `${p.nome}, Portugal`
    if (q2 !== query) {
        results = await tryGeocode(q2)
        if (results) {
            const good = results.find((r: any) => !isTooGeneric(r)) || results[0]
            if (!isTooGeneric(good)) {
                return { lat: parseFloat(good.lat), lng: parseFloat(good.lon), distrito: extractDistrict(good.address), concelho: extractConcelho(good.address), strategy: 'S2-name-city' }
            }
        }
    }

    // S3: Add "Pavilhão" prefix if missing
    const withPav = p.nome.toLowerCase().includes('pavilh') ? p.nome : `Pavilhão ${p.nome}`
    const q3 = city ? `${withPav}, ${city}, Portugal` : `${withPav}, Portugal`
    if (q3 !== query && q3 !== q2) {
        results = await tryGeocode(q3)
        if (results) {
            const good = results.find((r: any) => !isTooGeneric(r)) || results[0]
            if (!isTooGeneric(good)) {
                return { lat: parseFloat(good.lat), lng: parseFloat(good.lon), distrito: extractDistrict(good.address), concelho: extractConcelho(good.address), strategy: 'S3-prefix' }
            }
        }
    }

    // S4: Just city + "Pavilhão Desportivo"
    if (city) {
        const q4 = `Pavilhão Desportivo, ${city}, Portugal`
        results = await tryGeocode(q4)
        if (results) {
            const good = results.find((r: any) => !isTooGeneric(r)) || results[0]
            if (!isTooGeneric(good)) {
                return { lat: parseFloat(good.lat), lng: parseFloat(good.lon), distrito: extractDistrict(good.address), concelho: extractConcelho(good.address), strategy: 'S4-city' }
            }
        }
    }

    // S5: Try with "Pavilhão Municipal" prefix
    if (city) {
        const stripped = p.nome.replace(/^Pavilhão\s+(Municipal\s+)?(Desportivo\s+)?/i, '').replace(/^Escola\s+/i, '').trim()
        const q5 = `Pavilhão Municipal ${stripped}, ${city}, Portugal`
        if (q5 !== q3) {
            results = await tryGeocode(q5)
            if (results) {
                const good = results.find((r: any) => !isTooGeneric(r)) || results[0]
                if (!isTooGeneric(good)) {
                    return { lat: parseFloat(good.lat), lng: parseFloat(good.lon), distrito: extractDistrict(good.address), concelho: extractConcelho(good.address), strategy: 'S5-municipal' }
                }
            }
        }
    }

    return { lat: null, lng: null, distrito: null, concelho: null, strategy: 'FAIL' }
}

// ── Main ──────────────────────────────────────────────

async function main() {
    console.log('📖 Fetching pavilions without coordinates from Supabase...')
    const { data, error } = await supabase
        .from('pavilions')
        .select('id, nome, rua, codigo_postal, cidade, distrito, concelho, lat, lng')
        .is('lat', null)
        .order('id')

    if (error || !data) {
        console.error('Failed:', error)
        process.exit(1)
    }

    const pavilions = data as Pavilion[]
    console.log(`📋 ${pavilions.length} pavilions need geocoding\n`)

    if (pavilions.length === 0) {
        console.log('✅ All pavilions already have coordinates!')
        process.exit(0)
    }

    const aiMode = NVIDIA_KEY ? '🧠 AI address cleaning ON' : '📝 Basic cleaning (no AI)'
    console.log(`${aiMode}\n`)

    let ok = 0
    let fail = 0
    const updates: { id: number; lat: number; lng: number; distrito: string | null; concelho: string | null }[] = []

    for (let i = 0; i < pavilions.length; i++) {
        const p = pavilions[i]
        const query = await cleanAddressWithAI(p.nome, p.rua, p.codigo_postal, p.cidade)
        const result = await geocodeOne(p, query)

        const icon = result.lat ? '✅' : '❌'
        const detail = result.lat ? `${result.lat.toFixed(4)}, ${result.lng.toFixed(4)} [${result.strategy}]` : `[${result.strategy}]`
        console.log(`  [${i + 1}/${pavilions.length}] ${icon} ${p.nome.slice(0, 50)} ${detail}`)

        if (result.lat !== null && result.lng !== null) {
            ok++
            updates.push({ id: p.id, lat: result.lat, lng: result.lng, distrito: result.distrito, concelho: result.concelho })
        } else {
            fail++
        }

        if (i < pavilions.length - 1) await sleep(DELAY_MS)
    }

    console.log(`\n📊 ${ok} found, ${fail} failed (${((ok / pavilions.length) * 100).toFixed(1)}%)`)

    if (fail > 0) {
        console.log('\n❌ Still missing:')
        const failed = pavilions.filter(p => !updates.find(u => u.id === p.id))
        for (const p of failed) {
            console.log(`  - ${p.nome} (${p.cidade || 'sem cidade'})`)
        }
    }

    if (!APPLY) {
        console.log('\n💡 Dry-run. Run with --apply to update Supabase.')
        if (NVIDIA_KEY) console.log('   AI mode was ON — for faster dry-runs, omit NVIDIA_API_KEY.')
        process.exit(0)
    }

    if (updates.length === 0) {
        console.log('\n✅ Nothing to update.')
        process.exit(0)
    }

    console.log('\n💾 Updating Supabase...')
    let updated = 0
    for (const u of updates) {
        const { error: updateErr } = await supabase
            .from('pavilions')
            .update({ lat: u.lat, lng: u.lng, distrito: u.distrito, concelho: u.concelho, geocode_ok: true })
            .eq('id', u.id)

        if (updateErr) {
            console.log(`  ❌ #${u.id}: ${updateErr.message}`)
        } else {
            updated++
        }
    }

    console.log(`\n🏁 Done! ${updated} pavilions updated.`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
