/**
 * Compute-ELO — Calcula ratings ELO para todos os clubes com base em 23 épocas.
 *
 * Uso:  npx tsx web/scripts/compute-elo.ts
 * Requer: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY no ambiente (.env ou CI)
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    realtime: { transport: WebSocket },
})

const START_RATING = 1500
const K_FACTOR = 32

const SEASONS = [
    '2025/2026', '2024/2025', '2023/2024', '2022/2023', '2021/2022', '2020/2021',
    '2019/2020', '2018/2019', '2017/2018', '2016/2017', '2015/2016', '2014/2015',
    '2013/2014', '2012/2013', '2011/2012', '2010/2011', '2009/2010', '2008/2009',
    '2007/2008', '2006/2007', '2005/2006', '2004/2005', '2003/2004',
]

function tableName(season: string): string {
    return 'games_' + season.replace('/', '_')
}

interface Game {
    data: string
    equipa_casa: string
    equipa_fora: string
    resultado_casa: number | null
    resultado_fora: number | null
}

async function main() {
    console.log('🏀 Computing ELO ratings...\n')

    // 1. Fetch ALL games from all seasons
    const allGames: Game[] = []
    for (const season of SEASONS) {
        const table = tableName(season)
        const { data, error } = await supabase
            .from(table)
            .select('data, equipa_casa, equipa_fora, resultado_casa, resultado_fora')
            .not('resultado_casa', 'is', null)
            .not('resultado_fora', 'is', null)
            .order('data', { ascending: true })

        if (error) {
            console.error(`  ⚠️  ${table}: ${error.message}`)
            continue
        }
        if (data) {
            console.log(`  ✅ ${table}: ${data.length} jogos`)
            allGames.push(...(data as unknown as Game[]))
        }
    }

    // 2. Sort all games by date
    allGames.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())
    console.log(`\n  📊 Total: ${allGames.length} jogos processados`)

    // 3. Compute ELO
    const ratings = new Map<string, number>()

    function getRating(club: string): number {
        return ratings.get(club) ?? START_RATING
    }

    for (const game of allGames) {
        const casa = game.equipa_casa.trim()
        const fora = game.equipa_fora.trim()
        const scoreCasa = game.resultado_casa ?? 0
        const scoreFora = game.resultado_fora ?? 0

        const rCasa = getRating(casa)
        const rFora = getRating(fora)

        // Expected scores
        const eCasa = 1 / (1 + Math.pow(10, (rFora - rCasa) / 400))
        const eFora = 1 - eCasa

        // Actual scores
        let sCasa = 0.5
        let sFora = 0.5
        if (scoreCasa > scoreFora) { sCasa = 1; sFora = 0 }
        else if (scoreFora > scoreCasa) { sCasa = 0; sFora = 1 }

        // New ratings
        ratings.set(casa, rCasa + K_FACTOR * (sCasa - eCasa))
        ratings.set(fora, rFora + K_FACTOR * (sFora - eFora))
    }

    console.log(`  🧮 Ratings calculados para ${ratings.size} equipas`)

    // 4. Match team names to club IDs via the clubs table
    const { data: clubs } = await supabase
        .from('clubs')
        .select('id, name')

    if (!clubs) {
        console.error('Failed to fetch clubs')
        process.exit(1)
    }

    function normalize(s: string): string {
        return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
    }

    console.log('\n  🔗 A ligar equipas aos clubes...')
    let matched = 0

    for (const club of clubs) {
        const clubNorm = normalize(club.name)
        let bestRating: number | null = null

        // Try exact match first
        for (const [teamName, rating] of ratings) {
            const teamNorm = normalize(teamName)
            if (teamNorm === clubNorm || teamNorm.includes(clubNorm) || clubNorm.includes(teamNorm)) {
                bestRating = rating
                break
            }
        }

        // Fallback: match by last significant word
        if (bestRating === null) {
            const clubWords = clubNorm.split(/\s+/).filter(w => w.length > 3)
            const lastClubWord = clubWords[clubWords.length - 1]
            for (const [teamName, rating] of ratings) {
                const teamNorm = normalize(teamName)
                const teamWords = teamNorm.split(/\s+/).filter(w => w.length > 3)
                if (lastClubWord && teamWords.includes(lastClubWord)) {
                    bestRating = rating
                    break
                }
            }
        }

        if (bestRating !== null) {
            await supabase
                .from('clubs')
                .update({ elo_rating: Math.round(bestRating) })
                .eq('id', club.id)
            matched++
        }
    }

    console.log(`  ✅ ${matched}/${clubs.length} clubes atualizados com ELO`)
    console.log('\n🏆 Ranking ELO completo!')
}

main().catch(err => {
    console.error('Failed:', err)
    process.exit(1)
})
