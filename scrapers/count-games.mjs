#!/usr/bin/env node
/**
 * Count games across all clubs and seasons (from Supabase)
 * Usage: node scrapers/count-games.mjs [season]
 *   node scrapers/count-games.mjs            → all seasons
 *   node scrapers/count-games.mjs 2025/2026  → one season
 */
import { execSync } from 'child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { createRequire } from 'module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEPS_DIR = resolve(__dirname, '..', '.dribly-deps')

// Auto-install deps
if (!existsSync(resolve(DEPS_DIR, 'node_modules', '@supabase', 'supabase-js'))) {
    mkdirSync(DEPS_DIR, { recursive: true })
    writeFileSync(resolve(DEPS_DIR, 'package.json'), JSON.stringify({ type: 'module', private: true }))
    console.log('📦 Installing @supabase/supabase-js...')
    execSync('npm install @supabase/supabase-js', { cwd: DEPS_DIR, stdio: 'pipe' })
    console.log('✅ Done.\n')
}

const req = createRequire(pathToFileURL(resolve(DEPS_DIR, 'package.json')).href)
const { createClient } = req('@supabase/supabase-js')

// Load env
const envPath = resolve(__dirname, '..', 'web', '.env')
if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
        const eq = line.indexOf('=')
        if (eq > 0) { const k = line.slice(0, eq).trim(); const v = line.slice(eq + 1).trim(); if (!process.env[k]) process.env[k] = v }
    }
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
    console.log('\x1b[31mMissing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env\x1b[0m')
    process.exit(1)
}
const supabase = createClient(url, key)

const ALL_SEASONS = [
    '2025/2026','2024/2025','2023/2024','2022/2023','2021/2022','2020/2021',
    '2019/2020','2018/2019','2017/2018','2016/2017','2015/2016','2014/2015',
    '2013/2014','2012/2013','2011/2012','2010/2011','2009/2010','2008/2009',
    '2007/2008','2006/2007','2005/2006','2004/2005','2003/2004',
]

const C = { reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m', purple: '\x1b[35m', green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m' }

async function main() {
    const targetSeason = process.argv[2] || null
    const seasons = targetSeason ? [targetSeason] : ALL_SEASONS

    console.log(C.bold + C.purple + '\n  Contador de Jogos' + C.reset)
    console.log(C.dim + `  ${targetSeason || 'Todas as épocas'}` + C.reset)
    console.log()

    let grandTotal = 0

    for (const s of seasons) {
        const table = 'games_' + s.replace('/', '_')
        try {
            // Count total games
            const { count: total, error: err1 } = await supabase.from(table).select('*', { count: 'exact', head: true })
            // Count distinct club pairs (unique by slug)
            const { count: withResult, error: err2 } = await supabase.from(table).select('*', { count: 'exact', head: true }).not('resultado_casa', 'is', null)
            const { count: scheduled, error: err3 } = await supabase.from(table).select('*', { count: 'exact', head: true }).is('resultado_casa', null)

            if (!err1 && total !== null) {
                const done = withResult || 0
                const pend = scheduled || 0
                console.log(`  ${C.cyan}${s}${C.reset}: ${C.bold}${total}${C.reset} jogos (${C.green}${done} finalizados${C.reset}, ${C.yellow}${pend} agendados${C.reset})`)
                grandTotal += total
            } else {
                console.log(`  ${s}: ${C.dim}tabela vazia ou não existe${C.reset}`)
            }
        } catch {
            console.log(`  ${s}: ${C.dim}tabela não existe${C.reset}`)
        }
    }

    console.log(C.bold + C.green + `\n  🏀 Total: ${grandTotal} jogos${C.reset}\n`)
}

main().catch(e => { console.error(C.red + 'Erro:' + C.reset, e.message); process.exit(1) })
