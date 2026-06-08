/**
 * Extract dominant color from club logos and update Supabase.
 *
 * Downloads each club's logo, finds the dominant non-white/non-black color,
 * and updates the primary_color field.
 *
 * Usage:
 *   cd web
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/extract-club-colors.ts
 *
 * Pass --apply to write to Supabase (default: dry-run, shows colors).
 */

import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const APPLY = process.argv.includes('--apply')

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

interface Club {
    id: number
    name: string
    slug: string
    logo_url: string | null
    primary_color: string | null
}

function isNearWhite(r: number, g: number, b: number): boolean {
    return r > 240 && g > 240 && b > 240
}

function isNearBlack(r: number, g: number, b: number): boolean {
    return r < 25 && g < 25 && b < 25
}

function isGray(r: number, g: number, b: number): boolean {
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    return max - min < 20
}

function rgbToHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('')
}

function colorSaturation(r: number, g: number, b: number): number {
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    return max === 0 ? 0 : (max - min) / max
}

async function extractDominantColor(imageUrl: string): Promise<string | null> {
    try {
        const res = await fetch(imageUrl)
        if (!res.ok) return null
        const buffer = Buffer.from(await res.arrayBuffer())

        // Resize small for fast processing, get raw RGBA pixels
        const { data, info } = await sharp(buffer)
            .resize(50, 50, { fit: 'inside' })
            .removeAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true })

        const pixels = data as Buffer
        const colorCounts = new Map<string, { count: number; r: number; g: number; b: number; sat: number }>()

        // Count colors, grouping similar ones
        for (let i = 0; i < pixels.length; i += 3) {
            const r = pixels[i]
            const g = pixels[i + 1]
            const b = pixels[i + 2]

            if (isNearWhite(r, g, b) || isNearBlack(r, g, b) || isGray(r, g, b)) continue

            // Quantize to reduce noise (group similar colors)
            const qr = Math.round(r / 16) * 16
            const qg = Math.round(g / 16) * 16
            const qb = Math.round(b / 16) * 16
            const key = `${qr},${qg},${qb}`

            const existing = colorCounts.get(key)
            if (existing) {
                existing.count++
            } else {
                colorCounts.set(key, {
                    count: 1,
                    r, g, b,
                    sat: colorSaturation(r, g, b),
                })
            }
        }

        if (colorCounts.size === 0) return null

        // Pick the color with the best score: frequency × saturation
        let bestColor: { r: number; g: number; b: number } | null = null
        let bestScore = 0

        for (const [, c] of colorCounts) {
            const score = c.count * (0.3 + c.sat * 0.7) // weight saturation heavily
            if (score > bestScore) {
                bestScore = score
                bestColor = { r: c.r, g: c.g, b: c.b }
            }
        }

        return bestColor ? rgbToHex(bestColor.r, bestColor.g, bestColor.b) : null
    } catch {
        return null
    }
}

async function main() {
    console.log('📖 Fetching clubs...')
    const { data, error } = await supabase
        .from('clubs')
        .select('id, name, slug, logo_url, primary_color')
        .order('id')

    if (error || !data) {
        console.error('Failed:', error)
        process.exit(1)
    }

    const clubs = data as Club[]
    const withLogos = clubs.filter(c => c.logo_url)
    console.log(`📋 ${clubs.length} clubs, ${withLogos.length} with logos\n`)

    if (!APPLY) {
        console.log('🔍 Dry-run — extracting colors (no writes):\n')
    } else {
        console.log('🎨 Extracting colors and updating Supabase...\n')
    }

    const results: { id: number; name: string; old: string | null; new: string; hex: string }[] = []
    let processed = 0

    for (const club of withLogos) {
        processed++
        const color = await extractDominantColor(club.logo_url!)

        if (!color) {
            continue
        }

        const oldColor = club.primary_color
        const isDifferent = !oldColor || oldColor.toLowerCase() !== color.toLowerCase()

        if (isDifferent || !APPLY) {
            // Show a color swatch preview
            const swatch = `\x1b[48;2;${parseInt(color.slice(1,3),16)};${parseInt(color.slice(3,5),16)};${parseInt(color.slice(5,7),16)}m   \x1b[0m`
            const oldSwatch = oldColor
                ? `\x1b[48;2;${parseInt(oldColor.slice(1,3),16)};${parseInt(oldColor.slice(3,5),16)};${parseInt(oldColor.slice(5,7),16)}m   \x1b[0m`
                : '   '

            if (isDifferent) {
                console.log(`${swatch}  ${String(club.id).padStart(4)} ${club.name.padEnd(40)} ${oldSwatch} → ${swatch} ${color}`)
                results.push({ id: club.id, name: club.name, old: oldColor, new: color, hex: color })
            }
        }

        // Progress
        if (processed % 20 === 0) {
            console.log(`  ... ${processed}/${withLogos.length}`)
        }

        // Small delay to not hammer the logo CDN
        await new Promise(r => setTimeout(r, 100))
    }

    console.log(`\n📊 ${results.length} clubs would get new colors.`)

    if (!APPLY) {
        console.log('💡 Dry-run. Run with --apply to update Supabase.')
        process.exit(0)
    }

    if (results.length === 0) {
        console.log('✅ All colors already correct!')
        process.exit(0)
    }

    // Update Supabase
    console.log('\n💾 Updating...')
    let updated = 0
    for (const r of results) {
        const { error: updateErr } = await supabase
            .from('clubs')
            .update({ primary_color: r.hex })
            .eq('id', r.id)

        if (updateErr) {
            console.log(`  ❌ #${r.id} ${r.name}: ${updateErr.message}`)
        } else {
            console.log(`  ✅ #${r.id} ${r.name}: ${r.old || '(none)'} → ${r.hex}`)
            updated++
        }
    }

    console.log(`\n🏁 Done! ${updated}/${results.length} clubs updated.`)
}

main().catch(err => {
    console.error('Fatal:', err)
    process.exit(1)
})
