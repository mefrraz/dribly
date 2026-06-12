/**
 * Migrate ALL pavilion photo URLs from Google to Supabase Storage.
 *
 * After this, zero requests to Google CDNs — everything from Supabase.
 *
 * Usage:
 *   $env:SUPABASE_SERVICE_KEY = "..."
 *   npx tsx web/scripts/migrate-all-photos-to-supabase.ts
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qdzmwgahencinoucvoop.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || ''
if (!SUPABASE_KEY) {
    console.error('❌ Set SUPABASE_SERVICE_KEY env var')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const BUCKET = 'pavilions'
const STORAGE_BASE = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}`

async function main() {
    // 1. Fetch ALL pavilions with any image URL
    const { data: pavs, error } = await supabase
        .from('pavilions')
        .select('id, nome, google_place_id, image_url, image_urls')
        .not('google_place_id', 'is', null)

    if (error || !pavs) {
        console.error('❌', error?.message)
        process.exit(1)
    }

    console.log(`📋 ${pavs.length} pavilions with google_place_id\n`)

    // 2. For each, try to find matching Supabase photos
    let updated = 0
    let skipped = 0
    let errors = 0

    for (const pav of pavs as { id: number; nome: string; google_place_id: string; image_url: string | null; image_urls: string[] | null }[]) {
        const placeId = pav.google_place_id
        if (!placeId) { skipped++; continue }

        // Check if already using Supabase URLs
        if (pav.image_url?.includes('supabase.co')) {
            skipped++
            continue
        }

        // Look for photos in Storage by place_id prefix
        const { data: files } = await supabase.storage.from(BUCKET).list('', {
            search: placeId.substring(0, 10),
            limit: 10,
        })

        if (!files || files.length === 0) {
            skipped++
            continue
        }

        // Find files matching this exact place_id
        const matches = files.filter(f => f.name.startsWith(placeId))
        if (matches.length === 0) { skipped++; continue }

        // Sort by size: biggest = HD, smallest = thumbnail
        matches.sort((a, b) => (a.metadata?.size ?? 0) - (b.metadata?.size ?? 0))
        const thumbnail = matches[0]
        const hd = matches.length > 1 ? matches[matches.length - 1] : matches[0]

        const lightUrl = `${STORAGE_BASE}/${thumbnail.name}`
        const hdUrl = `${STORAGE_BASE}/${hd.name}`
        const hdUrls = hd.name !== thumbnail.name ? [hdUrl] : [lightUrl]

        const { error: updateErr } = await supabase
            .from('pavilions')
            .update({
                image_url: lightUrl,
                foto_url: lightUrl,
                image_urls: hdUrls,
            })
            .eq('id', pav.id)

        if (updateErr) {
            errors++
            if (errors <= 3) console.log(`   ❌ ${pav.nome.substring(0, 45)}: ${updateErr.message}`)
        } else {
            updated++
            console.log(`   ✅ ${pav.nome.substring(0, 45)} → ${thumbnail.name} + ${hd.name}`)
        }
    }

    console.log(`\n✅ ${updated} migrated to Supabase, ${skipped} skipped, ${errors} errors`)
}

main().catch((err) => {
    console.error('Fatal:', err)
    process.exit(1)
})
