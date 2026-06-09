/**
 * AI Priority Classifier v2 — Classifica clubes APENAS pelo nome (sem matching de jogos).
 * Llama 3.1 sabe quais clubes portugueses estão em cada divisão.
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const nvidiaKey = process.env.NVIDIA_API_KEY || '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'

if (!supabaseUrl || !supabaseKey) { console.error('Missing env vars'); process.exit(1) }
const supabase = createClient(supabaseUrl, supabaseKey, { realtime: { transport: WebSocket } })

const BATCH = 25

async function classify(clubs: { id: number; name: string }[]): Promise<{ id: number; priority: number }[]> {
    const prompt = `Classifica cada clube de basquetebol português com prioridade 1-4 baseado na divisão onde joga (época 2025/2026):

1 = Liga Betclic Masculina (liga profissional principal: FC Porto, SL Benfica, Sporting CP, UD Oliveirense, Vitória SC, Ovarense, Imortal, FC Gaia, Galitos, Illiabum, CAB Madeira, Queluz, Lusitânia, Esgueira, Portimonense, etc.)
2 = Proliga ou 1ª Divisão Masculina
3 = 2ª Divisão, CN1, CN2, distritais, restantes competições nacionais masculinas
4 = Sem equipa sénior masculina, só formação, ou desconhecido

Responde EXATAMENTE no formato: ID,PRIORIDADE (um por linha). Exemplo:
127,1

Clubes:
${clubs.map(c => `${c.id},"${c.name}"`).join('\n')}

Classificação:`

    const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${nvidiaKey}` },
        body: JSON.stringify({
            model: 'meta/llama-3.1-8b-instruct',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1, top_p: 0.5, max_tokens: 2048,
        }),
    })

    const json = await res.json() as { choices?: { message?: { content?: string } }[] }
    const text = json.choices?.[0]?.message?.content || ''
    const results: { id: number; priority: number }[] = []
    for (const line of text.split('\n')) {
        const m = line.match(/(\d+)\s*[,;\s]\s*(\d)/)
        if (m) {
            const id = parseInt(m[1]), p = parseInt(m[2])
            if (id > 0 && p >= 1 && p <= 4) results.push({ id, priority: p })
        }
    }
    return results
}

async function main() {
    console.log('🤖 AI Priority Classifier v2\n')

    const { data: clubs } = await supabase.from('clubs').select('id, name, priority').order('id')
    if (!clubs) { console.error('No clubs'); process.exit(1) }

    const list = clubs as { id: number; name: string; priority: number | null }[]
    console.log(`  📋 ${list.length} clubes\n`)

    let updated = 0
    for (let i = 0; i < list.length; i += BATCH) {
        const batch = list.slice(i, i + BATCH)
        process.stdout.write(`  🧠 ${Math.floor(i/BATCH)+1}/${Math.ceil(list.length/BATCH)}... `)
        try {
            const results = await classify(batch)
            let changed = 0
            for (const { id, priority } of results) {
                const club = list.find(c => c.id === id)
                if (club && priority !== club.priority) {
                    await supabase.from('clubs').update({ priority }).eq('id', id)
                    console.log(`\n    ${club.priority ?? '?'}→${priority}  ${club.name}`)
                    club.priority = priority
                    updated++
                    changed++
                }
            }
            process.stdout.write(`${results.length} ok, ${changed} mudanças\n`)
        } catch (err) {
            console.error(`\n    ❌ ${err}`)
        }
        await new Promise(r => setTimeout(r, 1200))
    }

    console.log(`\n✅ ${updated} clubes atualizados`)
}

main().catch(err => { console.error(err); process.exit(1) })
