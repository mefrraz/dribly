/**
 * AI Priority Classifier — Usa Llama 3.1 via NVIDIA API para classificar cada clube
 * na prioridade correta baseada nas competições em que participa.
 *
 * Uso:  npx tsx web/scripts/classify-priorities.ts
 * Requer: NVIDIA_API_KEY no ambiente (ou hardcoded abaixo)
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const nvidiaKey = process.env.NVIDIA_API_KEY || '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'

if (!supabaseUrl || !supabaseKey) { console.error('Missing Supabase env vars'); process.exit(1) }

const supabase = createClient(supabaseUrl, supabaseKey, { realtime: { transport: WebSocket } })

const BATCH_SIZE = 20

interface ClubInfo {
    id: number
    name: string
    current_priority: number | null
    competitions: string[]
}

async function classifyBatch(clubs: ClubInfo[]): Promise<{ id: number; priority: number }[]> {
    const prompt = `Classifica cada clube de basquetebol português com uma prioridade de 1 a 4, com base nas competições em que participa na época 2025/2026.

Regras:
- 1 = Liga Betclic (liga profissional principal de Portugal)
- 2 = Proliga OU 1ª Divisão
- 3 = 2ª Divisão OU 3ª Divisão OU competições distritais/regionais
- 4 = Sem competições sénior conhecidas ou dados insuficientes
- IMPORTANTE: clubes da Liga Betclic são APENAS os que têm jogos na "Liga Betclic". Clubes com "Betclic" em ligas femininas ou de formação também são 1.
- Clubes como FC Porto, SL Benfica, Sporting CP, UD Oliveirense, Vitória SC, Ovarense, Imortal, FC Gaia, Galitos, Illiabum, CAB Madeira, Queluz, Lusitânia são tipicamente da Liga Betclic (prioridade 1).
- Ignora competições de formação (Sub-14, Sub-16, Sub-18) e taças.
- Responde APENAS com o ID e a prioridade no formato: ID,PRIORIDADE (um por linha). Exemplo: 127,1

Clubes a classificar:
${clubs.map(c => `ID ${c.id}: "${c.name}" (atual: ${c.current_priority ?? '?'}) — ${c.competitions.slice(0, 5).join(', ') || 'sem dados'}`).join('\n')}

Resposta (ID,PRIORIDADE):`

    const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${nvidiaKey}`,
        },
        body: JSON.stringify({
            model: 'meta/llama-3.1-8b-instruct',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
            top_p: 0.5,
            max_tokens: 2048,
        }),
    })

    const json = await res.json() as { choices?: { message?: { content?: string } }[] }
    const text = json.choices?.[0]?.message?.content || ''

    // Parse response: "127,1\n128,2\n..."
    const results: { id: number; priority: number }[] = []
    for (const line of text.split('\n')) {
        const match = line.match(/(\d+)\s*[,;\s]\s*(\d)/)
        if (match) {
            const id = parseInt(match[1])
            const p = parseInt(match[2])
            if (id > 0 && p >= 1 && p <= 4) {
                results.push({ id, priority: p })
            }
        }
    }
    return results
}

async function main() {
    console.log('🤖 A classificar clubes com IA...\n')

    // Get clubs with their competition data
    const [{ data: clubs }, { data: games }] = await Promise.all([
        supabase.from('clubs').select('id, name, priority').order('id'),
        supabase.from('games_2025_2026').select('equipa_casa, equipa_fora, competicao'),
    ])

    if (!clubs) { console.error('No clubs'); process.exit(1) }

    // Build club → competitions map with proper matching
    function norm(s: string): string {
        return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
    }
    const clubNorms = (clubs as { id: number; name: string }[]).map(c => ({ id: c.id, n: norm(c.name) }))
    const clubComps = new Map<number, Set<string>>()

    for (const g of games as { equipa_casa: string; equipa_fora: string; competicao: string | null }[]) {
        const comp = (g.competicao || '').trim()
        if (!comp || /sub[-\s]?1[0-9]|sub[-\s]?[0-9]{2}|formação|distrital|torneio/i.test(comp)) continue

        for (const team of [g.equipa_casa, g.equipa_fora]) {
            const tn = norm(team)
            // Find matching club
            for (const c of clubNorms) {
                let match = false
                if (c.n === tn || c.n.includes(tn) || tn.includes(c.n)) {
                    match = true
                } else {
                    // Fallback by last word
                    const cWords = c.n.split(/\s+/).filter(w => w.length > 3)
                    const tWords = tn.split(/\s+/).filter(w => w.length > 3)
                    if (cWords.length > 0 && tWords.includes(cWords[cWords.length - 1])) {
                        match = true
                    }
                }
                if (match) {
                    if (!clubComps.has(c.id)) clubComps.set(c.id, new Set())
                    clubComps.get(c.id)!.add(comp)
                    break
                }
            }
        }
    }

    // Build club info list
    const clubList: ClubInfo[] = (clubs as { id: number; name: string; priority: number | null }[]).map(c => ({
        id: c.id,
        name: c.name,
        current_priority: c.priority,
        competitions: [...(clubComps.get(c.id) || new Set())],
    }))

    console.log(`  📋 ${clubList.length} clubes, ${clubList.filter(c => c.competitions.length > 0).length} com competições\n`)

    // Process in batches
    let updated = 0
    for (let i = 0; i < clubList.length; i += BATCH_SIZE) {
        const batch = clubList.slice(i, i + BATCH_SIZE)
        process.stdout.write(`  🧠 Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(clubList.length / BATCH_SIZE)}... `)

        try {
            const results = await classifyBatch(batch)
            for (const { id, priority } of results) {
                const club = clubList.find(c => c.id === id)
                if (club && priority !== club.current_priority) {
                    await supabase.from('clubs').update({ priority }).eq('id', id)
                    console.log(`\n    ${club.current_priority ?? '?'}→${priority}  ${club.name}`)
                    club.current_priority = priority
                    updated++
                }
            }
            process.stdout.write(`${results.length} classificados\n`)
        } catch (err) {
            console.error(`\n    ❌ Erro: ${err}`)
        }

        // Rate limit: 1 second between batches
        await new Promise(r => setTimeout(r, 1000))
    }

    console.log(`\n✅ ${updated} clubes atualizados`)
}

main().catch(err => { console.error(err); process.exit(1) })
