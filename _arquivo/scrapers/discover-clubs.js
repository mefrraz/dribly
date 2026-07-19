import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_KEY
const FPB_BASE = 'https://www.fpb.pt'
const USER_AGENT = 'Mozilla/5.0 (compatible; Dribly-Bot/1.0)'

function slugify(name) {
    return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

async function fetchClubName(id) {
    try {
        const url = `${FPB_BASE}/calendario/clube_${id}/`
        const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
        if (!res.ok) return null
        const html = await res.text()

        // Check if page has any game cards
        if (!html.includes('game-wrapper')) return null

        // Extract ALL team names from game cards
        const allNames = []
        const regex = /<span class="fullName">([^<]+)<\/span>/g
        let match
        while ((match = regex.exec(html)) !== null) {
            allNames.push(match[1].trim())
        }

        if (allNames.length === 0) return null

        // Find most frequent name (the club's own teams appear in every game)
        const freq = {}
        for (const n of allNames) {
            // Remove suffixes like " A", " B", " C" for frequency counting
            const base = n.replace(/\s+[A-C]$/, '').trim()
            freq[base] = (freq[base] || 0) + 1
        }

        // Get the club name (most frequent base name)
        const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1])
        if (sorted.length === 0) return null

        const [baseName, count] = sorted[0]

        // Must appear in at least 3 game cards to be a real club
        if (count < 3) return null

        // Check if the page actually has meaningful game data (not just empty template)
        const gameCount = (html.match(/game-wrapper-a/g) || []).length
        if (gameCount < 2) return null

        return baseName
    } catch {
        return null
    }
}

function isRealClubName(name) {
    if (!name || name.length < 3) return false
    const lower = name.toLowerCase()
    const stops = ['404', 'erro', 'newsletter', 'subscrever', 'segue-nos',
        'patrocinadores', 'parceiros', 'direitos', 'federação', 'fpb -',
        'copyright', 'todos os', 'wp-content', '.png', '.jpg']
    return !stops.some(w => lower.includes(w))
}

async function main() {
    if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing env vars'); process.exit(1) }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
    const START = 1, END = 250

    console.log(`Scanning club IDs ${START} to ${END}...\n`)

    const clubs = []
    const slugs = new Set()

    for (let id = START; id <= END; id++) {
        const name = await fetchClubName(id)
        if (!name || !isRealClubName(name)) {
            if (id % 25 === 0) process.stdout.write('.')
            await sleep(300)
            continue
        }

        let slug = slugify(name)
        if (slugs.has(slug)) slug = slugify(name) + '-' + id
        slugs.add(slug)

        clubs.push({ id, name, slug, search_name: name.toLowerCase() })
        console.log(`  [${id}] ${name} → ${slug}`)
        await sleep(300)
    }

    console.log(`\nFound ${clubs.length} clubs.\n`)

    console.log('Clearing and upserting...')
    await supabase.from('clubs').delete().neq('id', 0)

    for (let i = 0; i < clubs.length; i += 25) {
        const chunk = clubs.slice(i, i + 25)
        const { error } = await supabase.from('clubs').upsert(chunk, { onConflict: 'id' })
        if (error) console.error(`  Chunk error:`, error.message)
        else console.log(`  Chunk ${Math.floor(i / 25) + 1}: ${chunk.length} clubs`)
        await sleep(500)
    }
    console.log('\nDone.')
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
main().catch(console.error)
