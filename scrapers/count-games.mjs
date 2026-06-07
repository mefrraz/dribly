// Quick count: total games across all clubs × all seasons
// Usage: node scrapers/count-games.mjs
import { createRequire } from 'module'
import { resolve, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
const __dirname = dirname(fileURLToPath(import.meta.url))
const req = createRequire(pathToFileURL(resolve(__dirname, '..', '.dribly-deps', 'package.json')).href)
const { createClient } = req('@supabase/supabase-js')

// Read creds from env
const { readFileSync, existsSync } = req('fs')
const envPath = resolve(__dirname, '..', 'web', '.env')
if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
        const [k, v] = line.split('=')
        if (k && v && !process.env[k]) process.env[k.trim()] = v.trim()
    }
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) { console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }
const supabase = createClient(url, key)

const SEASONS = [
    '2025_2026','2024_2025','2023_2024','2022_2023','2021_2022','2020_2021',
    '2019_2020','2018_2019','2017_2018','2016_2017','2015_2016','2014_2015',
    '2013_2014','2012_2013','2011_2012','2010_2011','2009_2010','2008_2009',
    '2007_2008','2006_2007','2005_2006','2004_2005','2003_2004',
]

async function main() {
    let grandTotal = 0
    for (const s of SEASONS) {
        try {
            const { count, error } = await supabase
                .from('games_' + s)
                .select('*', { count: 'exact', head: true })
            if (!error && count !== null) {
                console.log(`  ${s.replace('_', '/')}: ${count} jogos`)
                grandTotal += count
            } else {
                console.log(`  ${s.replace('_', '/')}: tabela não existe ou vazia`)
            }
        } catch {
            console.log(`  ${s.replace('_', '/')}: erro`)
        }
    }
    console.log(`\n  ✅ Total: ${grandTotal} jogos em todas as épocas`)
}

main()
