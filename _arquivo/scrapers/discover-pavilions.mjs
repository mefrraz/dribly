/**
 * Discover new pavilions from FPB game locations.
 * ONLY INSERTS — never updates existing pavilions.
 * Skips if name or recinto_id already exists.
 *
 * Usage:
 *   node scrapers/discover-pavilions.mjs
 */

import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '.env') })

const { createClient } = await import('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_KEY')
    process.exit(1)
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── Clean names ────────────────────────────────────────
const SKIP = [/^a\s+indicar/i, /^a\s+designar/i, /^por\s+definir/i, /^indefinido/i, /^campo\s+exterior/i, /^ringue/i]
function clean(raw) {
    let name = raw.trim()
    for (const p of SKIP) if (p.test(name)) return null
    name = name.replace(/\s*,[A-Z][a-z].*$/, '')                         // ",Porto"
    name = name.replace(/\s*(Sub|S[eé]nior|Senior|Mini|Juniores)\s+\d{1,2}\s*(Feminino|Masculino|Fem|Masc)?\s*\|.*$/i, '')
    name = name.replace(/\s*\|\s*(Liga|Taça|Campeonato|Torneio|Circuito|Jogos|FIBA|BCL|1ª|2ª|C\.I\.).*$/i, '')
    name = name.replace(/\s*,\s*$/, '').trim()
    if (name.length < 4 || !/[a-zA-Z\u00C0-\u024F]/.test(name)) return null
    return name
}

// ── Scan games ─────────────────────────────────────────
const TABLES = ['games_2025_2026', 'games_2024_2025', 'games_2023_2024', 'games_2022_2023']
console.log('🔍 Scanning games...')
const found = new Map()
for (const t of TABLES) {
    let from = 0
    while (true) {
        const { data } = await supabase.from(t).select('local, recinto_id').range(from, from + 999).not('local', 'is', null)
        if (!data || data.length === 0) break
        for (const r of data) {
            const nome = clean(r.local || '')
            if (!nome) continue
            const k = nome.toLowerCase()
            if (!found.has(k)) found.set(k, { nome, recinto_id: r.recinto_id || null })
            else if (!found.get(k).recinto_id && r.recinto_id) found.get(k).recinto_id = r.recinto_id
        }
        if (data.length < 1000) break
        from += 1000
    }
}
console.log(`  ${found.size} unique locations`)

// ── Fetch existing pavilions ───────────────────────────
const { data: ex } = await supabase.from('pavilions').select('id, nome, recinto_id')
const exNames = new Set((ex || []).map(p => p.nome.toLowerCase().trim()))
const exRecintos = new Set((ex || []).filter(p => p.recinto_id).map(p => p.recinto_id))
console.log(`  ${exNames.size} already in database`)

// ── Find new ones ──────────────────────────────────────
const news = []
for (const [, info] of found) {
    if (info.recinto_id && exRecintos.has(info.recinto_id)) continue
    const n = info.nome.toLowerCase()
    if (exNames.has(n)) continue
    let dup = false
    for (const en of exNames) { if (en.includes(n) || n.includes(en)) { dup = true; break } }
    if (dup) continue
    const fpb_url = info.recinto_id ? `https://www.fpb.pt/recinto/${info.recinto_id}/` : null
    news.push({ nome: info.nome, recinto_id: info.recinto_id, fpb_url, geocode_ok: false })
}

console.log(`\n📋 ${news.length} NEW pavilions:`)
news.slice(0, 40).forEach(p => console.log(`  • ${p.nome}${p.recinto_id ? ' (recinto ' + p.recinto_id + ')' : ''}`))
if (news.length > 40) console.log(`  ... and ${news.length - 40} more`)

// ── Insert only ────────────────────────────────────────
if (news.length > 0) {
    console.log('\n💾 Inserting...')
    let ok = 0
    for (const p of news) {
        const { error } = await supabase.from('pavilions').insert(p)
        if (error) { if (error.code !== '23505') console.log(`  ❌ ${p.nome}: ${error.message}`) }
        else { ok++; console.log(`  ✅ ${p.nome}`) }
    }
    console.log(`\n🏁 ${ok} inserted.`)
} else {
    console.log('\n✅ No new pavilions.')
}
