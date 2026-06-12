/**
 * Fix pavilion image URLs: set image_urls to high-res Supabase Storage URLs.
 *
 * The upload script stored both photos in Supabase Storage:
 *   - placeId.jpg      (low-res, from Google imageUrl)
 *   - placeId_1.jpg    (high-res, from Google imageUrls[0], ~450KB vs 70KB)
 *
 * This script updates image_urls column to point to the high-res Supabase version,
 * so PavilionPage can use it for the hero image on larger screens.
 *
 * Usage:
 *   $env:SUPABASE_SERVICE_KEY = "..."
 *   npx tsx web/scripts/fix-pavilion-image-urls.ts
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
    // Fetch all pavilions that have image_url from Supabase Storage
    const { data: pavs, error } = await supabase
        .from('pavilions')
        .select('id, nome, image_url, image_urls')
        .not('image_url', 'is', null)

    if (error) {
        console.error('❌ Failed to fetch:', error.message)
        process.exit(1)
    }

    if (!pavs || pavs.length === 0) {
        console.log('No pavilions with images.')
        return
    }

    console.log(`📋 ${pavs.length} pavilions with images\n`)

    let updated = 0
    let skipped = 0
    let errors = 0

    for (const pav of pavs as { id: number; nome: string; image_url: string; image_urls: string[] | null }[]) {
        // Extract place_id from the Supabase URL
        // URL: .../public/pavilions/ChIJxxx.jpg
        const match = pav.image_url.match(new RegExp(`/${BUCKET}/(.+)\\.(jpg|png)$`))
        if (!match) {
            skipped++
            continue
        }

        const baseName = match[1] // e.g. "ChIJcSpv7dBkJA0RBqLMhBpR_4Y"
        // The high-res version has _1 suffix
        const hdUrl = `${STORAGE_BASE}/${baseName}_1.jpg`

        // Check if HD version exists in storage
        const { data: exists } = await supabase.storage.from(BUCKET).list('', { search: `${baseName}_1.jpg` })
        if (!exists || exists.length === 0) {
            skipped++
            continue
        }

        // Update image_urls with the HD URL
        const newUrls = [hdUrl]
        const { error: updateErr } = await supabase
            .from('pavilions')
            .update({ image_urls: newUrls })
            .eq('id', pav.id)

        if (updateErr) {
            errors++
            if (errors <= 3) console.log(`   ❌ ${pav.nome.substring(0, 40)}: ${updateErr.message}`)
        } else {
            updated++
        }
    }

    console.log(`\n✅ Done! ${updated} updated, ${skipped} skipped (no HD version), ${errors} errors`)
}

main().catch((err) => {
    console.error('Fatal:', err)
    process.exit(1)
})
