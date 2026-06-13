/**
 * Apply extracted logo colors to clubs, with manual overrides.
 * Runs the sharp extraction, then applies overrides, then updates Supabase.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx web/scripts/apply-club-colors.ts
 */

import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── Manual overrides ──────────────────────────────────

const OVERRIDES: Record<number, string> = {
    127: '#C30000',   // Benfica — keep original red
    181: '#95a5a6',   // União Académica António Aroso — gray (logo is white/gray)
    704: '#27AE60',   // Brandoense — keep original green
    3155: '#387EFF',  // Powertogether — keep original blue
    866: '#E67E22',   // Queluz — more orange
    3419: '#E67E22',  // LMCB Linces de Mafra — more orange
}

// ── Color extraction (same logic as preview) ──────────

function isNearWhite(r: number, g: number, b: number) { return r > 240 && g > 240 && b > 240 }
function isNearBlack(r: number, g: number, b: number) { return r < 25 && g < 25 && b < 25 }
function isGray(r: number, g: number, b: number) { const mx = Math.max(r,g,b); const mn = Math.min(r,g,b); return mx - mn < 20 }
function rgbToHex(r: number, g: number, b: number) { return '#'+[r,g,b].map(c=>c.toString(16).padStart(2,'0')).join('') }
function sat(r: number, g: number, b: number) { const mx = Math.max(r,g,b); const mn = Math.min(r,g,b); return mx===0?0:(mx-mn)/mx }

async function extractColor(url: string): Promise<string | null> {
    try {
        const res = await fetch(url)
        if (!res.ok) return null
        const buf = Buffer.from(await res.arrayBuffer())
        const { data } = await sharp(buf).resize(50,50,{fit:'inside'}).removeAlpha().raw().toBuffer({resolveWithObject:true})
        const px = data as Buffer
        const m = new Map<string,{n:number;r:number;g:number;b:number;s:number}>()
        for (let i=0;i<px.length;i+=3) {
            const r=px[i],g=px[i+1],b=px[i+2]
            if (isNearWhite(r,g,b)||isNearBlack(r,g,b)||isGray(r,g,b)) continue
            const k=`${Math.round(r/16)*16},${Math.round(g/16)*16},${Math.round(b/16)*16}`
            const e=m.get(k); if(e){e.n++}else{m.set(k,{n:1,r,g,b,s:sat(r,g,b)})}
        }
        if (m.size===0) return null
        let best=null as {r:number;g:number;b:number}|null; let bestS=0
        for(const[,c]of m){const s=c.n*(0.3+c.s*0.7); if(s>bestS){bestS=s;best={r:c.r,g:c.g,b:c.b}}}
        return best?rgbToHex(best.r,best.g,best.b):null
    } catch { return null }
}

// ── Main ──────────────────────────────────────────────

async function main() {
    console.log('📖 Fetching clubs...')
    const { data } = await supabase.from('clubs').select('id, name, logo_url').order('id')
    if (!data) { console.error('No data'); process.exit(1) }
    const clubs = data as { id: number; name: string; logo_url: string | null }[]
    const withLogos = clubs.filter(c => c.logo_url)
    console.log(`🎨 Extracting colors for ${withLogos.length} clubs...\n`)

    const updates: { id: number; name: string; color: string }[] = []
    let done = 0

    for (const club of withLogos) {
        done++
        // Check override first
        if (OVERRIDES[club.id] !== undefined) {
            updates.push({ id: club.id, name: club.name, color: OVERRIDES[club.id] })
        } else {
            const color = await extractColor(club.logo_url!)
            if (color) updates.push({ id: club.id, name: club.name, color })
        }
        if (done % 30 === 0) console.log(`  ... ${done}/${withLogos.length}`)
        await new Promise(r => setTimeout(r, 80))
    }

    console.log(`\n💾 Updating ${updates.length} clubs...\n`)
    let ok = 0, err = 0
    for (const u of updates) {
        const isOverride = OVERRIDES[u.id] !== undefined
        const { error } = await supabase.from('clubs').update({ primary_color: u.color }).eq('id', u.id)
        if (error) { console.log(`  ❌ #${u.id} ${u.name}: ${error.message}`); err++ }
        else { console.log(`  ✅ #${u.id} ${u.name.padEnd(45)} ${u.color}${isOverride ? ' (manual)' : ''}`); ok++ }
    }

    console.log(`\n🏁 Done! ${ok} updated, ${err} errors.`)
    if (Object.keys(OVERRIDES).length > 0) {
        console.log(`📝 ${Object.keys(OVERRIDES).length} manual overrides applied.`)
    }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
