/**
 * Fix pavilion image URLs: find the best (largest) photo for each pavilion.
 *
 * For each pavilion with a Supabase Storage image_url, checks if there's
 * a _0, _1, _2, _3, _4 variant that's larger, and stores it in image_urls.
 *
 * Downloads each candidate to check size (HEAD doesn't give Content-Length
 * reliably on Supabase Storage), then picks the largest.
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

const SUFFIXES = ['', '_1', '_2', '_3', '_4']

async function getFileSize(filename: string): Promise<number | null> {
    const url = `${STORAGE_BASE}/${filename}`
    try {
        const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(8000) })
        if (!res.ok) return null
        const len = res.headers.get('content-length')
        return len ? parseInt(len) : null
    } catch {
        return null
    }
}

async function main() {
    // Fetch all pavilions with Supabase image_url (not Google URLs)
    const { data: pavs, error } = await supabase
        .from('pavilions')
        .select('id, nome, image_url, image_urls')
        .not('image_url', 'is', null)

    if (error || !pavs) {
        console.error('❌ Failed to fetch:', error?.message)
        process.exit(1)
    }

    // Filter to only those with Supabase Storage URLs
    const supabasePavs = (pavs as { id: number; nome: string; image_url: string; image_urls: string[] | null }[])
        .filter(p => p.image_url.includes('supabase.co'))

    console.log(`📋 ${supabasePavs.length} pavilions with Supabase photos\n`)

    let updated = 0
    let skipped = 0
    let errors = 0

    for (const pav of supabasePavs) {
        // Extract base filename from Supabase URL: .../pavilions/ChIJxxx.jpg → ChIJxxx
        const match = pav.image_url.match(new RegExp(`/${BUCKET}/(.+)\\.(jpg|png|jpeg)$`, 'i'))
        if (!match) { skipped++; continue }

        const baseName = match[1].replace(/_\d+$/, '') // strip existing suffix if any

        // Check all suffix variants, find the largest
        let bestName = match[1] + '.' + (match[0].match(/\.(jpg|png|jpeg)$/i)?.[1] || 'jpg')
        let bestSize = 0

        for (const suffix of SUFFIXES) {
            const candidate = `${baseName}${suffix}.jpg`
            const size = await getFileSize(candidate)
            if (size && size > bestSize) {
                bestSize = size
                bestName = candidate
            }
        }

        // Update if we found a better version (different from current)
        if (bestName !== `${match[1]}.jpg` && bestName !== match[1]) {
            const newUrl = `${STORAGE_BASE}/${bestName}`
            const { error: updateErr } = await supabase
                .from('pavilions')
                .update({ image_urls: [newUrl] })
                .eq('id', pav.id)

            if (updateErr) {
                errors++
                if (errors <= 3) console.log(`   ❌ ${pav.nome.substring(0, 45)}: ${updateErr.message}`)
            } else {
                updated++
                console.log(`   ✅ ${pav.nome.substring(0, 45)} → ${bestName} (${Math.round(bestSize / 1024)}KB)`)
            }
        } else {
            skipped++
        }
    }

    console.log(`\n✅ Done! ${updated} HD updated, ${skipped} skipped (no better version), ${errors} errors`)
}

main().catch((err) => {
    console.error('Fatal:', err)
    process.exit(1)
})
