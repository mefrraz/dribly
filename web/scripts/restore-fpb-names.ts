/**
 * Replace Google Place names with FPB names where a match exists.
 *
 * After this, re-run restore-recinto-ids.ts to get near-100% recinto_id coverage.
 *
 * Usage:
 *   $env:SUPABASE_SERVICE_KEY = "..."
 *   npx tsx web/scripts/restore-fpb-names.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qdzmwgahencinoucvoop.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || ''
if (!SUPABASE_KEY) {
    console.error('❌ Set SUPABASE_SERVICE_KEY env var')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// Find backup
const SCRIPTS_DIR = path.join(__dirname, '..', '..', 'scripts')
const backupFiles = fs.readdirSync(SCRIPTS_DIR)
    .filter(f => f.startsWith('pavilions_backup_') && f.endsWith('.json'))
    .sort().reverse()

if (backupFiles.length === 0) { console.error('No backup'); process.exit(1) }

const BACKUP_JSON = path.join(SCRIPTS_DIR, backupFiles[0])

interface BackupPav { id: number; recinto_id: number | null; nome: string }

function normalize(n: string): string {
    return n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/^pavilhao\s+(municipal\s+)?/i, '').replace(/^pav\.\s*/i, '').replace(/^mun\.\s*/i, '')
        .replace(/^municipal\s+/i, '').replace(/\s+/g, ' ').trim()
}

async function main() {
    console.log('📖 Loading backup...')
    const backups: BackupPav[] = JSON.parse(fs.readFileSync(BACKUP_JSON, 'utf-8'))
    console.log(`   ${backups.length} backup entries\n`)

    // Fetch current pavilions
    const { data: current } = await supabase.from('pavilions').select('id, nome, search_string')
    if (!current) { console.error('No pavilions'); process.exit(1) }

    console.log(`📋 ${current.length} pavilions to check\n`)

    let updated = 0
    let skipped = 0

    for (const pav of current as { id: number; nome: string; search_string: string | null }[]) {
        const norm = normalize(pav.nome)
        if (norm.length < 4) { skipped++; continue }

        // Find best backup match
        let best: BackupPav | null = null
        let bestScore = 0

        for (const b of backups) {
            const bn = normalize(b.nome)
            if (bn === norm) { best = b; bestScore = 100; break }
            if (bn.includes(norm) || norm.includes(bn)) {
                if (bn.length > bestScore) { best = b; bestScore = bn.length }
            }
            // Word overlap
            const bnWords = bn.split(/\s+/).filter(w => w.length > 2)
            const nWords = norm.split(/\s+/).filter(w => w.length > 2)
            let matches = 0
            for (const w of nWords) {
                if (bnWords.some(bw => bw === w || bw.includes(w) || w.includes(bw))) matches++
            }
            const score = matches * 10
            if (score > bestScore && matches >= 2) { best = b; bestScore = score }
        }

        if (best && best.nome !== pav.nome) {
            const { error } = await supabase
                .from('pavilions')
                .update({
                    nome: best.nome,
                    search_string: pav.nome, // keep Google name in search_string
                })
                .eq('id', pav.id)

            if (error) {
                console.log(`   ❌ ${pav.nome.substring(0, 40)}: ${error.message}`)
            } else {
                updated++
                console.log(`   ✅ "${pav.nome.substring(0, 30)}" → "${best.nome.substring(0, 30)}"`)
            }
        } else {
            skipped++
        }
    }

    console.log(`\n✅ ${updated} names restored to FPB, ${skipped} skipped`)
    console.log('\n⚠️  Now re-run: npx tsx web/scripts/restore-recinto-ids.ts')
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1) })
