/**
 * Dribly — Scraper local de jogos
 *
 * Corre no teu PC em vez de usar Vercel Edge Functions.
 * Não gasta cota da Vercel.
 *
 * Uso:
 *   node scrapers/scrape-games.mjs --season=2025/2026 --clubs=119,127,169
 *   node scrapers/scrape-games.mjs --season=2025/2026 --all
 *
 * Requer .env com:
 *   SUPABASE_URL=https://xxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=sb_xxx
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Parse args ─────────────────────────────────────────

const args = process.argv.slice(2)
const getArg = (name) => {
    const found = args.find(a => a.startsWith(`--${name}=`))
    return found ? found.split('=')[1] : null
}

const season = getArg('season') || '2025/2026'
const clubsArg = getArg('clubs')
const allClubs = args.includes('--all')
const seasonTable = 'games_' + season.replace('/', '_')

if (!clubsArg && !allClubs) {
    console.error('Usage: node scrape-games.mjs --season=2025/2026 --clubs=119,127,169')
    console.error('   or: node scrape-games.mjs --season=2025/2026 --all')
    process.exit(1)
}

// ── Load env ───────────────────────────────────────────

function loadEnv() {
    const envPath = resolve(__dirname, '..', 'web', '.env')
    if (!existsSync(envPath)) {
        console.error('No .env file found at web/.env')
        process.exit(1)
    }
    const content = readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eq = trimmed.indexOf('=')
        if (eq === -1) continue
        const key = trimmed.slice(0, eq)
        const val = trimmed.slice(eq + 1)
        if (!process.env[key]) process.env[key] = val
    }
}
loadEnv()

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── FPB Scraper (browser-style, adapted for Node) ──────

async function fetchFPBPage(page, clubId) {
    const url = `https://www.fpb.pt/${page}/clube_${clubId}/?epoca=${encodeURIComponent(season)}&escalao=S%C3%A9nior&genero=masculino`
    const res = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml',
        },
    })
    if (!res.ok) throw new Error(`FPB returned ${res.status}`)
    return res.text()
}

function parseDatePt(str) {
    if (!str) return null
    const months = {
        'janeiro': '01', 'fevereiro': '02', 'março': '03', 'marco': '03',
        'abril': '04', 'maio': '05', 'junho': '06',
        'julho': '07', 'agosto': '08', 'setembro': '09',
        'outubro': '10', 'novembro': '11', 'dezembro': '12',
    }
    const parts = str.toLowerCase().trim().split(' de ')
    if (parts.length !== 3) return null
    const day = parts[0].padStart(2, '0')
    const month = months[parts[1]]
    const year = parts[2]
    return month ? `${year}-${month}-${day}` : null
}

function parseGamesHTML(html) {
    // Simple regex-based parser (avoids DOM parsing complexity in Node)
    const games = []
    const dayRegex = /<h3[^>]*class="[^"]*date[^"]*"[^>]*>([^<]+)<\/h3>/gi
    const linkRegex = /<a[^>]*class="[^"]*game-wrapper-a[^"]*"[^>]*href="[^"]*internalID=(\d+)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi

    let dayMatch
    const days = []
    while ((dayMatch = dayRegex.exec(html)) !== null) {
        const dateStr = dayMatch[1].trim()
        const iso = parseDatePt(dateStr)
        if (iso) days.push({ iso, pos: dayMatch.index })
    }

    // For each game link, find which day it belongs to
    let linkMatch
    while ((linkMatch = linkRegex.exec(html)) !== null) {
        const internalId = linkMatch[1]
        const block = linkMatch[2]
        const linkPos = linkMatch.index

        // Find the preceding day
        let date = null
        for (let i = days.length - 1; i >= 0; i--) {
            if (days[i].pos < linkPos) { date = days[i].iso; break }
        }
        if (!date) continue

        // Extract teams
        const teamRegex = /<div[^>]*class="[^"]*team-container[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi
        // Simpler: find fullName or sigla spans
        const nameRegex = /<span[^>]*class="[^"]*(?:fullName|sigla)[^"]*"[^>]*>([^<]+)<\/span>/gi
        const names = []
        let nm
        while ((nm = nameRegex.exec(block)) !== null) {
            names.push(nm[1].trim())
        }

        // Competition
        const compMatch = block.match(/<div[^>]*class="[^"]*competition[^"]*"[^>]*>[\s\S]*?<span[^>]*>([^<]*)<\/span>/i)
        const compText = compMatch ? compMatch[1].trim() : ''
        let escalao = '', competicao = ''
        if (compText.includes('|')) {
            const parts = compText.split('|')
            escalao = parts[0]?.trim() || ''
            competicao = parts[1]?.trim() || ''
        } else {
            competicao = compText
        }

        // Score
        const scoreMatch = block.match(/<div[^>]*class="[^"]*result[^"]*"[^>]*>[\s\S]*?<span[^>]*>(\d+)\s*-\s*(\d+)<\/span>/i)
        const scoreCasa = scoreMatch ? parseInt(scoreMatch[1]) : null
        const scoreFora = scoreMatch ? parseInt(scoreMatch[2]) : null

        // Time
        const timeMatch = block.match(/<div[^>]*class="[^"]*time[^"]*"[^>]*>\s*(\d{1,2}:\d{2})/i)
        const hora = timeMatch ? timeMatch[1] : null

        // Location
        const locMatch = block.match(/<div[^>]*class="[^"]*location[^"]*"[^>]*>([^<]+)<\/div>/i)
        const local = locMatch ? locMatch[1].trim() : null

        // Status
        const isFinished = scoreCasa !== null && scoreFora !== null
        const status = isFinished ? 'FINALIZADO' : 'AGENDADO'

        // Logos
        const logoRegex = /<img[^>]*src="([^"]*)"[^>]*>/gi
        const logos = []
        let lg
        while ((lg = logoRegex.exec(block)) !== null) {
            if (!lg[1].includes('placeholder') && !lg[1].includes('1x1')) {
                logos.push(lg[1].startsWith('http') ? lg[1] : 'https://www.fpb.pt' + lg[1])
            }
        }

        const slug = `${date}-${(names[0] || 'x').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}-${(names[1] || 'y').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`

        games.push({
            slug,
            data: date,
            hora,
            equipa_casa: names[0] || '',
            equipa_fora: names[1] || '',
            resultado_casa: scoreCasa,
            resultado_fora: scoreFora,
            escalao,
            competicao,
            local,
            status,
            logotipo_casa: logos[0] || null,
            logotipo_fora: logos[1] || null,
            epoca: season,
        })
    }

    return games
}

async function scrapeClub(clubId) {
    const [calHtml, resHtml] = await Promise.all([
        fetchFPBPage('calendario', clubId),
        fetchFPBPage('resultados', clubId),
    ])

    const calGames = parseGamesHTML(calHtml)
    const resGames = parseGamesHTML(resHtml)

    // Merge: results override calendar
    const merged = new Map()
    for (const g of calGames) merged.set(g.slug, g)
    for (const g of resGames) {
        if (g.resultado_casa !== null && g.resultado_fora !== null) {
            merged.set(g.slug, { ...merged.get(g.slug), ...g })
        }
    }

    return Array.from(merged.values())
}

// ── Main ───────────────────────────────────────────────

async function main() {
    let clubIds

    if (allClubs) {
        // Fetch all club IDs from Supabase
        const { data } = await supabase.from('clubs').select('id').order('name')
        if (!data) { console.error('No clubs found'); process.exit(1) }
        clubIds = data.map(c => c.id)
    } else {
        clubIds = clubsArg.split(',').map(s => parseInt(s.trim())).filter(Boolean)
    }

    console.log(`\n🔍 Scraping ${clubIds.length} clubes para ${season}\n`)

    let totalGames = 0
    let done = 0

    for (let i = 0; i < clubIds.length; i += 4) {
        const batch = clubIds.slice(i, i + 4)
        const results = await Promise.all(
            batch.map(async (id) => {
                try {
                    const games = await scrapeClub(id)
                    for (const g of games) {
                        await supabase.from(seasonTable).upsert(g, { onConflict: 'slug' })
                    }
                    return { id, count: games.length }
                } catch (e) {
                    return { id, count: 0, error: e.message }
                }
            }),
        )

        for (const r of results) {
            done++
            totalGames += r.count
            const pct = ((done / clubIds.length) * 100).toFixed(0)
            const bar = '█'.repeat(Math.floor(done / clubIds.length * 30))
            const err = r.error ? ` ❌ ${r.error}` : ''
            process.stdout.write(`\r[${bar.padEnd(30, '░')}] ${pct}%  Clube ${done}/${clubIds.length}  Jogos: ${totalGames}${err}`)
        }
    }

    console.log(`\n\n✅ Concluído! ${totalGames} jogos em ${done} clubes.\n`)
}

main().catch(console.error)
