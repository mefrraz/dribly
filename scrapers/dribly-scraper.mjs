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
import { existsSync, mkdirSync, writeFileSync, appendFileSync, rmSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { createInterface } from 'readline'
import { createRequire } from 'module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEPS_DIR = resolve(__dirname, '..', '.dribly-deps')
const PKG_JSON = resolve(DEPS_DIR, 'package.json')
const LOG_FILE = resolve(DEPS_DIR, 'scraper.log')

function log(msg) {
    const ts = new Date().toISOString()
    appendFileSync(LOG_FILE, `[${ts}] ${msg}\n`)
}

// Cross-platform module loader for Windows
function loadModuleSync(packageName) {
    const req = createRequire(pathToFileURL(resolve(DEPS_DIR, 'package.json')).href)
    return req(packageName)
}

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
    const pngjsPath = resolve(DEPS_DIR, 'node_modules', 'pngjs')

    if (existsSync(supabasePath) && existsSync(cheerioPath) && existsSync(pngjsPath)) {
        return
    }

    console.log(C.cyan + '\n  📦 A instalar dependências...' + C.reset)
    console.log(C.dim + '     @supabase/supabase-js + cheerio + pngjs' + C.reset)
    console.log()

    try {
        execSync('npm install @supabase/supabase-js cheerio pngjs', {
            cwd: DEPS_DIR,
            stdio: 'pipe',
        })
        console.log(C.green + '  ✅ Dependências instaladas!\n' + C.reset)
    } catch {
        console.error(C.red + '  ❌ Erro ao instalar dependências. Verifica a ligação.\n' + C.reset)
        process.exit(1)
    }
}

async function askCredentials() {
    const rl = createInterface({ input: process.stdin, output: process.stdout })

    console.log(C.dim + '  As credenciais NÃO são guardadas — só nesta sessão.' + C.reset)
    console.log(C.dim + '  Vê as credenciais no admin: /admin → Scraper → 📥 Script → Mostrar' + C.reset)
    console.log()

    const ask = (q) => new Promise(resolve => rl.question(C.cyan + q + C.reset, resolve))

    const url = await ask('  SUPABASE_URL: ')
    const key = await ask('  SUPABASE_SERVICE_ROLE_KEY: ')
    rl.close()

    if (!url || !key) {
        console.log(C.red + '\n  ❌ Credenciais obrigatórias.\n' + C.reset)
        process.exit(1)
    }

    return { url, key }
}

// ── Main ───────────────────────────────────────────────

