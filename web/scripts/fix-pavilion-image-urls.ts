/**
 * Fix pavilion image URLs: set image_urls to the highest-res Supabase Storage version.
 *
 * For each pavilion, finds all photos in Storage with the same place_id prefix,
 * picks the LARGEST file (best quality), and stores it in image_urls.
 *
 * The upload script stored: placeId.jpg (70KB) + placeId_1.jpg (450KB)
 * Some places have _2, _3, _4 variants. This picks the biggest.
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
    // 1. List ALL files in the bucket to get sizes
    console.log('📋 Listing all photos in Storage...')
    const { data: allFiles, error: listErr } = await supabase.storage.from(BUCKET).list()
    if (listErr) {
        console.error('❌ Failed to list bucket:', listErr.message)
        process.exit(1)
    }
    if (!allFiles || allFiles.length === 0) {
        console.log('No files in bucket.')
        return
    }
    console.log(`   ${allFiles.length} files found\n`)

    // 2. Group by base name: strip _1, _2, _3, _4 suffix
    const groups = new Map<string, { name: string; size: number }[]>()
    for (const f of allFiles) {
        const base = f.name.replace(/_\d+\.(jpg|png)$/, '.$1').replace(/\.(jpg|png)$/, '')
        if (!groups.has(base)) groups.set(base, [])
        groups.get(base)!.push({ name: f.name, size: f.metadata?.size ?? 0 })
    }

    console.log(`📊 ${groups.size} unique places with photos\n`)

    // 3. Fetch pavilions that have image_url
    const { data: pavs, error } = await supabase
        .from('pavilions')
        .select('id, nome, image_url')
        .not('image_url', 'is', null)

    if (error || !pavs) {
        console.error('❌ Failed to fetch pavilions:', error?.message)
        process.exit(1)
    }

    console.log(`📋 ${pavs.length} pavilions with image_url\n`)

    // 4. For each pavilion, find the largest matching photo
    let updated = 0
    let skipped = 0
    let errors = 0

    for (const pav of pavs as { id: number; nome: string; image_url: string }[]) {
        // Extract base name from image_url (the Supabase public URL)
        const match = pav.image_url.match(new RegExp(`/${BUCKET}/(.+)\\.(jpg|png)$`))
        if (!match) { skipped++; continue }

        // The filename might be e.g. "ChIJxxx.jpg" or "ChIJxxx_1.jpg"
        // Strip suffix to get base
        const filename = match[1]
        const base = filename.replace(/_\d+$/, '')

        const group = groups.get(base)
        if (!group || group.length === 0) { skipped++; continue }

        // Find the largest file
        let best = group[0]
        for (const f of group) {
            if (f.size > best.size) best = f
        }

        // If the largest is the same as what's already in image_url, skip
        if (best.name === `${filename}.jpg` || best.name === filename) { skipped++; continue }

        const hdUrl = `${STORAGE_BASE}/${best.name}`
        const { error: updateErr } = await supabase
            .from('pavilions')
            .update({ image_urls: [hdUrl] })
            .eq('id', pav.id)

        if (updateErr) {
            errors++
            if (errors <= 3) console.log(`   ❌ ${pav.nome.substring(0, 45)}: ${updateErr.message}`)
        } else {
            updated++
            const sizeKB = Math.round(best.size / 1024)
            console.log(`   ✅ ${pav.nome.substring(0, 45)} → ${best.name} (${sizeKB}KB)`)
        }
    }

    console.log(`\n✅ Done! ${updated} updated with HD images, ${skipped} skipped, ${errors} errors`)
}

main().catch((err) => {
    console.error('Fatal:', err)
    process.exit(1)
})
