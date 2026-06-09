/**
 * Deterministic priority assignment — reads games from national competitions
 * and assigns priority based on which competition each team plays in.
 *
 * Liga Betclic Masculina  → 1
 * Proliga                  → 2
 * 1ª Divisão Masculina     → 2
 * 2ª Divisão Masculina     → 3
 * Others / no data          → 4
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !supabaseKey) { console.error('Missing env vars'); process.exit(1) }
const supabase = createClient(supabaseUrl, supabaseKey, { realtime: { transport: WebSocket } })

function norm(s: string): string {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

async function getPriority(teamNames: string[], clubs: { id: number; name: string }[]): Promise<[number, number][]> {
    // Build lookup maps
    const exact = new Map<string, number>()
    const wordIdx = new Map<string, number[]>()
    for (const c of clubs) {
        const n = norm(c.name)
        exact.set(n, c.id)
        for (const w of n.split(/\s+/).filter(w => w.length > 3)) {
            if (!wordIdx.has(w)) wordIdx.set(w, [])
            wordIdx.get(w)!.push(c.id)
        }
    }

    const clubDiv: Map<number, Set<number>> = new Map()
    for (const tn of teamNames) {
        const name = norm(tn)

        // Exact
        if (exact.has(name)) {
            const cid = exact.get(name)!
            if (!clubDiv.has(cid)) clubDiv.set(cid, new Set())
            continue
        }

        // Substring
        let found = false
        for (const [cn, cid] of exact) {
            if (cn.includes(name) || name.includes(cn)) {
                if (!clubDiv.has(cid)) clubDiv.set(cid, new Set())
                found = true
                break
            }
        }
        if (found) continue

        // Word match (only if unique)
        for (const w of name.split(/\s+/).filter(w => w.length > 3)) {
            const ids = wordIdx.get(w)
            if (ids && ids.length === 1) {
                if (!clubDiv.has(ids[0])) clubDiv.set(ids[0], new Set())
                break
            }
        }
    }
    return [...clubDiv.entries()]
}

async function main() {
    console.log('🎯 Priority classifier — deterministic\n')

    const [{ data: clubs }, { data: games }] = await Promise.all([
        supabase.from('clubs').select('id, name, priority').order('id'),
        supabase.from('games_2025_2026').select('equipa_casa, equipa_fora, competicao'),
    ])
    if (!clubs || !games) { console.error('No data'); process.exit(1) }

    const clubList = clubs as { id: number; name: string; priority: number | null }[]

    // Categorize teams by competition
    const div1 = new Set<string>()
    const div2 = new Set<string>()
    const div3 = new Set<string>()

    for (const g of games as { equipa_casa: string; equipa_fora: string; competicao: string | null }[]) {
        const comp = (g.competicao || '').toLowerCase()
        let div: number | null = null
        if (comp.includes('liga betclic') && comp.includes('masculin')) div = 1
        else if (comp.includes('proliga')) div = 2
        else if (comp.includes('1ª divisão') && comp.includes('masculin')) div = 2
        else if (comp.includes('2ª divisão') && comp.includes('masculin')) div = 3
        if (!div) continue

        const set = div === 1 ? div1 : div === 2 ? div2 : div3
        set.add(g.equipa_casa)
        set.add(g.equipa_fora)
    }

    console.log(`  📋 Div 1 (Betclic): ${div1.size} equipas`)
    console.log(`  📋 Div 2 (Proliga/1ª): ${div2.size} equipas`)
    console.log(`  📋 Div 3 (2ª): ${div3.size} equipas\n`)

    // Match to clubs
    const [res1, res2, res3] = await Promise.all([
        getPriority([...div1], clubList),
        getPriority([...div2], clubList),
        getPriority([...div3], clubList),
    ])

    // Assign: lowest division number wins
    const final = new Map<number, number>()
    for (const [id] of res1) final.set(id, 1)
    for (const [id] of res2) if (!final.has(id)) final.set(id, 2)
    for (const [id] of res3) if (!final.has(id)) final.set(id, 3)

    console.log(`  🏀 ${final.size} clubes classificados por competição\n`)

    // Update
    let updated = 0
    for (const [id, priority] of final) {
        const club = clubList.find(c => c.id === id)
        if (club && club.priority !== priority) {
            console.log(`    ${club.priority ?? '?'}→${priority}  ${club.name}`)
            await supabase.from('clubs').update({ priority }).eq('id', id)
            updated++
        }
    }

    // Remaining clubs → priority 4 if not already
    let to4 = 0
    for (const c of clubList) {
        if (!final.has(c.id) && c.priority !== 4) {
            await supabase.from('clubs').update({ priority: 4 }).eq('id', c.id)
            to4++
        }
    }
    if (to4 > 0) console.log(`    📋 ${to4} clubes sem competição nacional → priority 4\n`)

    console.log(`\n✅ ${updated} clubes atualizados`)
}

main().catch(err => { console.error(err); process.exit(1) })