async function main() {
    console.log(C.clear)
    console.log(C.bold + C.purple + '  Dribly Scraper' + C.reset)
    console.log(C.dim + '  Scrape local de jogos — zero cota Vercel' + C.reset)
    console.log(C.dim + `  Logs: ${LOG_FILE}` + C.reset)
    console.log()

    // Install deps
    await ensureDeps()

    // Load modules from deps dir
    const supabaseModule = loadModuleSync('@supabase/supabase-js')
    const { createClient } = supabaseModule
    const cheerioModule = loadModuleSync('cheerio')
    const cheerio = cheerioModule.default || cheerioModule

    // Always ask for credentials (never read from .env)
    const creds = await askCredentials()
    process.env.SUPABASE_URL = creds.url
    process.env.SUPABASE_SERVICE_ROLE_KEY = creds.key

    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.log(C.red + '  ❌ SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY em falta.' + C.reset)
        process.exit(1)
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

    // ── Fetch clubs ─────────────────────────────────────

    startSpinner()
    process.stdout.write(C.dim + '  A carregar clubes...' + C.reset)
    const { data: clubs } = await supabase.from('clubs').select('id,name,logo_url').order('name')
    stopSpinner()

    if (!clubs || clubs.length === 0) {
        console.log(C.red + '  ❌ Nenhum clube encontrado.' + C.reset)
        process.exit(1)
    }

    console.log(C.green + `\n  ✅ ${clubs.length} clubes carregados.\n` + C.reset)

    // ── Season selection ────────────────────────────────

    const ALL_SEASONS = [
        '2025/2026', '2024/2025', '2023/2024', '2022/2023', '2021/2022', '2020/2021',
        '2019/2020', '2018/2019', '2017/2018', '2016/2017', '2015/2016', '2014/2015',
        '2013/2014', '2012/2013', '2011/2012', '2010/2011', '2009/2010', '2008/2009',
        '2007/2008', '2006/2007', '2005/2006', '2004/2005', '2003/2004',
    ]
    console.log(C.bold + '  📅 Época:' + C.reset)
    console.log(`     ${C.purple}[A]${C.reset} Todas (23 épocas)`)
    ALL_SEASONS.slice(0, 5).forEach((s, i) => console.log(`     ${C.purple}[${i + 1}]${C.reset} ${s}`))
    console.log(`     ${C.dim}... +18 épocas (escolhe 1-23)${C.reset}`)
    console.log()

    const rl = createInterface({ input: process.stdin, output: process.stdout })
    const sChoice = await new Promise(resolve => rl.question(C.cyan + '  > ' + C.reset, resolve))
    let selectedSeasons = []
    if (sChoice.toUpperCase() === 'A') {
        selectedSeasons = [...ALL_SEASONS]
    } else {
        const idx = parseInt(sChoice) - 1
        if (idx >= 0 && idx < ALL_SEASONS.length) selectedSeasons = [ALL_SEASONS[idx]]
        else { console.log(C.red + '\n  ❌ Inválido.' + C.reset); process.exit(1) }
    }
    const firstSeason = selectedSeasons[0]
    const season = firstSeason

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

    // Cleanup function — remove everything the script created
    function cleanup() {
        try {
            if (existsSync(DEPS_DIR)) {
                if (keepLog) {
                    // Remove node_modules only, keep logs
                    const nm = resolve(DEPS_DIR, 'node_modules')
                    if (existsSync(nm)) rmSync(nm, { recursive: true, force: true })
                    // Remove debug HTML
                    try { const f = resolve(DEPS_DIR, 'debug_cal.html'); if (existsSync(f)) rmSync(f, { force: true }) } catch {}
                    try { const f = resolve(DEPS_DIR, 'debug_res.html'); if (existsSync(f)) rmSync(f, { force: true }) } catch {}
                } else {
                    rmSync(DEPS_DIR, { recursive: true, force: true })
                }
            }
        } catch {}
    }

    // Ctrl+C handler — stops scrape and shows summary
    let stopped = false
    const onSigInt = () => {
        stopped = true
        process.stdout.write(C.showCursor)
        process.stdout.write(C.clear)
        console.log(C.bold + C.purple + '  🏀 Dribly Scraper' + C.reset)
        console.log()
        console.log(C.bold + C.yellow + '  ⏸️  Scrape interrompido' + C.reset)
        console.log(C.dim + `  ${done} clubes processados, ${totalGames} jogos guardados` + C.reset)
        console.log(C.dim + `  Época: ${season}  |  ${selectedClubs.length - done} clubes restantes` + C.reset)
        console.log()
        if (errors.length > 0) {
            console.log(C.red + `  ${errors.length} erros: ${errors.slice(0, 3).join(', ')}` + C.reset)
        }
        console.log(C.dim + '  🧹 A limpar ficheiros temporários...' + C.reset)
        cleanup()
        console.log(C.green + '  ✅ Limpo.' + C.reset)
        console.log()
        process.exit(0)
    }
    process.on('SIGINT', onSigInt)

    // ── Options ─────────────────────────────────────────
    console.log(C.clear)
    console.log(C.bold + C.purple + '  Dribly Scraper' + C.reset + C.dim + ` — ${season}` + C.reset)
    console.log(C.dim + `  ${selectedClubs.length} clubes selecionados` + C.reset)
    console.log()
    console.log(C.bold + '  🧹 Dados existentes:' + C.reset)
    console.log(`     ${C.purple}[1]${C.reset} Manter (adiciona/atualiza)`)
    console.log(`     ${C.purple}[2]${C.reset} Limpar antes (apaga e re-importa)`)
    console.log()

    const optRl = createInterface({ input: process.stdin, output: process.stdout })
    const cleanAnswer = await new Promise(resolve => {
        optRl.question(C.cyan + '  > ' + C.reset, resolve)
    })
    const shouldClean = cleanAnswer.trim() === '2'

    console.log()
    console.log(C.bold + '  📋 Ficheiro de log:' + C.reset)
    console.log(`     ${C.purple}[1]${C.reset} Manter log (para debug)`)
    console.log(`     ${C.purple}[2]${C.reset} Apagar log ao sair`)
    console.log()

    const logAnswer = await new Promise(resolve => {
        optRl.question(C.cyan + '  > ' + C.reset, resolve)
    })
    optRl.close()
    const keepLog = logAnswer.trim() !== '2'

    // ── Parallelism ─────────────────────────────────────
    console.log(C.clear)
    console.log(C.bold + C.purple + '  Dribly Scraper' + C.reset + C.dim + ` — ${season}` + C.reset)
    console.log()
    console.log(C.bold + '  ⚡ Clubes em paralelo:' + C.reset)
    console.log(`     ${C.purple}[1]${C.reset} 1  (lento, seguro)`)
    console.log(`     ${C.purple}[2]${C.reset} 5  (recomendado)`)
    console.log(`     ${C.purple}[3]${C.reset} 10 (rápido)`)
    console.log(`     ${C.purple}[4]${C.reset} 20 (muito rápido)`)
    console.log(`     ${C.purple}[5]${C.reset} 50 (🔥 turbo)`)
    console.log()

    const parRl = createInterface({ input: process.stdin, output: process.stdout })
    const parAnswer = await new Promise(resolve => {
        parRl.question(C.cyan + '  > ' + C.reset, resolve)
    })
    parRl.close()

    const PARALLEL = { '1': 1, '2': 5, '3': 10, '4': 20, '5': 50 }[parAnswer.trim()] || 5

    console.log(C.clear)
    console.log(C.bold + C.purple + '  Dribly Scraper' + C.reset + C.dim + ` — ${selectedSeasons.length > 1 ? selectedSeasons.length + ' épocas' : season}` + C.reset)
    console.log(C.dim + `  ${selectedClubs.length} clubes selecionados` + C.reset)
    console.log()

    const MONTHS_PT = { '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr', '05': 'Mai', '06': 'Jun',
        '07': 'Jul', '08': 'Ago', '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez' }

    function parseDatePt(str) {
        if (!str) return null
        // New FPB format: "7 JUN 2026" or "20 MAR 2026"
        // Old format: "7 de junho de 2026"
        const shortMonths = {
            'jan': '01', 'fev': '02', 'mar': '03', 'abr': '04',
            'mai': '05', 'jun': '06', 'jul': '07', 'ago': '08',
            'set': '09', 'out': '10', 'nov': '11', 'dez': '12',
        }
        const longMonths = {
            'janeiro': '01', 'fevereiro': '02', 'março': '03', 'marco': '03',
            'abril': '04', 'maio': '05', 'junho': '06',
            'julho': '07', 'agosto': '08', 'setembro': '09',
            'outubro': '10', 'novembro': '11', 'dezembro': '12',
        }
        const s = str.trim()

        // Try new format: "7 JUN 2026"
        const shortMatch = s.match(/^(\d{1,2})\s+([A-Z]{3})\s+(\d{4})$/i)
        if (shortMatch) {
            const day = shortMatch[1].padStart(2, '0')
            const month = shortMonths[shortMatch[2].toLowerCase()]
            const year = shortMatch[3]
            if (month) return `${year}-${month}-${day}`
        }

        // Try old format: "7 de junho de 2026"
        const parts = s.toLowerCase().split(' de ')
        if (parts.length === 3) {
            const day = parts[0].trim().padStart(2, '0')
            const month = longMonths[parts[1].trim()]
            const year = parts[2].trim()
            if (month) return `${year}-${month}-${day}`
        }

        return null
    }

    async function scrapeClub(clubId, szn) {
        const s = szn || season
        const url = (page) => `https://www.fpb.pt/${page}/clube_${clubId}/?epoca=${encodeURIComponent(s)}&escalao=S%C3%A9nior&genero=masculino`

        log(`Scraping club ${clubId} — ${season}`)

        try {
            const [calRes, resRes] = await Promise.all([
                fetch(url('calendario'), { headers: { 'User-Agent': 'Mozilla/5.0' } }),
                fetch(url('resultados'), { headers: { 'User-Agent': 'Mozilla/5.0' } }),
            ])
            log(`  Fetched calendar (${calRes.status}) and results (${resRes.status})`)

        const calHtml = await calRes.text()
        const resHtml = await resRes.text()
        const epocaForGame = s
        log(`  Calendar HTML: ${calHtml.length} chars, Results HTML: ${resHtml.length} chars`)

        // DEBUG: always save HTML of first club with games
        if (!existsSync(resolve(DEPS_DIR, 'debug_cal.html'))) {
            writeFileSync(resolve(DEPS_DIR, 'debug_cal.html'), calHtml)
            writeFileSync(resolve(DEPS_DIR, 'debug_res.html'), resHtml)
            log(`  Saved debug HTML to ${DEPS_DIR}`)
        }

        function parse(html) {
            try {
                const $ = cheerio.load(html)
                // Debug cheerio
                const allDivs = $('div')
                const dayWrappers = $('.day-wrapper')
                const gameLinks = $('a.game-wrapper-a')
                log(`    cheerio: ${allDivs.length} divs, ${dayWrappers.length} .day-wrapper, ${gameLinks.length} a.game-wrapper-a`)
                log(`    cheerio type: ${typeof $}, load type: ${typeof cheerio.load}`)
                if (allDivs.length === 0) {
                    log(`    FIRST 200 CHARS: ${html.substring(0, 200)}`)
                }
                const games = []
                let parsedDates = 0, failedDates = 0, parsedLinks = 0
                dayWrappers.each((_, dw) => {
                const dateStr = $(dw).find('h3.date').text().trim()
                const iso = parseDatePt(dateStr)
                if (!iso) { failedDates++; if (failedDates === 1) log(`    FAILED dateStr: "${dateStr}"`); return }
                parsedDates++

                $(dw).find('a.game-wrapper-a').each((__, link) => {
                    parsedLinks++
                    const $link = $(link)
                    const href = $link.attr('href') || ''
                    const internalId = href.match(/internalID=(\d+)/)?.[1] || ''
                    if (!internalId) return

                    // Query each .team-container separately (home first, away second)
                    // Old flat .find('.fullName, .sigla') was buggy:
                    // if home had both .fullName + .sigla, names[1] = home sigla, not away team
                    const $containers = $link.find('.team-container')
                    const $home = $containers.eq(0)
                    const $away = $containers.eq(1)
                    const homeName = ($home.find('.fullName').text() || $home.find('.sigla').text()).trim()
                    const awayName = ($away.find('.fullName').text() || $away.find('.sigla').text()).trim()

                    // Skip self-matches (away team not properly parsed)
                    if (homeName && homeName === awayName) return

                    const compText = $link.find('.competition span').text().trim()
                    let escalao = '', competicao = ''
                    if (compText.includes('|')) {
                        const parts = compText.split('|')
                        escalao = parts[0]?.trim() || ''
                        competicao = parts[1]?.trim() || ''
                    } else { competicao = compText }

                    // Results page: score in .results_text elements
                    const resultsTexts = $link.find('.results_text')
                    let scoreCasa = null, scoreFora = null
                    if (resultsTexts.length >= 2) {
                        scoreCasa = parseInt(resultsTexts.eq(0).text().trim())
                        scoreFora = parseInt(resultsTexts.eq(1).text().trim())
                        if (isNaN(scoreCasa)) scoreCasa = null
                        if (isNaN(scoreFora)) scoreFora = null
                    }
                    // Calendar page: score in .result span
                    const resultSpan = $link.find('.result span').text().trim()
                    const spanMatch = resultSpan.match(/(\d+)\s*-\s*(\d+)/)
                    if (spanMatch && scoreCasa === null) {
                        scoreCasa = parseInt(spanMatch[1])
                        scoreFora = parseInt(spanMatch[2])
                    }

                    // Time: .time or .hour
                    const timeText = $link.find('.hour').text().trim() || $link.find('.time').text().trim()

                    // Location: .location-wrapper text
                    const locText = $link.find('.location-wrapper').text().trim() || $link.find('.location').text().trim()

                    // debug removed — scraper verified working

                    const logos = []
                    $link.find('.image-container img').each((___, img) => {
                        const src = $(img).attr('src')
                        if (src && !src.includes('placeholder')) logos.push(src)
                    })

                    const teamSlug = (homeName || 'x').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
                    const oppSlug = (awayName || 'y').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
                    const slug = `${iso}-${teamSlug}-${oppSlug}`

                    games.push({
                        slug, data: iso, hora: timeText || null,
                        equipa_casa: homeName, equipa_fora: awayName,
                        resultado_casa: scoreCasa,
                        resultado_fora: scoreFora,
                        escalao, competicao, local: locText || null,
                        status: (scoreCasa !== null && scoreFora !== null) ? 'FINALIZADO' : 'AGENDADO',
                        logotipo_casa: logos[0] || null, logotipo_fora: logos[1] || null,
                        epoca: epocaForGame,
                    })
                })
            })
            log(`    parsed: ${parsedDates} dates (${failedDates} failed), ${parsedLinks} games total`)
            return games
            } catch (e) {
                log(`    PARSE ERROR: ${e.message}`)
                return []
            }
        }

        const calGames = parse(calHtml)
        const resGames = parse(resHtml)
        log(`  Parsed: ${calGames.length} calendar games, ${resGames.length} results games`)

        // Merge: results override calendar
        const merged = new Map()
        for (const g of calGames) merged.set(g.slug, g)
        for (const g of resGames) {
            if (g.resultado_casa !== null) {
                merged.set(g.slug, { ...merged.get(g.slug), ...g })
            }
        }
        const all = Array.from(merged.values())
        log(`  Total after merge: ${all.length} games`)
        return all
        } finally {
            // no timeout — wait as long as needed
        }
    }

    let totalGames = 0
    let done = 0
    const errors = []
    const recentGames = [] // max 12, newest first
    const termWidth = process.stdout.columns || 100

    // ── PNG to ASCII converter ─────────────────────────
    const asciiCache = new Map()
    const { PNG } = loadModuleSync('pngjs')

    // Cache for fallback logo
    let fallbackLogo = null
    async function getFallbackLogo() {
        if (fallbackLogo) return fallbackLogo
        try {
            const res = await fetch('https://dribly.pt/logo.png')
            if (!res.ok) return null
            const buffer = Buffer.from(await res.arrayBuffer())
            const png = PNG.sync.read(buffer)
            fallbackLogo = png
            return png
        } catch { return null }
    }

    async function getLogoAscii(clubId, logoUrl) {
        if (asciiCache.has(clubId)) return asciiCache.get(clubId)

        const SIZE = 30 // square
        try {
            let png
            if (logoUrl) {
                const ctrl = new AbortController()
                const t = setTimeout(() => ctrl.abort(), 5000)
                const res = await fetch(logoUrl, { signal: ctrl.signal })
                clearTimeout(t)
                if (!res.ok) throw new Error('fetch failed')
                const buffer = Buffer.from(await res.arrayBuffer())
                png = PNG.sync.read(buffer)
            } else {
                png = await getFallbackLogo()
                if (!png) return null
            }

            const w = SIZE
            const h = SIZE

            const result = []
            for (let y = 0; y < h; y++) {
                let line = ''
                for (let x = 0; x < w; x++) {
                    const srcX = Math.floor(x * png.width / w)
                    const srcY = Math.floor(y * png.height / h)
                    const idx = (png.width * srcY + srcX) << 2
                    const r = png.data[idx]
                    const g = png.data[idx + 1]
                    const b = png.data[idx + 2]
                    const a = png.data[idx + 3]
                    if (a < 128) { line += '  '; continue }
                    line += `\x1b[48;2;${r};${g};${b}m  \x1b[0m`
                }
                result.push(line)
            }
            asciiCache.set(clubId, result)
            return result
        } catch {
            // Try fallback
            if (logoUrl) return getLogoAscii(clubId, null)
            return null
        }
    }

    function clr() { process.stdout.write('\x1b[K') } // clear to end of line

    async function drawScreen(club, gameDone, total, clubIdx, searching) {
        if (clubIdx === 1 && searching) {
            process.stdout.write(C.clear)
            process.stdout.write(C.hideCursor)
        } else {
            process.stdout.write('\x1b[H') // cursor home, no clear
        }

        // Header
        process.stdout.write(C.bold + C.purple + '  🏀 Dribly Scraper' + C.reset + C.dim + ` — ${season}` + C.reset); clr(); console.log()
        process.stdout.write(C.dim + `  Clube ${clubIdx}/${selectedClubs.length}  |  ${totalGames} jogos guardados` + C.reset); clr(); console.log()
        clr(); console.log()

        // Club info
        process.stdout.write(C.bold + club.name + C.reset + C.dim + `  #${club.id}` + C.reset + '                    '); clr(); console.log()
        clr(); console.log()

        const logoArt = await getLogoAscii(club.id, club.logo_url)
        if (logoArt) {
            for (const l of logoArt) { process.stdout.write('  ' + l); clr(); console.log() }
        }
        clr(); console.log()

        // Progress bar OR searching — same position, alternating
        if (searching) {
            const barW = Math.min(60, termWidth - 20)
            process.stdout.write(`  ${C.cyan}🔍 A pesquisar jogos...${C.reset}  ${C.dim}${'─'.repeat(barW)}${C.reset}`); clr(); console.log()
        } else {
            const gameBar = progressBar(gameDone, total, Math.min(50, termWidth - 20))
            const pct = total > 0 ? Math.round((gameDone / total) * 100) : 0
            process.stdout.write(`  Jogos: ${gameBar} ${gameDone}/${total} (${pct}%)`); clr(); console.log()
        }
        clr(); console.log()

        // ── Histórico (always visible) ──────────────────
        if (recentGames.length > 0) {
            process.stdout.write(`  ${C.bold}📋 Histórico${C.reset}`); clr(); console.log()
            process.stdout.write(`  ${C.dim}${'─'.repeat(Math.min(60, termWidth - 4))}${C.reset}`); clr(); console.log()
            const toShow = recentGames.slice(0, Math.min(8, recentGames.length))
            for (const g of toShow) {
                const icon = g.status === 'FINALIZADO' ? C.green + '●' + C.reset : C.yellow + '○' + C.reset
                const text = ('  ' + icon + ' ' + g.text).padEnd(termWidth - 2)
                process.stdout.write(text); clr(); console.log()
            }
        } else {
            process.stdout.write(`  ${C.dim}📋 Histórico — aguardando jogos...${C.reset}`); clr(); console.log()
        }
        clr(); console.log()

        // Overall progress
        const overallBar = progressBar(clubIdx, selectedClubs.length, Math.min(40, termWidth - 15))
        process.stdout.write(`  ${overallBar} ${C.dim}${clubIdx}/${selectedClubs.length} clubes${C.reset}`); clr(); console.log()
    }

    for (const currentSeason of selectedSeasons) {
        if (stopped) break
        const seasonTable = 'games_' + currentSeason.replace('/', '_')
        done = 0 // reset per season

        // Clean existing data if requested
        if (shouldClean) {
            process.stdout.write(C.clear)
            console.log(C.bold + C.purple + '  🏀 Dribly Scraper' + C.reset + C.dim + ` — ${currentSeason}` + C.reset)
            console.log(C.yellow + `  🧹 A limpar jogos existentes...` + C.reset)
            for (const club of selectedClubs) {
                const name = club.name.replace(/'/g, "''")
                await supabase.from(seasonTable).delete()
                    .or(`equipa_casa.ilike.%${name}%,equipa_fora.ilike.%${name}%`)
            }
            console.log(C.green + '  ✅ Dados anteriores removidos.' + C.reset)
        }

        // Initial draw
        process.stdout.write(C.clear)
        process.stdout.write(C.hideCursor)
        console.log(C.bold + C.purple + '  🏀 Dribly Scraper' + C.reset + C.dim + ` — ${currentSeason}` + C.reset)
        console.log(C.dim + `  ${selectedClubs.length} clubes  |  ${PARALLEL} em paralelo` + C.reset)
        console.log(C.bold + C.yellow + `  Ctrl+C para parar  |  Época ${selectedSeasons.indexOf(currentSeason)+1}/${selectedSeasons.length}` + C.reset)
        console.log()

        for (let i = 0; i < selectedClubs.length && !stopped; i += PARALLEL) {
            const batch = selectedClubs.slice(i, i + PARALLEL)
            const batchStart = i + 1
            const batchEnd = Math.min(i + PARALLEL, selectedClubs.length)

            // Show live "scraping..." header for this batch
            process.stdout.write(C.clear)
            process.stdout.write(C.hideCursor)
            console.log(C.bold + C.purple + '  🏀 Dribly Scraper' + C.reset + C.dim + ` — ${currentSeason}` + C.reset)
            console.log(C.dim + `  Clubes ${batchStart}-${batchEnd} de ${selectedClubs.length}  |  ${PARALLEL} em paralelo` + C.reset)
            console.log(C.bold + C.yellow + `  Ctrl+C para parar  |  Época ${selectedSeasons.indexOf(currentSeason)+1}/${selectedSeasons.length}` + C.reset)
            console.log()
            console.log(`  ${C.cyan}⚡ A pesquisar ${batch.length} clubes em paralelo...${C.reset}`)
            console.log()

            let batchDone = 0
            const liveUpdate = setInterval(() => {
                const pct = batch.length > 0 ? Math.round((batchDone / batch.length) * 100) : 0
                const bar = '█'.repeat(Math.round(batchDone / batch.length * 30)).padEnd(30, '░')
                process.stdout.write(`\r  ${C.purple}${bar}${C.reset} ${batchDone}/${batch.length}  (${pct}%)  ${C.dim}${totalGames} jogos${C.reset}`)
            }, 200)

            // Scrape all clubs in batch in parallel
            const results = await Promise.allSettled(
                batch.map(async (club) => {
                    if (stopped) return null
                    done++
                    const clubIdx = done

                    try {
                        const games = await scrapeClub(club.id, currentSeason)
                        batchDone++
                        return { club, games, clubIdx }
                    } catch (e) {
                        batchDone++
                        errors.push(club.name)
                        return { club, games: [], clubIdx, error: e.message }
                    }
                })
            )

            clearInterval(liveUpdate)
            process.stdout.write('\r' + ' '.repeat(80) + '\r') // clear progress line

            // Process results and upsert in batch
            for (const r of results) {
                if (r.status === 'rejected' || !r.value) continue
                const { club, games, clubIdx, error } = r.value

                if (error) {
                    console.log(`  ${C.red}❌ ${club.name}: ${error}${C.reset}`)
                    console.log()
                    continue
                }

                if (games.length === 0) {
                    console.log(`  ${C.dim}${club.name}: nenhum jogo${C.reset}`)
                    continue
                }

                // Batch upsert all games at once
                const BATCH_SIZE = 100
                for (let j = 0; j < games.length; j += BATCH_SIZE) {
                    const chunk = games.slice(j, j + BATCH_SIZE)
                    try {
                        await supabase.from(seasonTable).upsert(chunk, { onConflict: 'slug' })
                        totalGames += chunk.length
                    } catch { /* continue */ }
                }

                // Add to recent games
                for (const g of games) {
                    const dateShort = g.data ? g.data.slice(5) : '??-??'
                    const score = g.resultado_casa != null ? `${g.resultado_casa}-${g.resultado_fora}` : null
                    const text = `${dateShort} ${(g.equipa_casa||'?').slice(0,10)} ${score||'vs'} ${(g.equipa_fora||'?').slice(0,10)}`
                    recentGames.unshift({ text, status: score ? 'FINALIZADO' : 'AGENDADO', score })
                    if (recentGames.length > 12) recentGames.pop()
                }

                console.log(`  ${C.green}✅${C.reset} ${club.name}: ${C.bold}${games.length} jogos${C.reset}`)
            }

            console.log()
            console.log(`  ${C.dim}${'─'.repeat(50)}${C.reset}`)
            console.log(`  ${C.bold}Total: ${totalGames} jogos${C.reset}  |  ${C.dim}${done}/${selectedClubs.length} clubes${C.reset}`)
            console.log()
        }
    }

    process.stdout.write(C.showCursor)
    console.log(C.clear)
    console.log(C.bold + C.purple + '  🏀 Dribly Scraper' + C.reset)
    console.log()
    console.log(C.bold + C.green + `  ✅ Concluído!` + C.reset)
    console.log(C.dim + `     ${totalGames} jogos em ${done} clubes` + C.reset)
    console.log(C.dim + `     ${selectedClubs.length - errors.length} sucesso, ${errors.length} com erros` + C.reset)

    if (errors.length > 0) {
        console.log(C.red + `     Erros: ${errors.slice(0, 5).join(', ')}${errors.length > 5 ? '...' : ''}` + C.reset)
    }

    console.log(C.dim + '  🧹 A limpar ficheiros temporários...' + C.reset)
    cleanup()
    console.log(C.green + '  ✅ Limpo.' + C.reset)
    console.log()
}

main().catch((e) => {
    console.error(C.red + '\n  ❌ Erro fatal:' + C.reset, e.message)
    process.exit(1)
})
