/**
 * Import pavilions_enriched.json into Supabase pavilions table.
 *
 * Usage: cd web && npx tsx scripts/import-pavilions.ts
 *
 * Input: ../scripts/pavilions_enriched.json
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_KEY || ''
if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_KEY env vars')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const INPUT = path.join(__dirname, '..', '..', 'scripts', 'pavilions_enriched.json')

interface EnrichedPavilion {
    recinto_id: number
    nome: string
    rua: string | null
    codigo_postal: string | null
    cidade: string | null
    url: string
    lat: number | null
    lng: number | null
    distrito: string | null
    concelho: string | null
    morada_completa: string | null
    foto_url: null
    geocode_ok: boolean
}

async function main() {
    console.log('📖 Reading pavilions_enriched.json...')
    const data: EnrichedPavilion[] = JSON.parse(fs.readFileSync(INPUT, 'utf-8'))
    console.log(`📋 ${data.length} pavilions to import\n`)

    // Insert in batches of 50
    const batchSize = 50
    let imported = 0
    let errors = 0

    const rows = data.map((p) => ({
        recinto_id: p.recinto_id,
        nome: p.nome,
        rua: p.rua,
        codigo_postal: p.codigo_postal,
        cidade: p.cidade,
        distrito: p.distrito,
        concelho: p.concelho,
        lat: p.lat,
        lng: p.lng,
        morada_completa: p.morada_completa,
        foto_url: p.foto_url,
        fpb_url: p.url,
        geocode_ok: p.geocode_ok,
    }))

    for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize)
        const { error } = await supabase
            .from('pavilions')
            .upsert(batch, { onConflict: 'recinto_id' })

        if (error) {
            console.log(`  ❌ Batch ${i + 1}-${Math.min(i + batchSize, rows.length)}: ${error.message}`)
            errors += batch.length
        } else {
            imported += batch.length
            console.log(`  ✅ Batch ${i + 1}-${Math.min(i + batchSize, rows.length)} imported (${imported}/${rows.length})`)
        }
    }

    const geocoded = data.filter((p) => p.geocode_ok).length
    console.log(`\n✅ Done! ${imported} imported, ${errors} errors`)
    console.log(`📊 ${geocoded}/${data.length} with coordinates (${((geocoded / data.length) * 100).toFixed(0)}%)`)

    if (errors > 0) {
        console.log('\n⚠️  Some batches had errors. Run again to retry (uses upsert).')
    }
}

main().catch((err) => {
    console.error('Fatal:', err)
    process.exit(1)
})
