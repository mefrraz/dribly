#!/usr/bin/env node
/**
 * Count games per club directly from FPB — no Supabase
 * Usage: node scrapers/count-games.mjs
 */
import { execSync } from 'child_process'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { createInterface } from 'readline'
import { createRequire } from 'module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEPS_DIR = resolve(__dirname, '..', '.dribly-deps')

// Auto-install deps
if (!existsSync(resolve(DEPS_DIR, 'node_modules', 'cheerio')) || !existsSync(resolve(DEPS_DIR, 'node_modules', '@supabase', 'supabase-js'))) {
    mkdirSync(DEPS_DIR, { recursive: true })
    writeFileSync(resolve(DEPS_DIR, 'package.json'), JSON.stringify({ type: 'module', private: true }))
    console.log('Instalando cheerio + supabase-js...')
    execSync('npm install cheerio @supabase/supabase-js', { cwd: DEPS_DIR, stdio: 'pipe' })
}

const req = createRequire(pathToFileURL(resolve(DEPS_DIR, 'package.json')).href)
const cheerio = req('cheerio')
const { createClient } = req('@supabase/supabase-js')

async function askCredentials() {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    console.log(C.dim + '  Credenciais NÃO guardadas — só nesta sessão.' + C.reset)
    console.log(C.dim + '  Admin → Scraper → 📥 Script → Mostrar' + C.reset)
    console.log()
    const ask = (q) => new Promise(resolve => rl.question(C.cyan + q + C.reset, resolve))
    const url = await ask('  SUPABASE_URL: ')
    const key = await ask('  SUPABASE_SERVICE_ROLE_KEY: ')
    rl.close()
    if (!url || !key) { console.log(C.red + '\n  ❌ Credenciais obrigatórias.\n' + C.reset); process.exit(1) }
    return { url, key }
}

