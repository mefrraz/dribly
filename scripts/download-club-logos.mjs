/**
 * Download all club logos and save as {slug}.png for Supabase bucket upload.
 *
 * Usage:  node scripts/download-club-logos.mjs
 * Output: scripts/club_logos/{slug}.png
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Read Supabase credentials from web/.env
const envPath = join(__dirname, '..', 'web', '.env')
const envContent = readFileSync(envPath, 'utf-8')
const env = {}
for (const line of envContent.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m) env[m[1]] = m[2].trim()
}

const SUPABASE_URL = env.VITE_SUPABASE_URL
const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in web/.env')
    process.exit(1)
}

const OUT_DIR = join(__dirname, 'club_logos')

async function supabaseRest(path, opts = {}) {
    const url = `${SUPABASE_URL}/rest/v1/${path}`
    const res = await fetch(url, {
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Accept': 'application/json',
            ...opts.headers,
        },
        ...opts,
    })
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`)
    return res.json()
}

async function main() {
    // 1. Fetch all clubs with a logo_url
    const clubs = await supabaseRest(
        'clubs?select=id,name,slug,logo_url&logo_url=not.is.null&order=id.asc'
    )

    console.log(`Found ${clubs.length} clubs with logo_url\n`)

    // 2. Ensure output directory
    if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })

    // 3. Download each logo
    let ok = 0, fail = 0
    for (const club of clubs) {
        const ext = (club.logo_url.match(/\.(png|jpg|jpeg|webp|svg)(\?|$)/i) || [])[1] || 'png'
        const filename = `${club.slug}.${ext}`
        const outPath = join(OUT_DIR, filename)

        if (existsSync(outPath)) {
            console.log(`  skip  ${club.slug} (already exists)`)
            ok++
            continue
        }

        try {
            const res = await fetch(club.logo_url, {
                headers: { 'User-Agent': 'Dribly/1.0' },
                signal: AbortSignal.timeout(10000),
            })
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const buf = Buffer.from(await res.arrayBuffer())
            writeFileSync(outPath, buf)
            console.log(`  ✅ ${club.slug}.${ext}  (${(buf.length / 1024).toFixed(1)} KB)  ← ${club.name}`)
            ok++
        } catch (err) {
            console.error(`  ❌ ${club.slug}  ${err.message}`)
            fail++
        }
    }

    console.log(`\nDone: ${ok} downloaded, ${fail} failed.`)
    console.log(`Files saved to: ${OUT_DIR}`)
    console.log(`\nNext: upload all files to Supabase bucket "club-logos" (public) at:`)
    console.log(`  ${SUPABASE_URL}/storage/v1/bucket/club-logos`)
}

main()
