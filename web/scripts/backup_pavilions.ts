/**
 * Backup current pavilions table before replacing with Google Places data.
 * Run: cd web && npx tsx ../scripts/backup_pavilions.ts
 */
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'

const SUPABASE_URL = 'https://qdzmwgahencinoucvoop.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkem13Z2FoZW5jaW5vdWN2b29wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NTQ2NTEsImV4cCI6MjA4NTUzMDY1MX0.HNcyu7zHA6oxBNh0T7HX-6Ui-8g2fBE5gFP4xtkpPJ4'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const OUT = `scripts/pavilions_backup_${TIMESTAMP}.json`

async function main() {
    const { data, error, count } = await supabase
        .from('pavilions')
        .select('*', { count: 'exact' })

    if (error) {
        console.error('❌ Failed to fetch pavilions:', error.message)
        process.exit(1)
    }

    if (!data || data.length === 0) {
        console.log('⚠️  No pavilions in table — nothing to back up.')
        // Still write an empty file for traceability
        fs.writeFileSync(OUT, '[]', 'utf-8')
        console.log(`📄 Empty backup written to ${OUT}`)
        return
    }

    fs.writeFileSync(OUT, JSON.stringify(data, null, 2), 'utf-8')
    console.log(`✅ Backed up ${data.length} pavilions to ${OUT}`)
    console.log(`   (count from DB: ${count})`)
}

main().catch((err) => {
    console.error('Fatal:', err)
    process.exit(1)
})
