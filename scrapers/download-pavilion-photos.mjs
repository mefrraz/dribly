/**
 * Download Google Places photos and upload to Supabase storage.
 * One photo per pavilion — picks the highest-res version.
 *
 * Usage:
 *   node scrapers/download-pavilion-photos.mjs path/to/dataset.json
 */

import { readFileSync } from 'fs'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '.env') })

const { createClient } = await import('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_KEY')
    process.exit(1)
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const BUCKET = 'pavilions'

const filePath = process.argv[2]
if (!filePath) {
    console.error('Usage: node scrapers/download-pavilion-photos.mjs <path-to-json>')
    process.exit(1)
}

console.log('📖 Reading JSON...')
const dataset = JSON.parse(readFileSync(filePath, 'utf-8'))

// Build lookup by google_place_id
const byPlaceId = new Map()
for (const e of dataset) {
    if (e.placeId && (e.imageUrls?.length > 0 || e.imageUrl)) {
        byPlaceId.set(e.placeId, e)
    }
}
console.log(`  ${byPlaceId.size} entries with photos`)

// Fetch pavilions that need photos
const { data: pavs } = await supabase.from('pavilions').select('id, nome, google_place_id, image_url').not('google_place_id', 'is', null)
// Always download to our bucket (regardless of current image_url)
const needPhoto = (pavs || []).filter(p => byPlaceId.has(p.google_place_id))
console.log(`  ${needPhoto.length} pavilions to process`)

if (needPhoto.length === 0) { console.log('✅ Nothing to do.'); process.exit(0) }

// Ensure bucket exists (create if needed)
const { data: buckets } = await supabase.storage.listBuckets()
if (!buckets?.find(b => b.name === BUCKET)) {
    console.log(`  Creating bucket "${BUCKET}"...`)
    const { error } = await supabase.storage.createBucket(BUCKET, { public: true, fileSizeLimit: 10485760, allowedMimeTypes: ['image/jpeg','image/png','image/webp'] })
    if (error) { console.error('  ❌', error.message); process.exit(1) }
}

// Clean bucket — remove all old files
console.log('\n🧹 Cleaning bucket...')
const { data: files } = await supabase.storage.from(BUCKET).list()
if (files?.length > 0) {
    const paths = files.map(f => f.name)
    const { error: cleanErr } = await supabase.storage.from(BUCKET).remove(paths)
    if (cleanErr) console.log(`  ⚠️  ${cleanErr.message}`)
    else console.log(`  🗑️  ${paths.length} old files removed`)
}

console.log('\n📥 Downloading & uploading...')
let ok = 0, err = 0

for (const pav of needPhoto) {
    const entry = byPlaceId.get(pav.google_place_id)
    // Try all available image URLs, pick the heaviest (best resolution)
    const urls = [...(entry.imageUrls || []), entry.imageUrl].filter(Boolean)
    if (urls.length === 0) continue

    let bestBuffer = null
    let bestSize = 0
    let bestUrl = null

    for (const imgUrl of urls) {
        try {
            const res = await fetch(imgUrl)
            if (!res.ok) continue
            const buffer = Buffer.from(await res.arrayBuffer())
            if (buffer.length > bestSize) {
                bestBuffer = buffer
                bestSize = buffer.length
                bestUrl = imgUrl
            }
        } catch { /* try next URL */ }
    }

    if (!bestBuffer) { err++; continue }

    try {
        // Upload to Supabase — name: pavilion slug + ext
        const ext = bestUrl.match(/\.(jpg|jpeg|png|webp)/i)?.[1] || 'jpg'
        const slug = pav.nome.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 60)
        const name = `${slug}.${ext}`
        const { data: up, error: upErr } = await supabase.storage.from(BUCKET).upload(name, bestBuffer, {
            contentType: `image/${ext}`,
            cacheControl: '31536000',
            upsert: true,
        })
        if (upErr) throw upErr

        // Get public URL
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(up.path)

        // Update pavilion
        const { error: updateErr } = await supabase.from('pavilions').update({ image_url: urlData.publicUrl }).eq('id', pav.id)
        if (updateErr) throw updateErr

        ok++
        const kb = Math.round(bestSize / 1024)
        console.log(`  ✅ ${ok}/${needPhoto.length} ${pav.nome.substring(0, 50)} (${kb} KB)`)
        if (ok % 50 === 0) console.log(`  ... ${ok}/${needPhoto.length}`)
    } catch (e) {
        err++
        if (err <= 5) console.log(`  ❌ ${pav.nome}: ${e.message}`)
    }

    // Rate limit — don't hammer Google's CDN
    await new Promise(r => setTimeout(r, 200))
}

console.log(`\n🏁 Done! ${ok} photos uploaded, ${err} errors.`)
