/**
 * Restore recinto_id values to pavilions table from backup.
 *
 * The Google Places import cleared recinto_id (set to null).
 * This script fuzzy-matches backup names against current Google names
 * and restores recinto_id where there's a confident match.
 *
 * Usage:
 *   $env:SUPABASE_SERVICE_KEY = "..."
 *   npx tsx web/scripts/restore-recinto-ids.ts
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

// Find most recent backup
const SCRIPTS_DIR = path.join(__dirname, '..', '..', 'scripts')
const backupFiles = fs.readdirSync(SCRIPTS_DIR)
    .filter(f => f.startsWith('pavilions_backup_') && f.endsWith('.json'))
    .sort()
    .reverse()

if (backupFiles.length === 0) {
    console.error('❌ No backup found in scripts/')
    process.exit(1)
}

const BACKUP_JSON = path.join(SCRIPTS_DIR, backupFiles[0])

interface BackupPav {
    id: number
    recinto_id: number | null
    nome: string
}

function normalize(n: string): string {
    return n.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/^pavilhao\s+(municipal\s+)?/i, '')
        .replace(/^pav\.\s*/i, '').replace(/^mun\.\s*/i, '')
        .replace(/^municipal\s+/i, '')
        .replace(/\s+/g, ' ').trim()
}

async function main() {
    console.log('📖 Reading backup:', path.basename(BACKUP_JSON))
    const backups: BackupPav[] = JSON.parse(fs.readFileSync(BACKUP_JSON, 'utf-8'))
        .filter((b: BackupPav) => b.recinto_id)
    console.log(`   ${backups.length} with recinto_id\n`)

    // Fetch current pavilions (those with null recinto_id)
    const { data: current } = await supabase
        .from('pavilions')
        .select('id, nome, recinto_id')
        .is('recinto_id', null)

    if (!current || current.length === 0) {
        console.log('No pavilions need recinto_id restoration.')
        return
    }

    console.log(`📋 ${current.length} pavilions with null recinto_id\n`)

    let updated = 0
    let skipped = 0

    for (const pav of current as { id: number; nome: string; recinto_id: number | null }[]) {
        const norm = normalize(pav.nome)
        if (norm.length < 4) { skipped++; continue }

        // Try exact normalized match first
        let match: BackupPav | null = null
        for (const b of backups) {
            if (normalize(b.nome) === norm) { match = b; break }
        }
        // Then substring containment
        if (!match) {
            let bestLen = 0
            for (const b of backups) {
                const bn = normalize(b.nome)
                if (bn.includes(norm) || norm.includes(bn)) {
                    if (bn.length > bestLen) { match = b; bestLen = bn.length }
                }
            }
        }

        if (match && match.recinto_id) {
            const { error } = await supabase
                .from('pavilions')
                .update({ recinto_id: match.recinto_id })
                .eq('id', pav.id)

            if (error) {
                console.log(`   ❌ ${pav.nome.substring(0, 45)}: ${error.message}`)
            } else {
                updated++
                console.log(`   ✅ ${pav.nome.substring(0, 45)} → recinto_id=${match.recinto_id}`)
            }
        } else {
            skipped++
            console.log(`   ⏭️  ${pav.nome.substring(0, 45)} — no match`)
        }
    }

    console.log(`\n✅ Done! ${updated} restored, ${skipped} skipped (no match)`)
}

main().catch((err) => {
    console.error('Fatal:', err)
    process.exit(1)
})
