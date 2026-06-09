/**
 * Update club priorities based on actual 2025/2026 competition data.
 * Single query — matches team names to clubs client-side.
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !supabaseKey) { console.error('Missing env vars'); process.exit(1) }

const supabase = createClient(supabaseUrl, supabaseKey, { realtime: { transport: WebSocket } })

const DIVISION: Record<string, number> = {
    'betclic': 1, 'liga masculina': 1,
    'proliga': 2,
    '1ª divisão': 2, 'primeira divisão': 2,
    '2ª divisão': 3, 'segunda divisão': 3,
}

function norm(s: string): string {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

async function main() {
    console.log('🔍 A analisar competições dos clubes...\n')

    const [{ data: clubs }, { data: games }] = await Promise.all([
        supabase.from('clubs').select('id, name, priority'),
        supabase.from('games_2025_2026').select('equipa_casa, equipa_fora, competicao'),
    ])

    if (!clubs || !games) { console.error('No data'); process.exit(1) }

    // Build team → best division map
    const teamDivision = new Map<string, number>()
    for (const g of games as { equipa_casa: string; equipa_fora: string; competicao: string | null }[]) {
        const comp = (g.competicao || '').toLowerCase()
        for (const [keyword, div] of Object.entries(DIVISION)) {
            if (comp.includes(keyword)) {
                for (const team of [g.equipa_casa, g.equipa_fora]) {
                    const n = norm(team)
                    const cur = teamDivision.get(n) ?? 99
                    if (div < cur) teamDivision.set(n, div)
                }
                break
            }
        }
    }

    console.log(`  📋 ${teamDivision.size} equipas encontradas em competições conhecidas\n`)

    // Match to clubs and update
    let updated = 0
    for (const club of clubs as { id: number; name: string; priority: number | null }[]) {
        const cn = norm(club.name)
        let newP: number | null = null

        // Exact match
        if (teamDivision.has(cn)) {
            newP = teamDivision.get(cn)!
        } else {
            // Fallback by last word
            const words = cn.split(/\s+/).filter(w => w.length > 3)
            for (let i = words.length - 1; i >= 0; i--) {
                for (const [tn, div] of teamDivision) {
                    if (tn.includes(words[i])) { newP = div; break }
                }
                if (newP) break
            }
        }

        if (newP && newP !== club.priority) {
            await supabase.from('clubs').update({ priority: newP }).eq('id', club.id)
            console.log(`  ${club.priority ?? '?'}→${newP}  ${club.name}`)
            updated++
        }
    }

    console.log(`\n✅ ${updated} clubes atualizados`)
}

main().catch(err => { console.error(err); process.exit(1) })
