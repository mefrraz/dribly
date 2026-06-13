/**
 * NUKE + IMPORT: Delete all pavilions and import from Google Places JSON.
 *
 * Usage:
 *   node scrapers/import-google-places.mjs path/to/dataset.json
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

const filePath = process.argv[2]
if (!filePath) {
    console.error('Usage: node scrapers/import-google-places.mjs <path-to-json>')
    process.exit(1)
}

// ── Read JSON ──────────────────────────────────────────
console.log(`📖 Reading ${filePath}...`)
const raw = JSON.parse(readFileSync(filePath, 'utf-8'))
console.log(`  ${raw.length} entries`)

// ── Map to our schema ──────────────────────────────────
const entries = raw.map(e => {
    const loc = e.location || {}
    return {
        nome: e.title || '',
        rua: e.street || null,
        cidade: e.city || null,
        codigo_postal: e.postalCode || null,
        lat: loc.lat || null,
        lng: loc.lng || null,
        morada_completa: e.address || null,
        google_place_id: e.placeId || null,
        google_rating: e.totalScore || null,
        reviews_count: e.reviewsCount || null,
        website: e.website || null,
        phone: e.phone || null,
        opening_hours: (e.openingHours || []).length > 0 ? e.openingHours.map(h => ({ day: h.day, hours: h.hours })) : null,
        google_maps_url: e.placeId ? `https://www.google.com/maps/place/?q=place_id:${e.placeId}` : null,
        geocode_ok: !!(loc.lat && loc.lng),
        from_google: true,
    }
}).filter(e => e.nome && e.lat && e.lng)

console.log(`  ${entries.length} with coordinates`)

// ── NUKE existing ──────────────────────────────────────
console.log('\n💣 Deleting ALL pavilions...')
const { error: delErr } = await supabase.from('pavilions').delete().neq('id', 0) // delete all
if (delErr) {
    console.error('Delete failed:', delErr.message)
    process.exit(1)
}
console.log('  Done.')

// ── Batch insert ───────────────────────────────────────
console.log(`\n📥 Inserting ${entries.length} pavilions...`)
let ok = 0, err = 0
const BATCH = 50
for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH)
    const { error } = await supabase.from('pavilions').insert(batch)
    if (error) {
        console.log(`  ❌ Batch ${i}-${i + BATCH}: ${error.message}`)
        err += batch.length
    } else {
        ok += batch.length
    }
    if (i % 200 === 0) console.log(`  ... ${i}/${entries.length}`)
}

console.log(`\n🏁 Done! ${ok} inserted, ${err} errors.`)
