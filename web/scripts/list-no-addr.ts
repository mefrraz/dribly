import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '..', '.env') })
const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || '')

async function main() {
  const pavs: any[] = []
  for (let i = 0; true; i += 1000) {
    const { data } = await supabase.from('pavilions').select('nome').range(i, i + 999)
    if (!data || data.length === 0) break
    pavs.push(...data)
  }
  for (const p of pavs) console.log(p.nome)
}
main()
