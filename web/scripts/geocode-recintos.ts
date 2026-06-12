/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
/**
 * Geocode recintos with EXACT addresses using Nominatim.
 * Uses: "Rua Fialho de Almeida, 4400-150 Vila Nova de Gaia, Portugal"
 * This gives precise coordinates because Nominatim resolves street addresses.
 *
 * Usage: cd web && npx tsx scripts/geocode-recintos.ts
 *
 * Input:  ../scripts/recintos_com_morada.json
 * Output: ../scripts/pavilions_enriched.json
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const INPUT = path.join(__dirname, '..', '..', 'scripts', 'recintos_com_morada.json')
const OUTPUT = path.join(__dirname, '..', '..', 'scripts', 'pavilions_enriched.json')
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org'
const DELAY_MS = 1200

interface Recinto {
    recinto_id: number
    nome: string
    rua: string | null
    codigo_postal: string | null
    cidade: string | null
    url: string
}

interface EnrichedPavilion {
    recinto_id: number
    nome: string
    rua: string | null
    codigo_postal: string | null
    cidade: string | null
    url: string
    lat: number | null
    lng: number | null
    distrito: string | null
    concelho: string | null
    morada_completa: string | null
    foto_url: null
    geocode_ok: boolean
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

function extractDistrict(address: any): string | null {
    if (address?.state) return address.state
    if (address?.county) return address.county
    if (address?.district) return address.district
    return null
}

function extractConcelho(address: any): string | null {
    if (address?.county) return address.county
    if (address?.municipality) return address.municipality
    if (address?.city) return address.city
    if (address?.town) return address.town
    return null
}

async function geocodeAddress(rua: string, codigo_postal: string, cidade: string, nomeRecinto: string): Promise<{
    lat: number | null; lng: number | null; distrito: string | null; concelho: string | null; morada: string | null
}> {
    // Strategy 1: Exact street address
    const parts = [rua, codigo_postal, cidade, 'Portugal'].filter(Boolean)
    const query = parts.join(', ')

    let result = await tryGeocode(query)
    if (result.lat) return result

    // Strategy 2: Postal code + city (without street number)
    if (codigo_postal && cidade) {
        const cp4 = codigo_postal.slice(0, 4)
        result = await tryGeocode(`${cp4} ${cidade}, Portugal`)
        if (result.lat) return result
    }

    // Strategy 3: Recinto name + city
    const cleanName = nomeRecinto.replace(/^pavilhão\s+/i, '').replace(/^pav\.?\s*/i, '')
    if (cidade) {
        result = await tryGeocode(`${cleanName}, ${cidade}, Portugal`)
        if (result.lat) return result
    }

    // Strategy 4: Just city (approximate center)
    if (cidade) {
        result = await tryGeocode(`${cidade}, Portugal`)
        if (result.lat) return result
    }

    return { lat: null, lng: null, distrito: null, concelho: null, morada: null }
}

async function tryGeocode(query: string): Promise<{
    lat: number | null; lng: number | null; distrito: string | null; concelho: string | null; morada: string | null
}> {
    const url = `${NOMINATIM_URL}/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1&accept-language=pt&countrycodes=pt`
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'DriblyPavilions/1.0 (dribly.pt; contact@dribly.pt)',
                'Accept': 'application/json',
            },
        })
        if (!res.ok) return { lat: null, lng: null, distrito: null, concelho: null, morada: null }
        const data = await res.json()
        if (!Array.isArray(data) || data.length === 0) return { lat: null, lng: null, distrito: null, concelho: null, morada: null }
        const best = data[0]
        return {
            lat: parseFloat(best.lat) || null,
            lng: parseFloat(best.lon) || null,
            distrito: extractDistrict(best.address),
            concelho: extractConcelho(best.address),
            morada: best.display_name || null,
        }
    } catch {
        return { lat: null, lng: null, distrito: null, concelho: null, morada: null }
    }
}

async function main() {
    console.log('📖 Reading recintos_com_morada.json...')
    const recintos: Recinto[] = JSON.parse(fs.readFileSync(INPUT, 'utf-8'))
    console.log(`📋 ${recintos.length} recintos to geocode\n`)

    // Checkpoint
    const ckptPath = path.join(__dirname, '..', '..', 'scripts', 'geocode_ckpt.json')
    let results: EnrichedPavilion[] = []
    let startIdx = 0
    if (fs.existsSync(ckptPath)) {
        results = JSON.parse(fs.readFileSync(ckptPath, 'utf-8'))
        startIdx = results.length
        console.log(`🔄 Resuming from ${startIdx}/${recintos.length}\n`)
    }

    let okCount = 0
    let failCount = 0

    for (let i = startIdx; i < recintos.length; i++) {
        const r = recintos[i]
        const addr = [r.rua, r.codigo_postal, r.cidade].filter(Boolean).join(', ')

        const geo = await geocodeAddress(r.rua || '', r.codigo_postal || '', r.cidade || '', r.nome)
        const ok = geo.lat !== null
        if (ok) okCount++
        else failCount++

        const icon = ok ? '✅' : '❌'
        const detail = ok ? `→ ${geo.lat!.toFixed(4)}, ${geo.lng!.toFixed(4)} (${geo.distrito || '?'})` : 'no results'
        console.log(`  [${i + 1}/${recintos.length}] ${icon} ${r.nome} ${detail}`)

        results.push({
            recinto_id: r.recinto_id,
            nome: r.nome,
            rua: r.rua,
            codigo_postal: r.codigo_postal,
            cidade: r.cidade,
            url: r.url,
            lat: geo.lat,
            lng: geo.lng,
            distrito: geo.distrito,
            concelho: geo.concelho,
            morada_completa: geo.morada,
            foto_url: null,
            geocode_ok: ok,
        })

        if ((i + 1) % 20 === 0) {
            fs.writeFileSync(ckptPath, JSON.stringify(results, null, 2), 'utf-8')
        }

        if (i < recintos.length - 1) await sleep(DELAY_MS)
    }

    if (fs.existsSync(ckptPath)) fs.unlinkSync(ckptPath)
    fs.writeFileSync(OUTPUT, JSON.stringify(results, null, 2), 'utf-8')

    const pct = ((okCount / results.length) * 100).toFixed(1)
    console.log(`\n✅ Done! ${okCount}/${results.length} geocoded (${pct}%)`)
    console.log(`📁 Saved to ${OUTPUT}`)

    if (failCount > 0) {
        console.log(`\n❌ Failed (${failCount}):`)
        for (const r of results.filter((r) => !r.geocode_ok)) {
            console.log(`  - ${r.nome} (${r.rua}, ${r.cidade})`)
        }
    }
}

main().catch((err) => {
    console.error('Fatal:', err)
    process.exit(1)
})
