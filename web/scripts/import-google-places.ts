/**
 * Import Google Places pavilions JSON into Supabase.
 *
 * Run: npx tsx web/scripts/import-google-places.ts
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_KEY env vars (service key for DELETE).
 * The anon key can't DELETE — ask user for service_role key or use a local .env.
 *
 * Strategy:
 *  1. Read Google Places JSON + backup JSON
 *  2. Fuzzy-match by name to preserve distrito/concelho from backup
 *  3. DELETE all existing pavilions
 *  4. INSERT all 373 records
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ── Config ────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || ''
if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars')
    console.error('   SUPABASE_SERVICE_KEY must be the service_role key (not anon) to allow DELETE.')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const INPUT_JSON = path.join(__dirname, '..', '..', 'scripts', 'google_places_pavilions.json')
// Find most recent backup
const SCRIPTS_DIR = path.join(__dirname, '..', '..', 'scripts')
const backupFiles = fs.readdirSync(SCRIPTS_DIR)
    .filter(f => f.startsWith('pavilions_backup_') && f.endsWith('.json'))
    .sort()
    .reverse()
const BACKUP_JSON = backupFiles.length > 0 ? path.join(SCRIPTS_DIR, backupFiles[0]) : null

// ── Types ─────────────────────────────────────────────
interface GooglePlace {
    title: string
    subTitle: string | null
    description: string | null
    address: string | null
    street: string | null
    city: string | null
    postalCode: string | null
    countryCode: string | null
    website: string | null
    phone: string | null
    location: { lat: number; lng: number } | null
    placeId: string | null
    totalScore: number | null
    reviewsCount: number | null
    imagesCount: number | null
    imageUrl: string | null
    imageUrls: string[]
    openingHours: Record<string, unknown>[] | null
    additionalInfo: Record<string, unknown> | null
    peopleAlsoSearch: Record<string, unknown>[] | null
    reviewsTags: Record<string, unknown>[] | null
    url: string | null
    searchString: string | null
    permanentlyClosed: boolean
    temporarilyClosed: boolean
}

interface BackupPavilion {
    id: number
    recinto_id: number | null
    nome: string
    distrito: string | null
    concelho: string | null
    // ... other fields
}

interface ImportRow {
    nome: string
    rua: string | null
    codigo_postal: string | null
    cidade: string | null
    distrito: string | null
    concelho: string | null
    lat: number
    lng: number
    morada_completa: string | null
    foto_url: string | null
    fpb_url: string | null
    geocode_ok: boolean
    recinto_id: null
    google_place_id: string | null
    image_url: string | null
    image_urls: string[] | null
    website: string | null
    phone: string | null
    google_rating: number | null
    reviews_count: number | null
    images_count: number | null
    opening_hours: Record<string, unknown>[] | null
    additional_info: Record<string, unknown> | null
    people_also_search: Record<string, unknown>[] | null
    google_maps_url: string | null
    search_string: string | null
}

// ── Fuzzy name matching ───────────────────────────────
function normalize(n: string): string {
    return n
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/^pavilhao\s+(municipal\s+)?/i, '')
        .replace(/^pav\.\s*/i, '')
        .replace(/^mun\.\s*/i, '')
        .replace(/\s+/g, ' ')
        .trim()
}

function findMatch(name: string, backups: BackupPavilion[]): BackupPavilion | null {
    const norm = normalize(name)
    if (norm.length < 4) return null

    // Exact normalized match first
    for (const b of backups) {
        if (normalize(b.nome) === norm) return b
    }
    // Substring containment
    let best: BackupPavilion | null = null
    let bestLen = 0
    for (const b of backups) {
        const bNorm = normalize(b.nome)
        if (bNorm.includes(norm) || norm.includes(bNorm)) {
            if (bNorm.length > bestLen) { best = b; bestLen = bNorm.length }
        }
    }
    return best
}

