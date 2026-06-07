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

// Auto-install cheerio
if (!existsSync(resolve(DEPS_DIR, 'node_modules', 'cheerio'))) {
    mkdirSync(DEPS_DIR, { recursive: true })
    writeFileSync(resolve(DEPS_DIR, 'package.json'), JSON.stringify({ type: 'module', private: true }))
    console.log('Instalando cheerio...')
    execSync('npm install cheerio', { cwd: DEPS_DIR, stdio: 'pipe' })
}

const req = createRequire(pathToFileURL(resolve(DEPS_DIR, 'package.json')).href)
const cheerio = req('cheerio')

const C = { reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m', purple: '\x1b[35m', green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m', clear: '\x1b[2J\x1b[H' }

const SEASONS = [
    '2025/2026','2024/2025','2023/2024','2022/2023','2021/2022','2020/2021',
    '2019/2020','2018/2019','2017/2018','2016/2017','2015/2016','2014/2015',
    '2013/2014','2012/2013','2011/2012','2010/2011','2009/2010','2008/2009',
    '2007/2008','2006/2007','2005/2006','2004/2005','2003/2004',
]

// Hardcoded club IDs and names from Supabase (avoids scraping the clubs page)
const CLUBS = [
    [169,'FC Porto'],[120,'SL Benfica'],[127,'Sporting CP'],[28,'UD Oliveirense'],
    [119,'FC Gaia'],[12,'Ovarense'],[1,'Anadia FC'],[39,'Académica'],
    [188,'Académico FC'],[3,'Alenquer'],[196,'Angrabasket'],[209,'Atlético CP'],
    [232,'Barreirense'],[273,'Belenenses'],[356,'CAB Madeira'],[357,'CAB Lisboa'],
    [370,'UTAD'],[632,'CD Póvoa'],[703,'Artenave'],[862,'Esgueira'],
    [873,'Estoril'],[914,'Galitos'],[941,'GDB Leca'],[948,'Illiabum'],
    [953,'Imortal'],[2405,'Lusitânia'],[2539,'Maia BC'],[2620,'NCR Valongo'],
    [2623,'NB Queluz'],[2660,'Odisseia'],[2694,'Padernense'],[2717,'Portimonense'],
    [2813,'Salesianos'],[3330,'Sangalhos'],[3335,'Santa Maria'],[3400,'Sertã'],
    [3411,'Seixal'],[3484,'Sines'],[3538,'Tavira'],[3668,'Viana'],
    [3671,'Vila Real'],[3679,'Vitória SC'],[3682,'Xico Andebol'],
    [3695,'Foz Côa'],[3709,'Almeirim'],[3711,'Amadora'],[3714,'Barcelos'],
    [3715,'Braga BC'],[3728,'Coimbra'],[3730,'AMA Basket'],[3751,'Eléctrico'],
    [3761,'Figueira da Foz'],[3762,'Gafanha'],[3763,'Lousada'],[3765,'Viseu'],
    [2846,'Odisseia 2010'],[3484,'Sines'],
]

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
    console.log(C.clear)
    console.log(C.bold + C.purple + '  Contador de Jogos FPB' + C.reset)
    console.log(C.dim + '  Direto da FPB — sem Supabase' + C.reset)
    console.log()

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

    // Show clubs
    console.log(C.clear)
    console.log(C.bold + C.purple + '  Contador de Jogos' + C.reset + C.dim + ` — ${seasons.length} épocas` + C.reset)
    console.log()
    CLUBS.forEach(([id, name], i) => {
        console.log(`  ${C.purple}[${String(i+1).padStart(2)}]${C.reset} ${name.padEnd(20)} ${C.dim}#${id}${C.reset}`)
    })
    console.log(`  ${C.purple}[A]${C.reset} Todos (${CLUBS.length} clubes)`)
    console.log()

    const rl2 = createInterface({ input: process.stdin, output: process.stdout })
    const cChoice = await new Promise(resolve => rl2.question(C.cyan + '  > ' + C.reset, resolve))
    rl2.close()

    let targets
    if (cChoice.toUpperCase() === 'A') targets = CLUBS
    else { const i = parseInt(cChoice) - 1; if (i >= 0 && i < CLUBS.length) targets = [CLUBS[i]]; else { console.log(C.red + 'Inválido' + C.reset); process.exit(1) } }

    // Count!
    console.log(C.clear)
    console.log(C.bold + C.purple + '  A contar...' + C.reset)
    console.log(C.dim + `  ${targets.length} clubes × ${seasons.length} épocas` + C.reset)
    console.log()

    let grandTotal = 0
    const totalOps = targets.length * seasons.length
    let done = 0

    for (const season of seasons) {
        let seasonTotal = 0
        console.log(C.cyan + `\n  📅 ${season}` + C.reset)

        for (const [id, name] of targets) {
            const n = await countClub(id, name, season)
            done++
            seasonTotal += n
            grandTotal += n
            const pct = Math.round((done / totalOps) * 100)
            const bar = '█'.repeat(Math.floor(pct / 4)) + '░'.repeat(25 - Math.floor(pct / 4))
            process.stdout.write(`\r  [${C.purple}${bar}${C.reset}] ${pct}%  ${name.padEnd(22)} ${C.bold}${n}${C.reset} jogos`)
        }
        console.log(`\n  ${C.green}✅ ${season}: ${seasonTotal} jogos${C.reset}`)
    }

    console.log(C.bold + C.green + `\n  🏀 Total: ${grandTotal} jogos` + C.reset)
    console.log()
}

main().catch(e => { console.error(C.red + 'Erro:' + C.reset, e.message); process.exit(1) })
