/**
 * Upload pavilion photos to Supabase Storage and update pavilions table.
 *
 * Prerequisites:
 *   1. Run download-pavilion-photos.ts first (photos in scripts/pavilion_photos/)
 *   2. Create a public bucket "pavilions" in Supabase Storage dashboard
 *      - Go to https://qdzmwgahencinoucvoop.supabase.com → Storage → New Bucket
 *      - Name: "pavilions"
 *      - Public bucket: YES
 *      - File size limit: 5 MB
 *
 * Usage:
 *   $env:SUPABASE_SERVICE_KEY = "eyJ..."
 *   npx tsx web/scripts/upload-pavilion-photos.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ── Config ────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qdzmwgahencinoucvoop.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || ''
if (!SUPABASE_KEY) {
    console.error('❌ Set SUPABASE_SERVICE_KEY env var (service_role key)')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const PHOTOS_DIR = path.join(__dirname, '..', '..', 'scripts', 'pavilion_photos')
const BUCKET = 'pavilions'

// ── Main ──────────────────────────────────────────────
async function main() {
    if (!fs.existsSync(PHOTOS_DIR)) {
        console.error(`❌ Photos dir not found: ${PHOTOS_DIR}`)
        console.error('   Run download-pavilion-photos.ts first.')
        process.exit(1)
    }

    const files = fs.readdirSync(PHOTOS_DIR).filter(f => f.endsWith('.jpg') || f.endsWith('.png'))
    if (files.length === 0) {
        console.error('❌ No photos found.')
        process.exit(1)
    }

    console.log(`📸 ${files.length} photos to upload to bucket "${BUCKET}"\n`)

    // Check bucket exists
    const { data: buckets } = await supabase.storage.listBuckets()
    const bucket = buckets?.find(b => b.name === BUCKET)
    if (!bucket) {
        console.error(`❌ Bucket "${BUCKET}" not found.`)
        console.error('   Create it in Supabase Dashboard → Storage → New Bucket')
        console.error('   Name: pavilions, Public: YES')
        process.exit(1)
    }

    // Upload in batches (parallel, 5 at a time)
    const batchSize = 5
    let uploaded = 0
    let skipped = 0
    let errors = 0

    // Map: placeId → photo URL (for updating pavilions table after)
    const photoMap = new Map<string, string>()

    for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize)

        const results = await Promise.all(
            batch.map(async (filename) => {
                const filepath = path.join(PHOTOS_DIR, filename)
                const content = fs.readFileSync(filepath)

                // Check if already uploaded (skip if exists)
                const { data: existing } = await supabase.storage.from(BUCKET).list('', { search: filename })
                if (existing && existing.length > 0) {
                    // File exists, get public URL
                    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filename)
                    return { filename, status: 'skipped' as const, url: urlData.publicUrl }
                }

                const { error } = await supabase.storage
                    .from(BUCKET)
                    .upload(filename, content, {
                        contentType: 'image/jpeg',
                        upsert: true,
                    })

                if (error) {
                    return { filename, status: 'error' as const, message: error.message }
                }

                const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filename)
                return { filename, status: 'ok' as const, url: urlData.publicUrl }
            })
        )

        for (const r of results) {
            const done = i + results.indexOf(r) + 1
            if (r.status === 'ok') {
                uploaded++
                // Extract placeId from filename (e.g., "ChIJ...jpg" → "ChIJ...")
                const placeId = r.filename.replace(/_\d+\.(jpg|png)$/, '').replace(/\.(jpg|png)$/, '')
                // Only store first photo per place (the _0 or base file)
                if (!photoMap.has(placeId) && !r.filename.match(/_\d+\./)) {
                    photoMap.set(placeId, r.url)
                }
                console.log(`   ✅ [${done}/${files.length}] ${r.filename}`)
            } else if (r.status === 'skipped') {
                skipped++
                console.log(`   ⏭️  [${done}/${files.length}] ${r.filename} (already exists)`)
            } else {
                errors++
                console.log(`   ❌ [${done}/${files.length}] ${r.filename}: ${r.message}`)
            }
        }
    }

    console.log(`\n📊 Upload: ${uploaded} ok, ${skipped} skipped, ${errors} errors`)

    // Update pavilions table with new photo URLs
    if (photoMap.size > 0) {
        console.log(`\n🔗 Updating ${photoMap.size} pavilions with Supabase photo URLs...`)
        let updated = 0
        let updateErrors = 0

        for (const [placeId, url] of photoMap) {
            const { error } = await supabase
                .from('pavilions')
                .update({ foto_url: url, image_url: url })
                .eq('google_place_id', placeId)

            if (error) {
                updateErrors++
                if (updateErrors <= 3) console.log(`   ❌ ${placeId}: ${error.message}`)
            } else {
                updated++
            }
        }

        console.log(`   ✅ ${updated} pavilions updated, ${updateErrors} errors`)
    }

    console.log('\n✅ All done! Photos are now served from Supabase CDN (Cloudflare).')
    console.log('   The old Google URLs will no longer be needed.')
}

main().catch((err) => {
    console.error('Fatal:', err)
    process.exit(1)
})
