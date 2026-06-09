/**
 * Priority classifier v3 — Uses competition→priority mapping from ChatGPT.
 * Assigns priority to each club based on the BEST (lowest) competition they play in.
 * Clubs without games in mapped competitions keep their current priority.
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !supabaseKey) { console.error('Missing env vars'); process.exit(1) }
const supabase = createClient(supabaseUrl, supabaseKey, { realtime: { transport: WebSocket } })

// From ChatGPT — only national senior competitions (99 = ignore)
const COMP_PRIORITY: Record<string, number> = {
    'Liga Betclic Feminina': 1,
    'Liga Betclic Masculina': 1,
    'Liga BCR': 1,
    'Proliga': 2,
    '1ª Divisão Feminina': 2,
    '1ª Divisão Masculina': 3,
    '2ª Divisão Feminina': 3,
    '2ª Divisão Masculina': 4,
}

function norm(s: string): string {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

async function main() {
    console.log('🎯 Priority classifier v3 — competition mapping\n')

    const [{ data: clubs }, { data: games }] = await Promise.all([
        supabase.from('clubs').select('id, name, priority').order('id'),
        supabase.from('games_2025_2026').select('equipa_casa, equipa_fora, competicao'),
    ])
    if (!clubs || !games) { console.error('No data'); process.exit(1) }

    // Step 1: For each known competition, collect all team names
    const compTeams = new Map<string, Set<string>>()
    for (const g of games as { equipa_casa: string; equipa_fora: string; competicao: string | null }[]) {
        const comp = (g.competicao || '').trim()
        if (!COMP_PRIORITY[comp]) continue
        if (!compTeams.has(comp)) compTeams.set(comp, new Set())
        compTeams.get(comp)!.add(g.equipa_casa)
        compTeams.get(comp)!.add(g.equipa_fora)
    }

    console.log('  Competições encontradas:')
    for (const [comp, teams] of compTeams) {
        console.log(`    ${comp} (p${COMP_PRIORITY[comp]}): ${teams.size} equipas`)
    }

    // Step 2: Assign best priority to each team name
    const teamPriority = new Map<string, number>()
    for (const [comp, teams] of compTeams) {
        const p = COMP_PRIORITY[comp]
        for (const team of teams) {
            const cur = teamPriority.get(team) ?? 99
            if (p < cur) teamPriority.set(team, p)
        }
    }

    console.log(`\n  📋 ${teamPriority.size} equipas únicas classificadas\n`)

    // Step 3: Print teams by priority (for manual verification)
    for (let p = 1; p <= 4; p++) {
        const teams = [...teamPriority.entries()].filter(([, v]) => v === p)
        console.log(`  Prioridade ${p} (${teams.length} equipas):`)
        for (const [name] of teams.slice(0, 20)) {
            console.log(`    - ${name}`)
        }
        if (teams.length > 20) console.log(`    ... +${teams.length - 20} mais`)
        console.log()
    }

    // Step 4: Match to clubs (best effort) and update
    console.log('  🔗 A ligar equipas a clubes...')
    let updated = 0
    const skipped: string[] = []

    for (const club of clubs as { id: number; name: string; priority: number | null }[]) {
        const cn = norm(club.name)
        let bestP = 99

        for (const [teamName, p] of teamPriority) {
            const tn = norm(teamName)
            // Exact
            if (cn === tn) { if (p < bestP) bestP = p; continue }
            // Substring either way
            if (cn.includes(tn) || tn.includes(cn)) { if (p < bestP) bestP = p }
            // Common words (last 2+ words of club name appear in team name)
            const cWords = cn.split(/\s+/).filter(w => w.length > 2)
            const tWords = tn.split(/\s+/).filter(w => w.length > 2)
            if (cWords.length >= 2 && tWords.length >= 2) {
                const match = cWords.filter(w => tWords.includes(w)).length
                if (match >= 2) { if (p < bestP) bestP = p }
            }
        }

        if (bestP < 99 && bestP !== club.priority) {
            console.log(`    ${club.priority ?? '?'}→${bestP}  ${club.name}`)
            await supabase.from('clubs').update({ priority: bestP }).eq('id', club.id)
            updated++
        }
    }

    console.log(`\n✅ ${updated} clubes atualizados`)
    if (skipped.length > 0) {
        console.log(`\n⚠️  ${skipped.length} equipas sem match:`)
        skipped.forEach(t => console.log(`    - ${t}`))
    }
}

main().catch(err => { console.error(err); process.exit(1) })
