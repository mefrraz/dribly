/**
 * Discover new pavilions from FPB game locations and add missing ones to Supabase.
 *
 * Scans all games_* tables for unique (local, recinto_id) pairs,
 * cross-references with the pavilions table by name AND recinto_id,
 * and inserts any missing pavilions with name + FPB URL.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_KEY=... node scrapers/discover-pavilions.mjs
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_KEY')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── Fetch all unique game (local, recinto_id) pairs ────

const GAME_TABLES = ['games_2025_2026', 'games_2024_2025', 'games_2023_2024', 'games_2022_2023']

console.log('🔍 Scanning games for unique locations...')
const discovered = new Map<string, { nome: string; recinto_id: number | null }>()
for (const table of GAME_TABLES) {
    let from = 0
    const PAGE = 1000
    while (true) {
        const { data } = await supabase.from(table).select('local, recinto_id').range(from, from + PAGE - 1).not('local', 'is', null)
        if (!data || data.length === 0) break
        for (const row of data) {
            const nome = (row.local || '').trim()
            if (!nome || nome.length < 3) continue
            const key = nome.toLowerCase()
            if (!discovered.has(key)) {
                discovered.set(key, { nome, recinto_id: (row as any).recinto_id || null })
            } else if (!discovered.get(key)!.recinto_id && (row as any).recinto_id) {
                // Upgrade: found a recinto_id for this name
                discovered.get(key)!.recinto_id = (row as any).recinto_id
            }
        }
        if (data.length < PAGE) break
        from += PAGE
    }
}
console.log(`  Found ${discovered.size} unique game locations`)

// ── Fetch existing pavilions ───────────────────────────

const { data: existing } = await supabase.from('pavilions').select('id, nome, recinto_id, fpb_url')
const existingNames = new Set((existing || []).map(p => p.nome.toLowerCase().trim()))
const existingRecintos = new Set((existing || []).filter(p => p.recinto_id).map(p => p.recinto_id!))
console.log(`  ${existingNames.size} pavilions already in database`)

// ── Backfill fpb_url for pavilions that have recinto_id but no URL ──
const missingFpbUrl = (existing || []).filter(p => p.recinto_id && !p.fpb_url)
if (missingFpbUrl.length > 0) {
    console.log(`\n🔧 Backfilling fpb_url for ${missingFpbUrl.length} pavilions...`)
    for (const p of missingFpbUrl) {
        const url = `https://www.fpb.pt/recinto/${p.recinto_id}/`
        await supabase.from('pavilions').update({ fpb_url: url }).eq('id', p.id)
        console.log(`  ✅ ${p.nome} → ${url}`)
    }
}

// ── Match & find new pavilions ─────────────────────────

interface NewPavilion { nome: string; recinto_id: number | null; fpb_url: string | null }

const newPavilions: NewPavilion[] = []
for (const [key, info] of discovered) {
    // Match by recinto_id first (most reliable)
    if (info.recinto_id && existingRecintos.has(info.recinto_id)) continue

    // Match by name
    const norm = key
    let foundByName = existingNames.has(norm)
    if (!foundByName) {
        for (const en of existingNames) {
            if (en.includes(norm) || norm.includes(en)) { foundByName = true; break }
        }
    }
    if (foundByName) continue

    // New pavilion!
    const fpb_url = info.recinto_id ? `https://www.fpb.pt/recinto/${info.recinto_id}/` : null
    newPavilions.push({ nome: info.nome, recinto_id: info.recinto_id, fpb_url })
}

console.log(`\n📋 ${newPavilions.length} NEW pavilions found:`)
newPavilions.slice(0, 40).forEach(p => console.log(`  • ${p.nome}${p.recinto_id ? ` (recinto ${p.recinto_id})` : ''}`))
if (newPavilions.length > 40) console.log(`  ... and ${newPavilions.length - 40} more`)

// ── Insert into Supabase ───────────────────────────────

if (newPavilions.length > 0) {
    console.log('\n💾 Inserting into Supabase...')
    let inserted = 0
    for (const p of newPavilions) {
        const { error } = await supabase.from('pavilions').insert({
            nome: p.nome,
            recinto_id: p.recinto_id,
            fpb_url: p.fpb_url,
            geocode_ok: false,
        })
        if (error) {
            if (error.code === '23505') continue // duplicate
            console.log(`  ❌ ${p.nome}: ${error.message}`)
        } else {
            inserted++
            console.log(`  ✅ ${p.nome}${p.fpb_url ? ' → ' + p.fpb_url : ''}`)
        }
    }
    console.log(`\n🏁 ${inserted} new pavilions inserted.`)
    console.log('💡 Go to /admin/pavilhoes to add addresses, coords and photos.')
} else {
    console.log('\n✅ All pavilions already in database.')
}
