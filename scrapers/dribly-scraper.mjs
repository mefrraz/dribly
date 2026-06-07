#!/usr/bin/env node
/**
 * Dribly — Scraper Local CLI
 *
 * Auto-instala dependências e abre uma TUI bonita para scrape de jogos.
 * Zero cota Vercel. Só precisas de Node.js >= 18.
 *
 * Uso:
 *   node scrapers/dribly-scraper.mjs
 *
 * Descarrega do admin: /admin/scrape → botão 📥 Script
 */

import { execSync } from 'child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { createInterface } from 'readline'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEPS_DIR = resolve(__dirname, '..', '.dribly-deps')
const PKG_JSON = resolve(DEPS_DIR, 'package.json')

// ── ANSI helpers ───────────────────────────────────────

const C = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    purple: '\x1b[35m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    blue: '\x1b[34m',
    bgPurple: '\x1b[45m',
    bgGreen: '\x1b[42m',
    clear: '\x1b[2J\x1b[H',
    hideCursor: '\x1b[?25l',
    showCursor: '\x1b[?25h',
}

const COLORS = [C.purple, C.cyan, C.blue, C.yellow, C.green, C.red]

function color(index) {
    return COLORS[index % COLORS.length]
}

function progressBar(current, total, width = 40) {
    const pct = current / total
    const filled = Math.round(pct * width)
    const empty = width - filled
    return C.bgPurple + ' '.repeat(filled) + C.reset + C.dim + ' '.repeat(empty) + C.reset
}

function padRight(str, len) {
    return str.padEnd(len)
}

function padLeft(str, len) {
    return str.padStart(len)
}

// ── Spinner ────────────────────────────────────────────

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
let spinnerInterval = null

function startSpinner() {
    process.stdout.write(C.hideCursor)
    let i = 0
    spinnerInterval = setInterval(() => {
        process.stdout.write('\r' + C.purple + SPINNER_FRAMES[i] + C.reset + ' ')
        i = (i + 1) % SPINNER_FRAMES.length
    }, 80)
}

function stopSpinner() {
    clearInterval(spinnerInterval)
    process.stdout.write('\r  \r')
    process.stdout.write(C.showCursor)
}

// ── Install deps ──────────────────────────────────────

async function ensureDeps() {
    if (!existsSync(DEPS_DIR)) {
        mkdirSync(DEPS_DIR, { recursive: true })
        writeFileSync(PKG_JSON, JSON.stringify({ type: 'module', private: true }, null, 2))
    }

    // Check if already installed
    const supabasePath = resolve(DEPS_DIR, 'node_modules', '@supabase', 'supabase-js')
    const cheerioPath = resolve(DEPS_DIR, 'node_modules', 'cheerio')

    if (existsSync(supabasePath) && existsSync(cheerioPath)) {
        return
    }

    console.log(C.cyan + '\n  📦 A instalar dependências...' + C.reset)
    console.log(C.dim + '     @supabase/supabase-js + cheerio' + C.reset)
    console.log()

    try {
        execSync('npm install @supabase/supabase-js cheerio', {
            cwd: DEPS_DIR,
            stdio: 'pipe',
        })
        console.log(C.green + '  ✅ Dependências instaladas!\n' + C.reset)
    } catch {
        console.error(C.red + '  ❌ Erro ao instalar dependências. Verifica a ligação.\n' + C.reset)
        process.exit(1)
    }
}

// ── Load env ───────────────────────────────────────────

function loadEnv() {
    const envPath = resolve(__dirname, '..', 'web', '.env')
    if (!existsSync(envPath)) return false

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
    return true
}

// ── Main ───────────────────────────────────────────────

