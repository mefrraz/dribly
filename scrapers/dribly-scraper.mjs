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
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, rmSync } from 'fs'
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
    console.log(`     ${C.purple}[2]${C.reset} Limpar antes (apaga jogos dos clubes e re-importa)`)
    console.log()
    console.log(C.bold + '  📋 Ficheiro de log:' + C.reset)
    console.log(`     ${C.purple}[1]${C.reset} Manter log (para debug)`)
    console.log(`     ${C.purple}[2]${C.reset} Apagar log ao sair`)
    console.log()

    const optRl = createInterface({ input: process.stdin, output: process.stdout })
    const optAnswer = await new Promise(resolve => {
        optRl.question(C.cyan + '  Clean,Log > ' + C.reset, resolve)
    })
    optRl.close()
    const parts = optAnswer.split(',').map(s => s.trim())
    const shouldClean = parts[0] === '2'
    const keepLog = parts[1] !== '2' // default: keep

    if (shouldClean) {
        console.log(C.yellow + '\n  🧹 A limpar jogos existentes...' + C.reset)
        for (const club of selectedClubs) {
            const name = club.name.replace(/'/g, "''")
            await supabase.from(seasonTable).delete()
                .or(`equipa_casa.ilike.%${name}%,equipa_fora.ilike.%${name}%`)
        }
        console.log(C.green + '  ✅ Dados anteriores removidos.\n' + C.reset)
    }

    console.log(C.clear)
    console.log(C.bold + C.purple + '  Dribly Scraper' + C.reset + C.dim + ` — ${season}` + C.reset)
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

    async function scrapeClub(clubId) {
        const url = (page) => `https://www.fpb.pt/${page}/clube_${clubId}/?epoca=${encodeURIComponent(season)}&escalao=S%C3%A9nior&genero=masculino`

        log(`Scraping club ${clubId} — ${season}`)

        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 15000)

        try {
            const [calRes, resRes] = await Promise.all([
                fetch(url('calendario'), { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: controller.signal }),
                fetch(url('resultados'), { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: controller.signal }),
            ])
            clearTimeout(timeout)
            log(`  Fetched calendar (${calRes.status}) and results (${resRes.status})`)

        const calHtml = await calRes.text()
        const resHtml = await resRes.text()
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
                    const timeText = $link.find('.time').text().trim() || $link.find('.hour').text().trim()
                    const locText = $link.find('.location').text().trim() || $link.find('.place').text().trim()
                    // Debug first game of each club
                    if (parsedLinks === 0) {
                        log(`    DEBUG game: resultText="${resultText}" timeText="${timeText}" locText="${locText}"`)
                    }

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
            clearTimeout(timeout)
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
                const res = await fetch(logoUrl)
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

    // Initial draw
    process.stdout.write(C.clear)
    process.stdout.write(C.hideCursor)
    console.log(C.bold + C.purple + '  🏀 Dribly Scraper' + C.reset + C.dim + ` — ${season}` + C.reset)
    console.log(C.dim + `  A iniciar scrape de ${selectedClubs.length} clubes...` + C.reset)
    console.log(C.bold + C.yellow + `  Ctrl+C para parar` + C.reset)
    console.log()

    for (let i = 0; i < selectedClubs.length && !stopped; i += 4) {
        const batch = selectedClubs.slice(i, i + 4)

        for (const club of batch) {
            if (stopped) break
            done++
            const clubIdx = done

            // Show searching screen (with logo, progress 0%, histórico)
            await drawScreen(club, 0, 0, clubIdx, true)

            let games = []
            try {
                games = await scrapeClub(club.id)
            } catch (e) {
                errors.push(club.name)
                process.stdout.write(C.clear)
                console.log(C.bold + C.purple + '  🏀 Dribly Scraper' + C.reset + C.dim + ` — ${season}` + C.reset)
                console.log(C.red + `  ❌ ${club.name}: ${e.message}` + C.reset)
                console.log()
                continue
            }

            const total = games.length
            let gameDone = 0

            // Show club result before processing games
            if (total === 0) {
                process.stdout.write(C.clear)
                console.log(C.bold + C.purple + '  🏀 Dribly Scraper' + C.reset + C.dim + ` — ${season}` + C.reset)
                console.log(C.dim + `  Clube ${clubIdx}/${selectedClubs.length} — ${club.name}` + C.reset)
                console.log(`  ${C.dim}Nenhum jogo encontrado${C.reset}`)
                console.log()
                // Still update overall count
                totalGames += 0
                continue
            }

            for (const g of games) {
                try {
                    await supabase.from(seasonTable).upsert(g, { onConflict: 'slug' })
                } catch { /* continue */ }
                gameDone++

                // Add to recent games
                const dateShort = g.data ? g.data.slice(5) : '??-??'
                const score = g.resultado_casa != null ? `${g.resultado_casa}-${g.resultado_fora}` : null
                const icon = score ? C.green + '✓' + C.reset : C.yellow + '○' + C.reset
                const text = `${dateShort} ${(g.equipa_casa||'?').slice(0,10)} ${score||'vs'} ${(g.equipa_fora||'?').slice(0,10)}`

                recentGames.unshift({
                    icon, text,
                    status: score ? 'FINALIZADO' : 'AGENDADO',
                    score,
                })
                if (recentGames.length > 12) recentGames.pop()

                await drawScreen(club, gameDone, total, clubIdx, false)
            }

            totalGames += games.length
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
