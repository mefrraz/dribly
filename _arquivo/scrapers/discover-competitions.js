import { createClient } from '@supabase/supabase-js'
import * as cheerio from 'cheerio'
import 'dotenv/config'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_KEY

const TUGABASKET = 'https://resultados.tugabasket.com'

const ASSOCIATIONS = [
    { id: 50, name: 'FPB' },
    { id: 1, name: 'AB Lisboa' },
    { id: 2, name: 'AB Setúbal' },
    { id: 3, name: 'AB Aveiro' },
    { id: 4, name: 'AB Porto' },
    { id: 5, name: 'AB Braga' },
    { id: 6, name: 'AB Madeira' },
    { id: 7, name: 'AB Santarém' },
    { id: 8, name: 'AB Coimbra' },
    { id: 9, name: 'AB Algarve' },
    { id: 10, name: 'AB Viseu' },
    { id: 11, name: 'AB Leiria' },
    { id: 12, name: 'AB Alentejo' },
    { id: 13, name: 'AB Ilha Terceira' },
    { id: 14, name: 'AB Castelo Branco' },
    { id: 15, name: 'AB Bragança' },
    { id: 16, name: 'AB São Miguel' },
    { id: 17, name: 'AB Viana do Castelo' },
    { id: 18, name: 'AB Vila Real' },
    { id: 19, name: 'AB Faial e Pico' },
    { id: 20, name: 'AB Guarda' },
    { id: 22, name: 'AB Santa Maria' },
    { id: 24, name: 'AB Açores' },
]

const USER_AGENT = 'Mozilla/5.0 (compatible; GaienSes-Bot/1.0)'

async function fetchHTML(url) {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
    return res.text()
}

async function discoverCompetitionIds(associationId, seasonId) {
    const url = `${TUGABASKET}/competitions?associationId=${associationId}&seasonId=${seasonId}`
    const html = await fetchHTML(url)
    const $ = cheerio.load(html)

    const comps = []
    $('#competitions a[href*="competitionId="]').each((_, el) => {
        const href = $(el).attr('href') || ''
        const match = href.match(/competitionId=(\d+)/)
        if (match) {
            comps.push({
                id: parseInt(match[1]),
                name: $(el).attr('title') || $(el).text().trim(),
            })
        }
    })
    return comps
}

async function discoverClubNames(competitionId) {
    const url = `${TUGABASKET}/getCompetitionDetails?competitionId=${competitionId}`
    const html = await fetchHTML(url)
    const $ = cheerio.load(html)

    const clubNames = new Set()

    $('table tbody tr').each((_, row) => {
        const cols = $(row).find('td')
        if (cols.length < 6) return

        const home = $(cols[2]).text().trim()
        const away = $(cols[4]).text().trim()

        if (home) clubNames.add(home)
        if (away) clubNames.add(away)
    })

    return [...clubNames]
}

async function main() {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error('Missing SUPABASE_URL or SUPABASE_KEY env vars')
        process.exit(1)
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
    const SEASON_ID = 64
    const SEASON = '2025/2026'

    console.log(`Starting discovery for season ${SEASON}...`)

    const seen = new Set()
    const allComps = []

    for (const assoc of ASSOCIATIONS) {
        console.log(`  Association ${assoc.id} (${assoc.name})...`)
        try {
            const comps = await discoverCompetitionIds(assoc.id, SEASON_ID)
            for (const comp of comps) {
                const key = `${comp.id}-${SEASON}`
                if (seen.has(key)) continue
                seen.add(key)
                allComps.push({ ...comp, associationId: assoc.id, associationName: assoc.name, season: SEASON })
            }
            console.log(`    Found ${comps.length} competitions`)
        } catch (e) {
            console.error(`    Error: ${e.message}`)
        }
        await sleep(1000)
    }

    console.log(`\nTotal unique competitions: ${allComps.length}`)

    console.log('\nDiscovering club names...')
    for (let i = 0; i < allComps.length; i++) {
        const comp = allComps[i]
        try {
            const clubNames = await discoverClubNames(comp.id)
            comp.clubNames = clubNames
            console.log(`  [${i + 1}/${allComps.length}] ${comp.name} (${comp.id}): ${clubNames.length} clubs`)
        } catch (e) {
            console.error(`  [${i + 1}/${allComps.length}] Error for ${comp.id}: ${e.message}`)
            comp.clubNames = []
        }
        await sleep(500)
    }

    console.log('\nUpserting to Supabase...')
    const rows = allComps.map(c => ({
        competition_id: c.id,
        competition_name: c.name,
        association_id: c.associationId,
        association_name: c.associationName,
        season: c.season,
        club_names: c.clubNames || [],
        updated_at: new Date().toISOString(),
    }))

    for (let i = 0; i < rows.length; i += 50) {
        const chunk = rows.slice(i, i + 50)
        const { error } = await supabase
            .from('competitions')
            .upsert(chunk, { onConflict: 'competition_id,season' })
        if (error) {
            console.error(`  Chunk ${i / 50 + 1} error:`, error.message)
        } else {
            console.log(`  Chunk ${i / 50 + 1}: ${chunk.length} rows`)
        }
        await sleep(500)
    }

    console.log('\nDone.')
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

main().catch(console.error)