// ── Main ──────────────────────────────────────────────
async function main() {
    // 1. Read JSONs
    console.log('📖 Reading Google Places JSON...')
    const raw = fs.readFileSync(INPUT_JSON, 'utf-8')
    const places: GooglePlace[] = JSON.parse(raw)
    console.log(`   ${places.length} places loaded`)

    let backups: BackupPavilion[] = []
    if (BACKUP_JSON) {
        console.log(`📖 Reading backup: ${path.basename(BACKUP_JSON)}`)
        backups = JSON.parse(fs.readFileSync(BACKUP_JSON, 'utf-8'))
        console.log(`   ${backups.length} backup pavilions loaded`)
    }

    // 2. Filter out records without location, then map to import rows
    const skipped = places.filter(p => !p.location)
    if (skipped.length > 0) {
        console.log(`   ⚠️  ${skipped.length} places skipped (no location):`)
        skipped.forEach(p => console.log(`      - ${p.title}`))
    }
    const withLocation = places.filter(p => p.location)

    const rows: ImportRow[] = withLocation.map((p) => {
        const match = backups.length > 0 ? findMatch(p.title, backups) : null
        return {
            nome: p.title,
            rua: p.street || null,
            codigo_postal: p.postalCode || null,
            cidade: p.city || null,
            distrito: match?.distrito ?? null,
            concelho: match?.concelho ?? null,
            lat: p.location!.lat,
            lng: p.location!.lng,
            morada_completa: p.address || null,
            foto_url: p.imageUrl || null,
            fpb_url: null, // Google data doesn't have FPB URLs
            geocode_ok: true,
            recinto_id: null,
            google_place_id: p.placeId || null,
            image_url: p.imageUrl || null,
            image_urls: p.imageUrls?.length ? p.imageUrls : null,
            website: p.website || null,
            phone: p.phone || null,
            google_rating: p.totalScore ?? null,
            reviews_count: p.reviewsCount ?? null,
            images_count: p.imagesCount ?? null,
            opening_hours: p.openingHours?.length ? p.openingHours : null,
            additional_info: p.additionalInfo && Object.keys(p.additionalInfo).length > 0 ? p.additionalInfo : null,
            people_also_search: p.peopleAlsoSearch?.length ? p.peopleAlsoSearch : null,
            google_maps_url: p.url || null,
            search_string: p.searchString || null,
        }
    })

    // Stats
    const withImage = rows.filter(r => r.image_url).length
    const withRating = rows.filter(r => r.google_rating).length
    const withDistrito = rows.filter(r => r.distrito).length
    const total = rows.length
    console.log(`\n📊 Stats (${total} with coordinates, ${skipped.length} skipped):`)
    console.log(`   ${withImage}/${total} with images`)
    console.log(`   ${withRating}/${total} with ratings`)
    console.log(`   ${withDistrito}/${total} matched distrito from backup`)

    // 3. Confirm
    console.log(`\n⚠️  About to DELETE all existing pavilions and INSERT ${rows.length} new ones.`)
    console.log('   Press Ctrl+C within 5s to abort...')
    await new Promise(r => setTimeout(r, 5000))

    // 4. DELETE all
    console.log('\n🗑️  Deleting all existing pavilions...')
    const { error: delErr } = await supabase.from('pavilions').delete().neq('id', 0)
    if (delErr) {
        console.error(`❌ Delete failed: ${delErr.message}`)
        console.error('   Make sure you are using the service_role key (SUPABASE_SERVICE_KEY).')
        process.exit(1)
    }
    console.log('   ✅ Deleted')

    // 5. INSERT in batches
    const batchSize = 50
    let inserted = 0
    let errors = 0

    for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize)
        const { error } = await supabase.from('pavilions').insert(batch)

        if (error) {
            console.log(`   ❌ Batch ${i + 1}-${Math.min(i + batchSize, rows.length)}: ${error.message}`)
            errors += batch.length
        } else {
            inserted += batch.length
            console.log(`   ✅ Batch ${i + 1}-${Math.min(i + batchSize, rows.length)} (${inserted}/${rows.length})`)
        }
    }

    console.log(`\n✅ Done! ${inserted} inserted, ${errors} errors`)
    if (errors > 0) {
        console.log('⚠️  Some batches failed. Check errors above.')
    }
}

main().catch((err) => {
    console.error('Fatal:', err)
    process.exit(1)
})
