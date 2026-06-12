/**
 * Download all pavilion photos from Google Places JSON to local disk.
 *
 * Google Street View URLs EXPIRE — run this immediately after scraping.
 *
 * Usage:
 *   npx tsx web/scripts/download-pavilion-photos.ts
 *
 * Output: scripts/pavilion_photos/<place_id>.jpg
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const INPUT_JSON = path.join(__dirname, '..', '..', 'scripts', 'google_places_pavilions.json')
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'scripts', 'pavilion_photos')

// ── Types ─────────────────────────────────────────────
interface GooglePlace {
    title: string
    placeId: string | null
    imageUrl: string | null
    imageUrls: string[]
}

// ── Helpers ───────────────────────────────────────────
function sanitizeFilename(name: string): string {
    return name
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
        .substring(0, 60)
}

async function downloadFile(url: string, dest: string): Promise<boolean> {
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
        if (!res.ok) {
            console.log(`   HTTP ${res.status} — skipping`)
            return false
        }
        const buf = Buffer.from(await res.arrayBuffer())
        if (buf.length < 500) {
            console.log(`   Too small (${buf.length}B) — likely placeholder, skipping`)
            return false
        }
        fs.mkdirSync(path.dirname(dest), { recursive: true })
        fs.writeFileSync(dest, buf)
        return true
    } catch (err) {
        console.log(`   Error: ${(err as Error).message}`)
        return false
    }
}

// ── Main ──────────────────────────────────────────────
async function main() {
    console.log('📖 Reading Google Places JSON...')
    const places: GooglePlace[] = JSON.parse(fs.readFileSync(INPUT_JSON, 'utf-8'))

    // Collect unique image URLs
    const seen = new Set<string>()
    const downloads: { placeId: string; title: string; url: string }[] = []
    for (const p of places) {
        const urls: string[] = []
        if (p.imageUrl) urls.push(p.imageUrl)
        if (p.imageUrls) urls.push(...p.imageUrls)

        for (const url of urls) {
            if (!url || seen.has(url)) continue
            seen.add(url)
            downloads.push({
                placeId: p.placeId || sanitizeFilename(p.title),
                title: p.title,
                url,
            })
        }
    }

    console.log(`📸 ${downloads.length} unique photos to download from ${places.length} places\n`)

    // Create output dir
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
    console.log(`📁 Output: ${OUTPUT_DIR}\n`)

    // Download
    let ok = 0
    let fail = 0
    const batchSize = 5 // parallel downloads

    for (let i = 0; i < downloads.length; i += batchSize) {
        const batch = downloads.slice(i, i + batchSize)
        const results = await Promise.all(
            batch.map(async (d, j) => {
                const ext = '.jpg'
                const filename = `${d.placeId}${j > 0 ? `_${j}` : ''}${ext}`
                const dest = path.join(OUTPUT_DIR, filename)
                const success = await downloadFile(d.url, dest)
                return { ...d, filename, success }
            })
        )

        for (const r of results) {
            const done = i + results.indexOf(r) + 1
            if (r.success) {
                ok++
                console.log(`   ✅ [${done}/${downloads.length}] ${r.filename} — ${r.title.substring(0, 50)}`)
            } else {
                fail++
                console.log(`   ❌ [${done}/${downloads.length}] ${r.filename} — ${r.title.substring(0, 50)}`)
            }
        }
    }

    console.log(`\n✅ Done! ${ok} downloaded, ${fail} failed`)
    console.log(`📁 Photos saved to: ${OUTPUT_DIR}`)
}

main().catch((err) => {
    console.error('Fatal:', err)
    process.exit(1)
})
