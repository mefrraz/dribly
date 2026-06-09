/**
 * update-priorities — Atualiza a prioridade de cada clube com base nas competições
 * em que participa na época 2025/2026.
 *
 * Liga Betclic (10902) → priority 1
 * Proliga (10903) / 1ª Divisão (10904) → priority 2
 * 2ª Divisão (10905) → priority 3
 * Sem jogos ou outras → mantém priority atual
 *
 * Uso:  npx tsx web/scripts/update-priorities.ts
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, { realtime: { transport: WebSocket } })

const DIVISION_MAP: Record<number, number> = {
    10902: 1, // Liga Betclic
    10903: 2, // Proliga
    10904: 2, // 1ª Divisão
    10905: 3, // 2ª Divisão
}

async function main() {
    console.log('🔍 A analisar competições dos clubes...\n')

    const { data: clubs } = await supabase.from('clubs').select('id, name, priority')
    if (!clubs) { console.error('No clubs'); process.exit(1) }

    const updated: string[] = []
    const errors: string[] = []

    for (const club of clubs as { id: number; name: string; priority: number | null }[]) {
        // Check which competitions this club appears in (via game data)
        const { data: games } = await supabase
            .from('games_2025_2026')
            .select('competicao, escalao')
            .or(`equipa_casa.ilike.%${club.name}%,equipa_fora.ilike.%${club.name}%`)
            .limit(50)

        if (!games || games.length === 0) continue

        // Determine division from game competition names
        let newPriority = club.priority
        const compNames = new Set((games as { competicao: string | null }[]).map(g => g.competicao).filter(Boolean))

        // Try to match by known competition names
        for (const cn of compNames) {
            const name = (cn || '').toLowerCase()
            if (name.includes('betclic') || name.includes('liga masculina') && !name.includes('proliga') && !name.includes('1ª') && !name.includes('2ª')) {
                newPriority = 1
                break
            }
            if (name.includes('proliga')) { newPriority = 2; break }
            if (name.includes('1ª divisão') || name.includes('primeira divisão')) { newPriority = 2; break }
            if (name.includes('2ª divisão') || name.includes('segunda divisão')) { newPriority = 3; break }
        }

        if (newPriority !== club.priority) {
            const { error } = await supabase
                .from('clubs')
                .update({ priority: newPriority })
                .eq('id', club.id)

            if (error) {
                errors.push(`${club.name}: ${error.message}`)
            } else {
                updated.push(`${club.name}: ${club.priority} → ${newPriority}`)
            }
        }
    }

    console.log(`  ✅ ${updated.length} clubes atualizados`)
    if (updated.length > 0) {
        console.log('\n  Alterações:')
        updated.forEach(u => console.log(`    ${u}`))
    }
    if (errors.length > 0) {
        console.log('\n  ❌ Erros:')
        errors.forEach(e => console.log(`    ${e}`))
    }
    console.log('\n🏆 Prioridades atualizadas!')
}

main().catch(err => { console.error(err); process.exit(1) })
