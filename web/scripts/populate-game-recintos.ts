/**
 * Populate recinto_id in games tables by matching game.local against pavilion names.
 *
 * This is a ONE-TIME migration. After this, games use direct recinto_id lookup.
 *
 * Usage:
 *   $env:SUPABASE_SERVICE_KEY = "..."
 *   npx tsx web/scripts/populate-game-recintos.ts
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qdzmwgahencinoucvoop.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || ''
if (!SUPABASE_KEY) {
    console.error('❌ Set SUPABASE_SERVICE_KEY env var')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

function normalize(n: string): string {
    return n.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/^pavilhao\s+(municipal\s+)?/i, '')
        .replace(/^pav\.\s*/i, '').replace(/^mun\.\s*/i, '')
        .replace(/^municipal\s+/i, '')
        .replace(/\s+/g, ' ').trim()
}

async function main() {
    // Fetch all pavilions WITH recinto_id
    const { data: pavs } = await supabase
        .from('pavilions')
        .select('id, nome, recinto_id')
        .not('recinto_id', 'is', null)

    if (!pavs || pavs.length === 0) {
        console.error('❌ No pavilions with recinto_id. Run restore-recinto-ids.ts first.')
        process.exit(1)
    }

    console.log(`📋 ${pavs.length} pavilions with recinto_id\n`)

    const tables = ['games_2025_2026', 'games_2024_2025', 'games_2023_2024', 'games_2022_2023']

    for (const table of tables) {
        // Count games without recinto_id
        const { count } = await supabase.from(table).select('*', { count: 'exact', head: true }).is('recinto_id', null).not('local', 'is', null)
        if (!count || count === 0) {
            console.log(`📋 ${table}: no games need recinto_id\n`)
            continue
        }

        console.log(`📋 ${table}: ${count} games to process\n`)

        // Fetch in batches
        const batchSize = 500
        let updated = 0
        let skipped = 0

        for (let offset = 0; offset < count; offset += batchSize) {
            const { data: games } = await supabase
                .from(table)
                .select('slug, local')
                .is('recinto_id', null)
                .not('local', 'is', null)
                .range(offset, offset + batchSize - 1)

            if (!games || games.length === 0) break

            for (const game of games as { slug: string; local: string }[]) {
                const norm = normalize(game.local.split('|')[0].replace(/\s*,.+$/, '').trim())
                if (norm.length < 4) { skipped++; continue }

                // Try exact normalized match
                let match: { recinto_id: number } | null = null
                for (const p of pavs as { id: number; nome: string; recinto_id: number }[]) {
                    if (normalize(p.nome) === norm) { match = p; break }
                }
                // Substring containment
                if (!match) {
                    for (const p of pavs as { id: number; nome: string; recinto_id: number }[]) {
                        const pn = normalize(p.nome)
                        if (pn.includes(norm) || norm.includes(pn)) { match = p; break }
                    }
                }

                if (match) {
                    await supabase.from(table).update({ recinto_id: match.recinto_id }).eq('slug', game.slug)
                    updated++
                } else {
                    skipped++
                }
            }
        }

        console.log(`   ✅ ${updated} matched, ${skipped} skipped\n`)
    }

    console.log('✅ Done!')
}

main().catch((err) => {
    console.error('Fatal:', err)
    process.exit(1)
})
