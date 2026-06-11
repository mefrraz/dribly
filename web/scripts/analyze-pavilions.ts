/**
 * Analyze pavilions: find all locations in games, compare with pavilions table.
 * Run: npx tsx web/scripts/analyze-pavilions.ts
 */
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '..', '.env') })

const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || '')

function cleanLocalName(raw: string): string {
  // Remove competition data after "|", collapse whitespace
  return raw.split('|')[0].replace(/\s+/g, ' ').trim()
}

function normalizeName(name: string): string {
  return name.toLowerCase()
    .replace(/^pavilhão\s+/i, '')
    .replace(/^pav\.\s*/i, '')
    .replace(/^pav\s+/i, '')
    .replace(/^mun\.\s*/i, '')
    .replace(/^municipal\s+/i, '')
    .replace(/^complexo\s+desportivo\s+/i, '')
    .replace(/^campo\s+/i, '')
    .replace(/^polidesportivo\s+/i, '')
    .trim()
}

async function main() {
  // 1. Get all unique locations from games
  const allLocations = new Map<string, number>() // normalized → count
  let total = 0
  for (let i = 0; true; i += 1000) {
    const { data } = await supabase.from('games_2025_2026')
      .select('local')
      .not('local', 'is', null)
      .range(i, i + 999)
    if (!data || data.length === 0) break
    total += data.length
    for (const g of data) {
      const cleaned = cleanLocalName(g.local || '')
      if (!cleaned) continue
      const norm = normalizeName(cleaned)
      allLocations.set(norm, (allLocations.get(norm) || 0) + 1)
    }
  }

  console.log(`📊 ${total} jogos analisados, ${allLocations.size} locais únicos\n`)

  // 2. Get all pavilions from DB
  const pavilions: { id: number; nome: string; lat: number | null; lng: number | null }[] = []
  for (let i = 0; true; i += 1000) {
    const { data } = await supabase.from('pavilions').select('id,nome,lat,lng').range(i, i + 999)
    if (!data || data.length === 0) break
    pavilions.push(...(data as any[]))
  }

  const pavNames = new Set(pavilions.map(p => normalizeName(p.nome)))
  console.log(`📍 ${pavilions.length} pavilhões na base de dados`)
  console.log(`   Com coordenadas: ${pavilions.filter(p => p.lat).length}`)
  console.log(`   Sem coordenadas: ${pavilions.filter(p => !p.lat).length}\n`)

  // 3. Find missing: locations in games but NOT in pavilions
  const missing = [...allLocations.entries()]
    .filter(([name]) => !pavNames.has(name))
    .sort((a, b) => b[1] - a[1])

  console.log(`🔍 ${missing.length} locais NÃO têm pavilhão:`)
  console.log()

  for (const [name, count] of missing.slice(0, 30)) {
    const bar = '█'.repeat(Math.min(count, 40))
    console.log(`  ${count.toString().padStart(4)} jogos  ${bar}`)
    console.log(`           "${name}"`)
  }

  if (missing.length > 30) {
    console.log(`\n  ... +${missing.length - 30} mais`)
  }

  // 4. Pavilions with no coordinates
  const noCoords = pavilions.filter(p => !p.lat && !p.lng)
  if (noCoords.length > 0) {
    console.log(`\n🗺️  ${noCoords.length} pavilhões SEM coordenadas:`)
    for (const p of noCoords.slice(0, 10)) {
      console.log(`   #${p.id} "${p.nome}"`)
    }
    if (noCoords.length > 10) console.log(`   ... +${noCoords.length - 10} mais`)
  }

  // 5. Output CSV-ready list of missing pavilions for geocoding
  console.log(`\n📋 Top 20 missing (formato CSV):`)
  console.log(`nome,jogos`)
  for (const [name, count] of missing.slice(0, 20)) {
    // Reconstruct original name (first occurrence)
    console.log(`"${name}",${count}`)
  }
}

main()
