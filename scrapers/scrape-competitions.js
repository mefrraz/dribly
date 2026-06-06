import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'
import * as cheerio from 'cheerio'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_KEY
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_KEY in .env')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// Main competitions to pre-warm (Liga Betclic Masc/Fem, Proliga, 1ª Divisão)
const MAIN_COMPETITIONS = [
    { id: 10902, name: 'Liga Betclic Masculina', season: '2025/2026' },
    { id: 10906, name: 'Liga Betclic Feminina', season: '2025/2026' },
    { id: 10903, name: 'Proliga Masculina', season: '2025/2026' },
]

async function fetchHtml(page, competicao) {
    const url = `https://www.fpb.pt/${page}/${competicao}/`
    const res = await fetch(url, {
        headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'pt-PT,pt;q=0.9',
            'Referer': 'https://www.fpb.pt/',
        }
    })
    if (!res.ok) throw new Error(`FPB error: ${res.status} from ${url}`)
    return await res.text()
}

async function scrapeGames(html, defaultStatus) {
    const $ = cheerio.load(html)
    const games = []
    
    $('.day-wrapper').each((_, dayWrapper) => {
        const dateStr = $(dayWrapper).find('h3.date').text().trim()
        const gameLinks = $(dayWrapper).find('a.game-wrapper-a')
        
        gameLinks.each((_, link) => {
            const teamContainers = $(link).find('.team-container')
            const homeName = teamContainers.eq(0).find('.fullName, .sigla').text().trim()
            const awayName = teamContainers.eq(1).find('.fullName, .sigla').text().trim()
            
            let resultado_casa = null
            let resultado_fora = null
            let status = defaultStatus
            
            const scoreEls = $(link).find('.results_wrapper h3.results_text')
            if (scoreEls.length >= 2) {
                status = 'FINALIZADO'
                resultado_casa = parseInt(scoreEls.eq(0).text().trim()) || null
                resultado_fora = parseInt(scoreEls.eq(1).text().trim()) || null
            }
            
            const pavilhao = $(link).find('.location-wrapper b').text().trim() || null
            
            games.push({
                data: dateStr, // Keep original format, let frontend parse or store as is
                equipa_casa: homeName,
                equipa_fora: awayName,
                resultado_casa,
                resultado_fora,
                local: pavilhao,
                status,
                competicao_id: null // Will be set by caller
            })
        })
    })
    return games
}

async function main() {
    console.log('Starting competition pre-warming...')
    
    for (const comp of MAIN_COMPETITIONS) {
        console.log(`\nProcessing: ${comp.name} (${comp.id})`)
        
        try {
            // 1. Fetch and upsert Schedule
            console.log('  Fetching schedule...')
            const scheduleHtml = await fetchHtml('calendario', comp.id)
            const scheduleGames = await scrapeGames(scheduleHtml, 'AGENDADO')
            
            if (scheduleGames.length > 0) {
                const upsertData = scheduleGames.map(g => ({
                    ...g,
                    competicao_id: comp.id,
                    temporada: comp.season,
                    updated_at: new Date().toISOString()
                }))
                
                const { error } = await supabase
                    .from('games')
                    .upsert(upsertData, { onConflict: 'data,equipa_casa,equipa_fora,competicao_id' })
                
                if (error) {
                    console.error(`  Error upserting schedule: ${error.message}`)
                } else {
                    console.log(`  ✓ Upserted ${scheduleGames.length} scheduled games`)
                }
            }
            
            // 2. Fetch and upsert Results
            console.log('  Fetching results...')
            const resultsHtml = await fetchHtml('resultados', comp.id)
            const resultGames = await scrapeGames(resultsHtml, 'FINALIZADO')
            
            if (resultGames.length > 0) {
                const upsertData = resultGames.map(g => ({
                    ...g,
                    competicao_id: comp.id,
                    temporada: comp.season,
                    updated_at: new Date().toISOString()
                }))
                
                const { error } = await supabase
                    .from('games')
                    .upsert(upsertData, { onConflict: 'data,equipa_casa,equipa_fora,competicao_id' })
                
                if (error) {
                    console.error(`  Error upserting results: ${error.message}`)
                } else {
                    console.log(`  ✓ Upserted ${resultGames.length} result games`)
                }
            }
            
            // Rate limit friendly delay
            await new Promise(resolve => setTimeout(resolve, 1000))
            
        } catch (err) {
            console.error(`  Failed to process ${comp.name}:`, err.message)
        }
    }
    
    console.log('\nPre-warming complete.')
}

main()