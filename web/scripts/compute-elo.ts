/**
 * Compute-ELO — Calcula ratings ELO por época e guarda em club_elo_history.
 *
 * Uso:  npx tsx web/scripts/compute-elo.ts
 * Requer: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
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

function norm(s: string): string {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

interface Game {
    data: string
    equipa_casa: string
    equipa_fora: string
    resultado_casa: number | null
    resultado_fora: number | null
}

async function main() {
    console.log('🏀 Computing ELO ratings per season...\n')

    // ── Load club data ──
    const { data: clubData } = await supabase
        .from('clubs')
        .select('id, name, priority')

    if (!clubData) { console.error('No clubs found'); process.exit(1) }

    const clubs = clubData as { id: number; name: string; priority: number | null }[]
    console.log(`  📋 ${clubs.length} clubes carregados`)

    // Build priority lookup
    const clubPriority = new Map<string, number>()
    for (const c of clubs) {
        clubPriority.set(norm(c.name), c.priority ?? 4)
    }

    function getClubPriority(teamName: string): number {
        const n = norm(teamName)
        if (clubPriority.has(n)) return clubPriority.get(n)!
        const words = n.split(/\s+/).filter(w => w.length > 3)
        for (let i = words.length - 1; i >= 0; i--) {
            for (const [cn, p] of clubPriority) {
                if (cn.includes(words[i])) return p
            }
        }
        return 4
    }

    // ── Process each season independently ──
    for (const season of SEASONS) {
        const table = tableName(season)

        // Fetch games with pagination
        const games: Game[] = []
        let page = 0
        const PAGE = 1000
        while (true) {
            const { data, error } = await supabase
                .from(table)
                .select('data, equipa_casa, equipa_fora, resultado_casa, resultado_fora')
                .not('resultado_casa', 'is', null)
                .not('resultado_fora', 'is', null)
                .order('data', { ascending: true })
                .range(page * PAGE, (page + 1) * PAGE - 1)

            if (error) break
            if (!data || data.length === 0) break
            for (const row of data as unknown as Game[]) {
                games.push({
                    ...row,
                    equipa_casa: norm(row.equipa_casa),
                    equipa_fora: norm(row.equipa_fora),
                })
            }
            if (data.length < PAGE) break
            page++
        }

        if (games.length === 0) {
            console.log(`  ⚠️  ${season}: sem jogos`)
            continue
        }

        // Compute ELO for this season
        const ratings = new Map<string, number>()
        const gamesPlayed = new Map<string, number>()

        for (const game of games) {
            const casa = game.equipa_casa.trim()
            const fora = game.equipa_fora.trim()
            const scoreCasa = game.resultado_casa ?? 0
            const scoreFora = game.resultado_fora ?? 0

            const rCasa = ratings.get(casa) ?? START_RATING
            const rFora = ratings.get(fora) ?? START_RATING
            const pCasa = getClubPriority(casa)
            const pFora = getClubPriority(fora)

            const priorityAdj = (pFora - pCasa) * 100

            const eCasa = 1 / (1 + Math.pow(10, (rFora - rCasa + priorityAdj) / 400))
            const eFora = 1 - eCasa

            let sCasa = 0.5, sFora = 0.5
            if (scoreCasa > scoreFora) { sCasa = 1; sFora = 0 }
            else if (scoreFora > scoreCasa) { sCasa = 0; sFora = 1 }

            ratings.set(casa, rCasa + K_FACTOR * (sCasa - eCasa))
            ratings.set(fora, rFora + K_FACTOR * (sFora - eFora))
            gamesPlayed.set(casa, (gamesPlayed.get(casa) ?? 0) + 1)
            gamesPlayed.set(fora, (gamesPlayed.get(fora) ?? 0) + 1)
        }

        // Match to clubs and store
        let stored = 0
        for (const club of clubs) {
            const clubNorm = norm(club.name)
            let rating = START_RATING
            let gp = 0

            for (const [teamName, r] of ratings) {
                const teamNorm = norm(teamName)
                if (teamNorm === clubNorm || teamNorm.includes(clubNorm) || clubNorm.includes(teamNorm)) {
                    rating = r
                    gp = gamesPlayed.get(teamName) ?? 0
                    break
                }
            }

            // Fallback: match by last significant word
            if (gp === 0) {
                const clubWords = clubNorm.split(/\s+/).filter(w => w.length > 3)
                if (clubWords.length > 0) {
                    const lastWord = clubWords[clubWords.length - 1]
                    for (const [teamName, r] of ratings) {
                        const teamNorm = norm(teamName)
                        const teamWords = teamNorm.split(/\s+/).filter(w => w.length > 3)
                        if (lastWord.length >= 4 && teamWords.includes(lastWord)) {
                            rating = r
                            gp = gamesPlayed.get(teamName) ?? 0
                            break
                        }
                    }
                }
            }

            // Store even if 0 games (some clubs have no games this season)
            await supabase
                .from('club_elo_history')
                .upsert({
                    club_id: club.id,
                    season,
                    elo_rating: Math.round(rating),
                    games_played: gp,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'club_id,season' })
            stored++
        }

        console.log(`  ✅ ${season}: ${games.length} jogos → ${stored} clubes`)
    }

    // ── Sync current season ELO to clubs.elo_rating (for club page display) ──
    console.log('\n  📊 A sincronizar ELO da época atual para a tabela clubs...')
    const { data: currentSeason } = await supabase
        .from('club_elo_history')
        .select('club_id, elo_rating')
        .eq('season', '2025/2026')

    if (currentSeason) {
        let synced = 0
        for (const row of currentSeason as { club_id: number; elo_rating: number }[]) {
            await supabase
                .from('clubs')
                .update({ elo_rating: row.elo_rating })
                .eq('id', row.club_id)
            synced++
        }
        console.log(`  ✅ ${synced} clubes atualizados na tabela clubs`)
    }

    console.log('\n🏆 ELO por época completo!')
}

main().catch(err => {
    console.error('Failed:', err)
    process.exit(1)
})
