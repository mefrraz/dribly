/**
 * Clean pavilion names via AI (NVIDIA NIM — Llama 3.1 8B, free tier).
 *
 * Fixes: spelling errors, missing "Pavilhão" prefix, ALL CAPS, inconsistent
 * abbreviations ("Mun." → "Municipal"), and truncated/incomplete names.
 *
 * Usage:
 *   cd web
 *   NVIDIA_API_KEY=nvapi-... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx tsx scripts/clean-pavilion-names.ts
 *
 * Dry-run mode (default): shows proposed changes without writing.
 * Pass --apply to actually update the database.
 *
 * Get your free NVIDIA API key: https://build.nvidia.com/explore/discover
 * Model: meta/llama-3.1-8b-instruct (free tier, no cost)
 */

import { createClient } from '@supabase/supabase-js'
import * as readline from 'readline'

// ── Config ────────────────────────────────────────────

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || ''
const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const APPLY = process.argv.includes('--apply')
const BATCH_SIZE = 20 // pavilions per API call

if (!NVIDIA_API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing env vars. Needed: NVIDIA_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

interface Pavilion {
    id: number
    nome: string
}

// ── AI prompt ──────────────────────────────────────────

const SYSTEM_PROMPT = `You are a Portuguese-language data cleaner for basketball pavilion names in Portugal.

Rules:
- Fix spelling errors and typos.
- Expand abbreviations: "Mun." → "Municipal", "Pav." → "Pavilhão", "Gimn." → "Ginásio", "Desp." → "Desportivo", "Esc." → "Escola", "EB " → "Escola Básica ", "Sec." → "Secundária", "C." → "Centro", "Assoc." → "Associação".
- If the name is in ALL CAPS, convert to Title Case (first letter of each word).
- If the name is clearly missing "Pavilhão" at the start and is a pavilion, add it.
- Remove trailing spaces, double spaces, and fix whitespace.
- Preserve: "Pavilhão Municipal de [City]", "Pavilhão [Club Name]", "Pavilhão da [School]", "Pavilhão Gimnodesportivo", "Pavilhão Desportivo", "Pavilhão [Number] de [Month]" etc.
- Names like "Campo", "Campo de Jogos", "Pista" are NOT pavilions — leave them as-is.
- If the name is already correct, return it unchanged.
- Return ONLY the corrected name, no explanation, no quotes. One name per line, same order as input.`

// ── Name classification ───────────────────────────────

/** Returns true if the name needs AI cleaning */
function shouldClean(name: string): boolean {
    const n = name.trim()
    if (!n || n.length < 4) return false

    // Already clean: starts with "Pavilhão" and is Title Case with no ALL CAPS words
    if (/^Pavilhão\s/.test(n) && !/[A-ZÀ-Ú]{3,}/.test(n.replace(/^Pavilhão\s/, ''))) {
        // Still check for common abbreviations
        if (/\bMun\.\b/.test(n)) return true
        if (/\bPav\.\s/.test(n) && !/^Pav\.\s/.test(n)) return true
        // Already clean enough
        return false
    }

    // Needs cleaning: ALL CAPS, abbreviations, missing prefix
    return true
}

// ── Main ──────────────────────────────────────────────

async function main() {
    console.log('📖 Fetching pavilions from Supabase...')
    const { data, error } = await supabase
        .from('pavilions')
        .select('id, nome')
        .order('id')

    if (error || !data) {
        console.error('Failed to fetch pavilions:', error)
        process.exit(1)
    }

    const pavilions = data as Pavilion[]
    console.log(`📋 ${pavilions.length} pavilions total\n`)

    // Filter to only those needing cleanup
    const dirty = pavilions.filter(p => shouldClean(p.nome))
    console.log(`🔍 ${dirty.length} pavilions flagged for cleaning:\n`)

    if (dirty.length === 0) {
        console.log('✅ All names look clean — nothing to do!')
        process.exit(0)
    }

    // Show preview
    for (const p of dirty) {
        console.log(`  ${p.id.toString().padStart(4)}  ${p.nome}`)
    }

    if (!APPLY) {
        console.log(`\n💡 Dry-run mode. Run with --apply to send ${dirty.length} names to Llama 3.1 8B (NVIDIA NIM) and update the database.`)
        console.log(`   Cost: FREE (NVIDIA NIM free tier)`)
        process.exit(0)
    }

    // ── APPLY mode ─────────────────────────────────────

    console.log('\n⚠️  This will call NVIDIA NIM API and UPDATE the pavilions table.')
    console.log(`   ${dirty.length} names will be sent for cleaning.`)
    console.log('   Press Enter to continue, or Ctrl+C to cancel...')

    // Auto-confirm when stdin is piped (non-interactive)
    if (process.stdin.isTTY) {
        await new Promise<void>((resolve) => {
            const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
            rl.question('', () => { rl.close(); resolve() })
        })
    } else {
        console.log('(auto-confirming — non-interactive mode)')
    }

    // Process in batches
    const corrections: { id: number; old: string; new: string }[] = []

    for (let i = 0; i < dirty.length; i += BATCH_SIZE) {
        const batch = dirty.slice(i, i + BATCH_SIZE)
        const names = batch.map(p => p.nome)

        console.log(`\n🤖 Sending batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(dirty.length / BATCH_SIZE)} (${batch.length} names)...`)

        try {
            const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${NVIDIA_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'meta/llama-3.1-8b-instruct',
                    messages: [
                        { role: 'system', content: SYSTEM_PROMPT },
                        { role: 'user', content: names.join('\n') },
                    ],
                    temperature: 0,
                    top_p: 0.7,
                    max_tokens: batch.length * 60,
                }),
            })

            if (!res.ok) {
                const err = await res.text()
                console.error(`  ❌ API error (${res.status}): ${err.slice(0, 200)}`)
                continue
            }

            const json = await res.json() as {
                choices: Array<{ message: { content: string } }>
                usage?: { total_tokens: number; prompt_tokens: number; completion_tokens: number }
            }

            const cleaned = json.choices?.[0]?.message?.content?.trim().split('\n') || []

            if (json.usage) {
                console.log(`  📊 Tokens: ${json.usage.total_tokens} (prompt ${json.usage.prompt_tokens}, completion ${json.usage.completion_tokens})`)
            }

            for (let j = 0; j < batch.length; j++) {
                const oldName = batch[j].nome
                const newName = (cleaned[j] || '').trim()
                if (newName && newName !== oldName) {
                    corrections.push({ id: batch[j].id, old: oldName, new: newName })
                    console.log(`  ✏️  #${batch[j].id}: "${oldName}" → "${newName}"`)
                } else if (newName === oldName) {
                    console.log(`  ✅ #${batch[j].id}: "${oldName}" (already correct)`)
                } else {
                    console.log(`  ⚠️  #${batch[j].id}: empty response, keeping "${oldName}"`)
                }
            }

            // Small delay between batches to be nice to the API
            if (i + BATCH_SIZE < dirty.length) {
                await new Promise(r => setTimeout(r, 500))
            }

        } catch (err) {
            console.error(`  ❌ Batch failed: ${(err as Error).message}`)
        }
    }

    console.log(`\n📝 ${corrections.length} corrections identified.`)

    if (corrections.length === 0) {
        console.log('Nothing to update.')
        process.exit(0)
    }

    // Update Supabase one by one (simple, reliable)
    console.log('\n💾 Updating Supabase...')
    let updated = 0
    for (const c of corrections) {
        const { error: updateErr } = await supabase
            .from('pavilions')
            .update({ nome: c.new })
            .eq('id', c.id)

        if (updateErr) {
            console.log(`  ❌ #${c.id}: ${updateErr.message}`)
        } else {
            console.log(`  ✅ #${c.id}: updated`)
            updated++
        }
    }

    console.log(`\n🏁 Done! ${updated}/${corrections.length} pavilion names updated.`)
}

main().catch((err) => {
    console.error('Fatal:', err)
    process.exit(1)
})