const C = { reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m', purple: '\x1b[35m', green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m', clear: '\x1b[2J\x1b[H' }

const SEASONS = [
    '2025/2026','2024/2025','2023/2024','2022/2023','2021/2022','2020/2021',
    '2019/2020','2018/2019','2017/2018','2016/2017','2015/2016','2014/2015',
    '2013/2014','2012/2013','2011/2012','2010/2011','2009/2010','2008/2009',
    '2007/2008','2006/2007','2005/2006','2004/2005','2003/2004',
]

// Load club list from Supabase
async function fetchClubs(url, key) {
    const supabase = createClient(url, key)

    console.log(C.dim + '  A carregar clubes do Supabase...' + C.reset)
    const { data, error } = await supabase.from('clubs').select('id,name').order('name')
    if (error || !data) { console.log(C.red + '  ❌ Erro ao carregar clubes' + C.reset); process.exit(1) }
    const clubs = data.map(c => [c.id, c.name || `Clube #${c.id}`])
    console.log(C.green + `  ✅ ${clubs.length} clubes carregados.\n` + C.reset)
    return clubs
}

let CLUBS = []

async function countClub(clubId, clubName, season) {
    const url = (page) => `https://www.fpb.pt/${page}/clube_${clubId}/?epoca=${encodeURIComponent(season)}&escalao=S%C3%A9nior&genero=masculino`
    try {
        const [calHtml, resHtml] = await Promise.all([
            fetch(url('calendario'), { headers: { 'User-Agent': 'Mozilla/5.0' } }).then(r => r.text()),
            fetch(url('resultados'), { headers: { 'User-Agent': 'Mozilla/5.0' } }).then(r => r.text()),
        ])

        function count(html) {
            const $ = cheerio.load(html)
            let n = 0
            $('.day-wrapper a.game-wrapper-a').each(() => n++)
            return n
        }

        return Math.max(count(calHtml), count(resHtml))
    } catch {
        return 0
    }
}

async function main() {
    // Log setup
    const LOG = resolve(DEPS_DIR, 'count-games.log')
    mkdirSync(DEPS_DIR, { recursive: true })
    const log = (msg) => { const ts = new Date().toISOString(); writeFileSync(LOG, `[${ts}] ${msg}\n`, { flag: 'a' }) }

    console.log(C.clear)
    console.log(C.bold + C.purple + '  Contador de Jogos FPB' + C.reset)
    console.log(C.dim + '  Conta jogos na FPB  |  Log: ' + LOG + C.reset)
    console.log()

    // Credentials
    const { url, key } = await askCredentials()

    // Season selection
    console.log(C.bold + '  📅 Época:' + C.reset)
    console.log(`     ${C.purple}[A]${C.reset} Todas (23 épocas)`)
    console.log(`     ${C.purple}[1-23]${C.reset} Escolher número (1=2025/2026)`)
    console.log()

    const rl = createInterface({ input: process.stdin, output: process.stdout })
    const sChoice = await new Promise(resolve => rl.question(C.cyan + '  > ' + C.reset, resolve))
    rl.close()

    let seasons
    if (sChoice.toUpperCase() === 'A') seasons = SEASONS
    else { const i = parseInt(sChoice) - 1; if (i >= 0 && i < SEASONS.length) seasons = [SEASONS[i]]; else { console.log(C.red + 'Inválido' + C.reset); process.exit(1) } }

    // Fetch clubs from Supabase
    CLUBS = await fetchClubs(url, key)
    if (CLUBS.length === 0) { console.log(C.red + '  ❌ Nenhum clube encontrado.' + C.reset); process.exit(1) }

    // Show clubs
    console.log(C.clear)
    console.log(C.bold + C.purple + '  Contador de Jogos' + C.reset + C.dim + ` — ${seasons.length} épocas` + C.reset)
    console.log()
    const preview = CLUBS.slice(0, 20)
    preview.forEach(([id, name], i) => {
        console.log(`  ${C.purple}[${String(i+1).padStart(2)}]${C.reset} ${name.slice(0, 35).padEnd(36)} ${C.dim}#${id}${C.reset}`)
    })
    if (CLUBS.length > 20) console.log(`  ${C.dim}  ... +${CLUBS.length - 20} clubes${C.reset}`)
    console.log(`  ${C.purple}[A]${C.reset} Todos (${CLUBS.length} clubes)`)
    console.log()

    const rl2 = createInterface({ input: process.stdin, output: process.stdout })
    const cChoice = await new Promise(resolve => rl2.question(C.cyan + '  > ' + C.reset, resolve))
    rl2.close()

    let targets
    if (cChoice.toUpperCase() === 'A') targets = CLUBS
    else { const i = parseInt(cChoice) - 1; if (i >= 0 && i < CLUBS.length) targets = [CLUBS[i]]; else { console.log(C.red + 'Inválido' + C.reset); process.exit(1) } }

    // Ctrl+C handler — saves progress
    let stopped = false
    process.on('SIGINT', () => {
        stopped = true
        console.log(C.yellow + '\n\n  ⏸️  Interrompido. Resultados parciais guardados em:' + C.reset)
        console.log(C.dim + `  ${LOG}` + C.reset)
        console.log()
        process.exit(0)
    })

    // Count!
    console.log(C.clear)
    console.log(C.bold + C.purple + '  A contar...' + C.reset)
    console.log(C.dim + `  ${targets.length} clubes × ${seasons.length} épocas  |  Ctrl+C para parar` + C.reset)
    console.log()

    log(`START: ${targets.length} clubes × ${seasons.length} épocas`)
    let grandTotal = 0
    const totalOps = targets.length * seasons.length
    let done = 0

    for (const season of seasons) {
        if (stopped) break
        let seasonTotal = 0
        console.log(C.cyan + `\n  📅 ${season}` + C.reset)
        log(`--- ${season} ---`)

        for (const [id, name] of targets) {
            if (stopped) break
            const n = await countClub(id, name, season)
            done++
            seasonTotal += n
            grandTotal += n
            log(`${season} | ${name} (#${id}) | ${n} jogos`)
            const pct = Math.round((done / totalOps) * 100)
            const bar = '█'.repeat(Math.floor(pct / 4)) + '░'.repeat(25 - Math.floor(pct / 4))
            process.stdout.write(`\r  [${C.purple}${bar}${C.reset}] ${pct}%  ${name.padEnd(25)} ${C.bold}${n}${C.reset} jogos  |  Total: ${grandTotal}`)
        }
        console.log(`\n  ${C.green}✅ ${season}: ${seasonTotal} jogos${C.reset}  |  Acumulado: ${grandTotal}`)
        log(`${season} TOTAL: ${seasonTotal} | ACUMULADO: ${grandTotal}`)
    }

    log(`FINAL: ${grandTotal} jogos em ${done} operações`)
    console.log(C.bold + C.green + `\n  🏀 Total: ${grandTotal} jogos` + C.reset)
    console.log(C.dim + `  Resultados guardados em: ${LOG}` + C.reset)

    // Cleanup deps, keep logs
    const { rmSync } = req('fs')
    try {
        const nm = resolve(DEPS_DIR, 'node_modules')
        if (existsSync(nm)) rmSync(nm, { recursive: true, force: true })
        const pkg = resolve(DEPS_DIR, 'package.json')
        if (existsSync(pkg)) rmSync(pkg, { force: true })
    } catch {}
    console.log(C.dim + '  🧹 Dependências removidas, log mantido.' + C.reset)
    console.log()
}

main().catch(e => { console.error(C.red + 'Erro:' + C.reset, e.message); process.exit(1) })
