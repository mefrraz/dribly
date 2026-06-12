/**
 * Smart FPB recinto scraper — parallel, auto-discovers valid IDs first.
 *
 * Phase 1: Quick scan HEAD requests to find valid recinto IDs (non-404)
 * Phase 2: Parallel scrape valid IDs for name + address
 *
 * Usage: npx tsx web/scripts/scrape-recintos.ts
 * Output: recintos_com_morada.json
 *
 * Speed: ~15 concurrent × 0.5s ≈ 30s for 850 pages (vs 20 min sequential)
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const FPB_BASE = 'https://www.fpb.pt'
const OUTPUT = path.join(__dirname, '..', '..', 'scripts', 'recintos_com_morada.json')
const CKPT = path.join(__dirname, '..', '..', 'scripts', 'recintos_ckpt.json')

const MIN_ID = 9100
const MAX_ID = 10200
const PARALLEL = 15

interface RecintoEntry {
    recinto_id: number
    nome: string
    rua: string | null
    codigo_postal: string | null
    cidade: string | null
    distrito: string | null
    url: string
}

// Phase 1: Quick scan — find valid IDs using HEAD (no body download)
async function discoverValidIds(): Promise<number[]> {
    console.log(`🔍 Phase 1: Scanning IDs ${MIN_ID}-${MAX_ID}...`)
    const valid: number[] = []
    let scanned = 0

    for (let i = MIN_ID; i <= MAX_ID; i += PARALLEL) {
        const batch = []
        for (let j = i; j < i + PARALLEL && j <= MAX_ID; j++) {
            batch.push(j)
        }

        const results = await Promise.all(
            batch.map(async (id) => {
                try {
                    const ctrl = new AbortController()
                    const t = setTimeout(() => ctrl.abort(), 3000)
                    const res = await fetch(`${FPB_BASE}/recinto/${id}/`, {
                        method: 'HEAD',
                        headers: { 'User-Agent': 'Mozilla/5.0' },
                        signal: ctrl.signal,
                    })
                    clearTimeout(t)
                    return res.ok ? id : null
                } catch { return null }
            })
        )

        for (const id of results) {
            if (id) valid.push(id)
        }
        scanned += batch.length
        process.stdout.write(`\r  Scanned ${scanned}/${MAX_ID - MIN_ID + 1} — found ${valid.length} valid`)
    }

    console.log(`\n  ✅ ${valid.length} valid recinto IDs found\n`)
    return valid
}

// Phase 2: Scrape valid IDs in parallel for full data
async function scrapeRecinto(id: number): Promise<RecintoEntry | null> {
    const url = `${FPB_BASE}/recinto/${id}/`
    try {
        const ctrl = new AbortController()
        const t = setTimeout(() => ctrl.abort(), 5000)
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: ctrl.signal,
        })
        clearTimeout(t)
        if (!res.ok) return null

        const html = await res.text()
        if (!/\d{4}-\d{3}/.test(html)) return null

        // Parse: find postal code line, then work backwards
        const textOnly = html
            .replace(/<script[\s\S]*?<\/script>/g, '')
            .replace(/<style[\s\S]*?<\/style>/g, '')
            .replace(/<[^>]+>/g, '\n')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 2)

        const postalIdx = textOnly.findIndex(l => /\d{4}-\d{3}/.test(l))
        if (postalIdx < 0) return null

        const postalLine = textOnly[postalIdx]
        const postalMatch = postalLine.match(/(\d{4}-\d{3})\s*(.*)/)
        const codigo_postal = postalMatch?.[1] || null
        const cidade = postalMatch?.[2]?.trim() || null
        const rua = postalIdx > 0 ? textOnly[postalIdx - 1] : null
        let nome = postalIdx > 1 ? textOnly[postalIdx - 2] : null

        // Clean name
        if (!nome || nome === 'FPB - recinto') nome = rua

        // Extract distrito from postal code
        const distrito = codigo_postal
            ? getDistrito(codigo_postal)
            : null

        return {
            recinto_id: id,
            nome: nome || `Recinto #${id}`,
            rua: rua || null,
            codigo_postal,
            cidade,
            distrito,
            url,
        }
    } catch { return null }
}

function getDistrito(cp: string): string {
    const prefix = parseInt(cp.slice(0, 2))
    const map: Record<number, string> = {
        10: 'Lisboa', 11: 'Lisboa', 12: 'Lisboa', 13: 'Lisboa', 14: 'Lisboa', 15: 'Lisboa', 16: 'Lisboa', 17: 'Lisboa', 18: 'Lisboa', 19: 'Lisboa',
        20: 'Santarém', 21: 'Santarém', 22: 'Santarém',
        23: 'Leiria', 24: 'Leiria', 25: 'Leiria',
        26: 'Lisboa', 27: 'Lisboa',
        28: 'Setúbal', 29: 'Setúbal',
        30: 'Coimbra', 31: 'Coimbra', 32: 'Coimbra',
        34: 'Viseu', 35: 'Viseu', 36: 'Viseu',
        37: 'Aveiro', 38: 'Aveiro',
        40: 'Porto', 41: 'Porto', 42: 'Porto', 43: 'Porto', 44: 'Porto', 45: 'Porto', 46: 'Porto',
        47: 'Braga', 48: 'Braga',
        49: 'Viana do Castelo', 50: 'Vila Real',
        51: 'Bragança', 52: 'Bragança', 53: 'Bragança',
        54: 'Vila Real',
        60: 'Castelo Branco', 61: 'Castelo Branco', 62: 'Castelo Branco', 63: 'Castelo Branco',
        70: 'Évora', 71: 'Évora', 72: 'Évora',
        73: 'Portalegre', 74: 'Portalegre',
        75: 'Setúbal', 76: 'Beja', 77: 'Beja', 78: 'Beja',
        80: 'Faro', 81: 'Faro', 82: 'Faro', 83: 'Faro', 84: 'Faro', 85: 'Faro', 86: 'Faro', 87: 'Faro', 88: 'Faro',
        90: 'Madeira', 91: 'Madeira', 92: 'Madeira', 93: 'Madeira', 94: 'Madeira',
        95: 'Açores', 96: 'Açores', 97: 'Açores', 98: 'Açores', 99: 'Açores',
    }
    return map[prefix] || ''
}

async function main() {
    // Phase 1: Discover valid IDs
    let validIds: number[]
    if (fs.existsSync(CKPT)) {
        const ckpt = JSON.parse(fs.readFileSync(CKPT, 'utf-8'))
        validIds = ckpt.validIds
        console.log(`🔄 Resuming with ${validIds.length} valid IDs from checkpoint`)
    } else {
        validIds = await discoverValidIds()
        fs.writeFileSync(CKPT, JSON.stringify({ validIds, scraped: [] }, null, 2))
    }

    // Phase 2: Scrape in parallel
    console.log(`⚡ Phase 2: Scraping ${validIds.length} recintos (${PARALLEL} parallel)...\n`)
    const results: RecintoEntry[] = []
    let done = 0

    for (let i = 0; i < validIds.length; i += PARALLEL) {
        const batch = validIds.slice(i, i + PARALLEL)
        const batchResults = await Promise.all(batch.map(id => scrapeRecinto(id)))
        for (const r of batchResults) {
            if (r) {
                results.push(r)
                const addr = [r.rua, r.codigo_postal, r.cidade].filter(Boolean).join(', ')
                console.log(`  [${r.recinto_id}] ${r.nome} — ${addr || 'sem morada'}`)
            }
        }
        done += batch.length
        process.stdout.write(`\r  Progress: ${done}/${validIds.length} — ${results.length} with data`)
        if (i + PARALLEL < validIds.length) await new Promise(r => setTimeout(r, 200))
    }

    // Save
    fs.writeFileSync(OUTPUT, JSON.stringify(results, null, 2))
    if (fs.existsSync(CKPT)) fs.unlinkSync(CKPT)

    console.log(`\n\n✅ ${results.length} recintos saved to ${OUTPUT}`)
    console.log(`   With address: ${results.filter(r => r.rua).length}`)
    console.log(`   With postal code: ${results.filter(r => r.codigo_postal).length}`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
