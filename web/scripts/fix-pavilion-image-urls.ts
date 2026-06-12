/**
 * Process pavilion photos 2-by-2 (alphabetical order = pairs):
 *   - First in pair: light version (~70KB)
 *   - Second in pair: HD version (~450KB)
 *
 * For each pavilion, keeps both but stores:
 *   - image_url  → light version (for cards/map)
 *   - image_urls → [HD version] (for hero on desktop)
 *
 * Optionally renames files to pavilion name (--rename flag).
 *
 * Usage:
 *   $env:SUPABASE_SERVICE_KEY = "..."
 *   npx tsx web/scripts/fix-pavilion-image-urls.ts
 *   npx tsx web/scripts/fix-pavilion-image-urls.ts --rename   (also rename files)
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qdzmwgahencinoucvoop.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || ''
if (!SUPABASE_KEY) {
    console.error('❌ Set SUPABASE_SERVICE_KEY env var')
    process.exit(1)
}

const DO_RENAME = process.argv.includes('--rename')

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const BUCKET = 'pavilions'
const STORAGE_BASE = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}`

function sanitize(name: string): string {
    return name
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
        .substring(0, 80)
}

async function listAllFiles(): Promise<{ name: string; size: number }[]> {
    const all: { name: string; size: number }[] = []
    let offset = 0
    const limit = 200
    while (true) {
        const { data, error } = await supabase.storage.from(BUCKET).list('', { limit, offset, sortBy: { column: 'name', order: 'asc' } })
        if (error) throw error
        if (!data || data.length === 0) break
        for (const f of data) {
            all.push({ name: f.name, size: f.metadata?.size ?? 0 })
        }
        if (data.length < limit) break
        offset += limit
    }
    return all
}

async function downloadFile(filename: string): Promise<Buffer | null> {
    const { data, error } = await supabase.storage.from(BUCKET).download(filename)
    if (error || !data) return null
    return Buffer.from(await data.arrayBuffer())
}

async function main() {
    // 1. List ALL files with pagination
    console.log('📋 Listing all photos (paginated)...')
    const files = await listAllFiles()
    console.log(`   ${files.length} files found\n`)

    // 2. Sort alphabetically — pairs emerge naturally
    files.sort((a, b) => a.name.localeCompare(b.name))

    // 3. Group: pairs share the same base (name without _N suffix)
    // Since they're sorted alphabetically, pairs are adjacent
    const pairs: { light: typeof files[0]; heavy: typeof files[0] }[] = []
    for (let i = 0; i < files.length - 1; i++) {
        const a = files[i]
        const b = files[i + 1]
        // Check if they're a pair: same base name, one has _N suffix
        const baseA = a.name.replace(/_\d+\.(jpg|png)$/, '.$1')
        const baseB = b.name.replace(/_\d+\.(jpg|png)$/, '.$1')
        if (baseA === baseB) {
            // a is light (no suffix = first alphabetically), b is heavy
            pairs.push({
                light: a.size <= b.size ? a : b,
                heavy: a.size > b.size ? a : b,
            })
            i++ // skip the paired file
        } else {
            // No pair — standalone file (shouldn't happen, but handle)
            pairs.push({ light: a, heavy: a })
        }
    }

    console.log(`📸 ${pairs.length} photo pairs identified\n`)

    // 4. Fetch pavilions with Supabase image URLs
    const { data: pavs } = await supabase
        .from('pavilions')
        .select('id, nome, image_url, image_urls')
        .not('image_url', 'is', null)

    if (!pavs) { console.error('No pavilions'); process.exit(1) }

    const supabasePavs = (pavs as { id: number; nome: string; image_url: string; image_urls: string[] | null }[])
        .filter(p => p.image_url.includes('supabase.co'))

    console.log(`📋 ${supabasePavs.length} pavilions with Supabase photos\n`)

    // Build lookup: filename (stripped) → pavilion
    const pavByFile = new Map<string, (typeof supabasePavs)[0]>()
    for (const pav of supabasePavs) {
        const match = pav.image_url.match(new RegExp(`/${BUCKET}/(.+)$`, 'i'))
        if (match) pavByFile.set(match[1], pav)
    }

    // 5. Process pairs: update image_urls with HD version
    let updated = 0
    let renamed = 0
    let skipped = 0
    let errors = 0

    for (const pair of pairs) {
        // Find which pavilion this pair belongs to
        // The light file's name (without _N suffix + ext) matches image_url in DB
        const lightBase = pair.light.name
        let pav = pavByFile.get(lightBase)
        if (!pav) {
            // Try matching by stripping _N from the heavy file
            const heavyBase = pair.heavy.name
            pav = pavByFile.get(heavyBase)
        }
        if (!pav) {
            // Try matching the light file without suffix variation
            // e.g. "ChIJxxx.jpg" vs "ChIJxxx_1.jpg" in DB
            for (const [key, p] of pavByFile) {
                const kBase = key.replace(/_\d+\.(jpg|png)$/, '.$1')
                if (kBase === lightBase || key === pair.heavy.name) {
                    pav = p
                    break
                }
            }
        }

        if (!pav) { skipped++; continue }

        const hdUrl = `${STORAGE_BASE}/${pair.heavy.name}`
        const lightUrl = `${STORAGE_BASE}/${pair.light.name}`

        // Update: image_url stays light, image_urls gets HD
        const { error: updateErr } = await supabase
            .from('pavilions')
            .update({
                image_url: lightUrl,
                image_urls: [hdUrl],
            })
            .eq('id', pav.id)

        if (updateErr) {
            errors++
            console.log(`   ❌ ${pav.nome.substring(0, 45)}: ${updateErr.message}`)
        } else {
            updated++
            console.log(`   ✅ ${pav.nome.substring(0, 45)} → HD ${pair.heavy.name} (${Math.round(pair.heavy.size / 1024)}KB)`)
        }

        // Optional: rename files to pavilion name
        if (DO_RENAME) {
            const base = sanitize(pav.nome)
            const ext = pair.light.name.split('.').pop() || 'jpg'
            try {
                // Download heavy file, re-upload with new name
                const hdData = await downloadFile(pair.heavy.name)
                if (hdData) {
                    const hdNewName = `${base}_hd.${ext}`
                    await supabase.storage.from(BUCKET).upload(hdNewName, hdData, { contentType: 'image/jpeg', upsert: true })
                    // Update image_urls with new name
                    const hdNewUrl = `${STORAGE_BASE}/${hdNewName}`
                    await supabase.from('pavilions').update({ image_urls: [hdNewUrl] }).eq('id', pav.id)
                    renamed++
                }
            } catch { /* rename is optional */ }
        }
    }

    console.log(`\n✅ Done! ${updated} updated with HD, ${skipped} skipped, ${errors} errors`)
    if (DO_RENAME) console.log(`📝 ${renamed} files renamed to pavilion names`)
}

main().catch((err) => {
    console.error('Fatal:', err)
    process.exit(1)
})