async function main() {
    console.log(C.clear)
    console.log(C.bold + C.purple + '  Dribly Scraper' + C.reset)
    console.log(C.dim + '  Scrape local de jogos — zero cota Vercel' + C.reset)
    console.log()

    // Install deps
    await ensureDeps()

    // Load modules from deps dir
    const supabasePath = pathToFileURL(resolve(DEPS_DIR, 'node_modules', '@supabase', 'supabase-js')).href
    const cheerioPath = pathToFileURL(resolve(DEPS_DIR, 'node_modules', 'cheerio')).href
    const { createClient } = await import(supabasePath)
    const cheerioModule = await import(cheerioPath)
    const cheerio = cheerioModule.default || cheerioModule

    // Load env
    if (!loadEnv()) {
        console.log(C.red + '  ❌ Ficheiro web/.env não encontrado.' + C.reset)
        process.exit(1)
    }

    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.log(C.red + '  ❌ SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY em falta no .env' + C.reset)
        process.exit(1)
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

    // ── Fetch clubs ─────────────────────────────────────

    startSpinner()
    process.stdout.write(C.dim + '  A carregar clubes...' + C.reset)
    const { data: clubs } = await supabase.from('clubs').select('id,name').order('name')
    stopSpinner()

    if (!clubs || clubs.length === 0) {
        console.log(C.red + '  ❌ Nenhum clube encontrado.' + C.reset)
        process.exit(1)
    }

    console.log(C.green + `\n  ✅ ${clubs.length} clubes carregados.\n` + C.reset)

    // ── Season selection ────────────────────────────────

    const seasons = ['2025/2026', '2024/2025', '2023/2024', '2022/2023']
    console.log(C.bold + '  📅 Escolhe a época:' + C.reset)
    seasons.forEach((s, i) => {
        console.log(`     ${C.purple}[${i + 1}]${C.reset} ${s}`)
    })
    console.log()

    const rl = createInterface({ input: process.stdin, output: process.stdout })
    const seasonIdx = await new Promise(resolve => {
        rl.question(C.cyan + '  > ' + C.reset, (ans) => {
            const idx = parseInt(ans) - 1
            resolve(idx >= 0 && idx < seasons.length ? idx : 0)
        })
    })
    const season = seasons[seasonIdx]
    const seasonTable = 'games_' + season.replace('/', '_')

    // ── Club selection ──────────────────────────────────

    console.log(C.clear)
    console.log(C.bold + C.purple + '  Dribly Scraper' + C.reset + C.dim + ` — ${season}` + C.reset)
    console.log()

    // Show first 20 clubs
    const preview = clubs.slice(0, 20)
    const colWidth = Math.max(...preview.map(c => c.name.length)) + 4

    preview.forEach((c, i) => {
        const idx = String(i + 1).padStart(2)
        console.log(`  ${C.purple}[${idx}]${C.reset} ${padRight(c.name, colWidth)} ${C.dim}#${c.id}${C.reset}`)
    })
    console.log(`  ${C.purple}[A]${C.reset} Todos os clubes`)
    console.log(`  ${C.purple}[P]${C.reset} Populares (mais follows)`)
    console.log()

    const clubChoice = await new Promise(resolve => {
        rl.question(C.cyan + '  > ' + C.reset, resolve)
    })
    rl.close()

    let selectedClubs

    if (clubChoice.toUpperCase() === 'A') {
        selectedClubs = clubs
    } else if (clubChoice.toUpperCase() === 'P') {
        // Get top clubs by follows
        const { data: follows } = await supabase.from('user_follows').select('entity_id').eq('entity_type', 'club')
        const counts = {}
        if (follows) {
            for (const f of follows) {
                counts[f.entity_id] = (counts[f.entity_id] || 0) + 1
            }
        }
        const top20 = Object.entries(counts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 20)
            .map(([id]) => parseInt(id))
        selectedClubs = clubs.filter(c => top20.includes(c.id))
    } else {
        const idx = parseInt(clubChoice) - 1
        if (idx >= 0 && idx < preview.length) {
            selectedClubs = [preview[idx]]
        } else {
            console.log(C.red + '\n  ❌ Seleção inválida.' + C.reset)
            process.exit(1)
        }
    }

    // ── Scrape! ─────────────────────────────────────────

    console.log(C.clear)
    console.log(C.bold + C.purple + '  Dribly Scraper' + C.reset + C.dim + ` — ${season}` + C.reset)
    console.log(C.dim + `  ${selectedClubs.length} clubes selecionados` + C.reset)
    console.log()

    const MONTHS_PT = { '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr', '05': 'Mai', '06': 'Jun',
        '07': 'Jul', '08': 'Ago', '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez' }

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

    async function scrapeClub(clubId) {
        const url = (page) => `https://www.fpb.pt/${page}/clube_${clubId}/?epoca=${encodeURIComponent(season)}&escalao=S%C3%A9nior&genero=masculino`

        const [calRes, resRes] = await Promise.all([
            fetch(url('calendario'), { headers: { 'User-Agent': 'Mozilla/5.0' } }),
            fetch(url('resultados'), { headers: { 'User-Agent': 'Mozilla/5.0' } }),
        ])

        const calHtml = await calRes.text()
        const resHtml = await resRes.text()

        function parse(html) {
            const $ = cheerio.load(html)
            const games = []
            $('.day-wrapper').each((_, dw) => {
                const dateStr = $(dw).find('h3.date').text().trim()
                const iso = parseDatePt(dateStr)
                if (!iso) return

                $(dw).find('a.game-wrapper-a').each((__, link) => {
                    const $link = $(link)
                    const href = $link.attr('href') || ''
                    const internalId = href.match(/internalID=(\d+)/)?.[1] || ''
                    if (!internalId) return

                    const names = []
                    $link.find('.fullName, .sigla').each((___, el) => {
                        names.push($(el).text().trim())
                    })

                    const compText = $link.find('.competition span').text().trim()
                    let escalao = '', competicao = ''
                    if (compText.includes('|')) {
                        const parts = compText.split('|')
                        escalao = parts[0]?.trim() || ''
                        competicao = parts[1]?.trim() || ''
                    } else { competicao = compText }

                    const resultText = $link.find('.result span').text().trim()
                    const scoreMatch = resultText.match(/(\d+)\s*-\s*(\d+)/)
                    const timeText = $link.find('.time').text().trim()
                    const locText = $link.find('.location').text().trim()

                    const logos = []
                    $link.find('.image-container img').each((___, img) => {
                        const src = $(img).attr('src')
                        if (src && !src.includes('placeholder')) logos.push(src)
                    })

                    const teamSlug = (names[0] || 'x').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
                    const oppSlug = (names[1] || 'y').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
                    const slug = `${iso}-${teamSlug}-${oppSlug}`

                    games.push({
                        slug, data: iso, hora: timeText || null,
                        equipa_casa: names[0] || '', equipa_fora: names[1] || '',
                        resultado_casa: scoreMatch ? parseInt(scoreMatch[1]) : null,
                        resultado_fora: scoreMatch ? parseInt(scoreMatch[2]) : null,
                        escalao, competicao, local: locText || null,
                        status: scoreMatch ? 'FINALIZADO' : 'AGENDADO',
                        logotipo_casa: logos[0] || null, logotipo_fora: logos[1] || null,
                        epoca: season,
                    })
                })
            })
            return games
        }

        const calGames = parse(calHtml)
        const resGames = parse(resHtml)

        // Merge: results override calendar
        const merged = new Map()
        for (const g of calGames) merged.set(g.slug, g)
        for (const g of resGames) {
            if (g.resultado_casa !== null) {
                merged.set(g.slug, { ...merged.get(g.slug), ...g })
            }
        }
        return Array.from(merged.values())
    }

    let totalGames = 0
    let done = 0
    const errors = []
    const CONCURRENCY = 4

    for (let i = 0; i < selectedClubs.length; i += CONCURRENCY) {
        const batch = selectedClubs.slice(i, i + CONCURRENCY)
        const results = await Promise.all(
            batch.map(async (club) => {
                try {
                    const games = await scrapeClub(club.id)
                    for (const g of games) {
                        await supabase.from(seasonTable).upsert(g, { onConflict: 'slug' })
                    }
                    return { club, count: games.length }
                } catch (e) {
                    return { club, count: 0, error: e.message }
                }
            }),
        )

        for (const r of results) {
            done++
            totalGames += r.count
            if (r.error) errors.push(r.club.name)

            const pct = Math.round((done / selectedClubs.length) * 100)
            const bar = progressBar(done, selectedClubs.length, 35)
            const pctStr = padLeft(String(pct), 3)
            const clubStr = padRight(r.club.name.slice(0, 28), 28)
            const gameStr = padLeft(String(r.count), 4)
            const errStr = r.error ? ' ' + C.red + '✗' + C.reset : ''

            process.stdout.write(
                `\r  ${bar} ${C.bold}${pctStr}%${C.reset}  ${clubStr} ${C.purple}${gameStr} jogos${C.reset}${errStr}`,
            )
        }
    }

    console.log('\n')
    console.log(C.bold + C.green + `  ✅ Concluído!` + C.reset)
    console.log(C.dim + `     ${totalGames} jogos em ${done} clubes` + C.reset)

    if (errors.length > 0) {
        console.log(C.red + `     ${errors.length} erros: ${errors.join(', ')}` + C.reset)
    }

    console.log()
}

main().catch((e) => {
    console.error(C.red + '\n  ❌ Erro fatal:' + C.reset, e.message)
    process.exit(1)
})
