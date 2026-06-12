/**
 * List all pavilions: name — address, one per line.
 * Run: npx tsx web/scripts/list-pavilions.ts > pavilhoes.txt
 */
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '..', '.env') })

const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || '')

async function main() {
  const pavilions: any[] = []
  for (let i = 0; true; i += 1000) {
    const { data } = await supabase.from('pavilions').select('nome,rua,codigo_postal,cidade').range(i, i + 999)
    if (!data || data.length === 0) break
    pavilions.push(...data)
  }

  for (const p of pavilions) {
    const addr = [p.rua, p.codigo_postal, p.cidade].filter(Boolean).join(', ')
    console.log(`${p.nome} — ${addr || 'sem morada'}`)
  }
}
main()
