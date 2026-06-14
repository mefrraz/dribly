/**
 * Upload club logos to Supabase Storage bucket "club-logos".
 *
 * Prerequisites:
 *   1. Create bucket "club-logos" in Supabase Dashboard → Storage
 *      - Make it PUBLIC
 *      - Add policy: SELECT for public (anon) role
 *   2. Get SERVICE_ROLE key from Supabase Dashboard → Settings → API
 *   3. Add to web/.env:  VITE_SUPABASE_SERVICE_KEY=...
 *
 * Usage:  node scripts/upload-club-logos.mjs
 */

import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, dirname, extname } from 'path'
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
const SERVICE_KEY = env.VITE_SUPABASE_SERVICE_KEY

if (!SUPABASE_URL) {
    console.error('Missing VITE_SUPABASE_URL in web/.env')
    process.exit(1)
}
if (!SERVICE_KEY) {
    console.error('Missing VITE_SUPABASE_SERVICE_KEY in web/.env')
    console.error('Get it from: Supabase Dashboard → Settings → API → service_role key')
    process.exit(1)
}

const LOGOS_DIR = join(__dirname, 'club_logos')
const BUCKET = 'club-logos'

async function main() {
    if (!existsSync(LOGOS_DIR)) {
        console.error(`Directory not found: ${LOGOS_DIR}`)
        console.error('Run download-club-logos.mjs first.')
        process.exit(1)
    }

    const files = readdirSync(LOGOS_DIR).filter(f => /\.(png|jpg|jpeg|webp|svg)$/i.test(f))
    console.log(`Found ${files.length} logo files. Uploading to ${BUCKET}...\n`)

    let ok = 0, fail = 0
    for (const file of files) {
        const filePath = join(LOGOS_DIR, file)
        const buf = readFileSync(filePath)
        const ext = extname(file).toLowerCase()
        const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' }[ext] || 'image/png'

        try {
            const res = await fetch(
                `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${file}`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${SERVICE_KEY}`,
                        'Content-Type': mime,
                        'x-upsert': 'true',
                    },
                    body: buf,
                    signal: AbortSignal.timeout(15000),
                }
            )
            if (!res.ok) {
                const err = await res.text()
                throw new Error(`HTTP ${res.status}: ${err.slice(0, 200)}`)
            }
            console.log(`  ✅ ${file}`)
            ok++
        } catch (err) {
            console.error(`  ❌ ${file}  ${err.message}`)
            fail++
        }
    }

    console.log(`\nDone: ${ok} uploaded, ${fail} failed.`)
    if (ok > 0) {
        console.log(`\nLogos available at:`)
        console.log(`  ${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/sport-lisboa-e-benfica.png`)
    }
}

main()
