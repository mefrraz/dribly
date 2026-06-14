/**
 * GET /api/jogos-do-dia?data=2026-06-14
 *
 * Busca as 4 competições principais na FPB, faz parse dos jogos,
 * devolve JSON. Upsert no Supabase em paralelo (não bloqueia resposta).
 */

export const config = { runtime: 'nodejs' }

const COMPS = [
    { name: 'Liga Betclic Masculina', fpbId: 10902 },
    { name: 'Proliga', fpbId: 10903 },
    { name: '1ª Divisão', fpbId: 10904 },
    { name: '2ª Divisão', fpbId: 10905 },
]

interface GameData {
    id: string
    slug: string
    data: string
    hora: string
    equipa_casa: string
    equipa_fora: string
    resultado_casa: number | null
    resultado_fora: number | null
    competicao: string
    escalao: string
    status: string
    local: string | null
    logotipo_casa: string | null
    logotipo_fora: string | null
}

function slugify(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

async function fetchFPBPage(path: string): Promise<string> {
    const res = await fetch(`https://www.fpb.pt/${path}/`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Dribly/1.0)' },
    })
    if (!res.ok) throw new Error(`FPB ${res.status}`)
    return await res.text()
}

function parseGames(html: string, competicao: string): GameData[] {
    if (!html) return []
    const games: GameData[] = []

    // FPB date format: "14 JUN 2026"
    const monthMap: Record<string, string> = {
        'JAN': '01', 'FEV': '02', 'MAR': '03', 'ABR': '04', 'MAI': '05', 'JUN': '06',
        'JUL': '07', 'AGO': '08', 'SET': '09', 'OUT': '10', 'NOV': '11', 'DEZ': '12',
    }

    // Split by day-wrapper
    const dayBlocks = html.split(/<div class="day-wrapper[^"]*">/)
    for (let i = 1; i < dayBlocks.length; i++) {
        const block = dayBlocks[i]

        // Extract date
        const dateMatch = block.match(/<h3 class="date">\s*(\d{1,2})\s*([A-Z]{3})\s*(\d{4})\s*<\/h3>/i)
        if (!dateMatch) continue
        const day = dateMatch[1].padStart(2, '0')
        const month = monthMap[dateMatch[2].toUpperCase()] || '01'
        const year = dateMatch[3]
        const dateStr = `${year}-${month}-${day}`

        // Extract games
        const gameRegex = /<a[^>]*href="\/ficha-de-jogo\/?\?internalID=(\d+)"[^>]*class="game-wrapper-a[^"]*">([\s\S]*?)<\/a>/gi
        let gameMatch
        while ((gameMatch = gameRegex.exec(block)) !== null) {
            const id = gameMatch[1]
            const gameHtml = gameMatch[2]

            // Teams (fullName spans)
            const teamRegex = /<span class="fullName[^"]*">([^<]+)<\/span>/gi
            const teams: string[] = []
            let tm
            while ((tm = teamRegex.exec(gameHtml)) !== null) {
                teams.push(tm[1].trim())
            }
            if (teams.length < 2) continue

            // Scores (results page)
            const scoreRegex = /<h3 class="results_text[^"]*">\s*(\d+)\s*<\/h3>/gi
            const scores: number[] = []
            let sm
            while ((sm = scoreRegex.exec(gameHtml)) !== null) {
                scores.push(parseInt(sm[1]))
            }

            // Hour (calendar page): <div class="hour"><h3>17H15</h3></div>
            const horaMatch = gameHtml.match(/<div class="hour[^"]*">\s*<h3>\s*(\d{1,2})[Hh](\d{2})\s*<\/h3>/i)
            const hora = horaMatch ? `${horaMatch[1].padStart(2, '0')}:${horaMatch[2]}` : ''

            // Logos
            const logoRegex = /<img[^>]*src="([^"]*\/CLU[^"]*)"[^>]*>/gi
            const logos: string[] = []
            let lm
            while ((lm = logoRegex.exec(gameHtml)) !== null) {
                logos.push(lm[1])
            }

            const isFinished = scores.length >= 2
            const status = isFinished ? 'FINALIZADO' : 'AGENDADO'
            const casa = teams[0]
            const fora = teams[1]
            const slug = `${dateStr}-${slugify(casa)}-${slugify(fora)}`

            games.push({
                id, slug, data: dateStr, hora,
                equipa_casa: casa, equipa_fora: fora,
                resultado_casa: isFinished ? scores[0] : null,
                resultado_fora: isFinished ? scores[1] : null,
                competicao, escalao: '',
                status, local: null,
                logotipo_casa: logos[0] || null,
                logotipo_fora: logos[1] || null,
            })
        }
    }

    return games
}

export default async function handler(req: Request): Promise<Response> {
    const url = new URL(req.url)
    const dataParam = url.searchParams.get('data')
    if (!dataParam) return Response.json({ error: 'Missing ?data=' }, { status: 400 })

    const allGames: GameData[] = []

    // Fetch all 4 competitions in parallel
    // Fetch both calendar (upcoming) and results (finished) for each competition
    const results = await Promise.allSettled(
        COMPS.flatMap(async (comp) => {
            const [calHtml, resHtml] = await Promise.all([
                fetchFPBPage(`calendario/${comp.fpbId}`).catch(() => ''),
                fetchFPBPage(`resultados/${comp.fpbId}`).catch(() => ''),
            ])
            return [
                ...parseGames(calHtml, comp.name),
                ...parseGames(resHtml, comp.name),
            ]
        })
    )

    for (const r of results) {
        if (r.status === 'fulfilled') {
            allGames.push(...r.value)
        }
    }

    // Filter by date
    const filtered = allGames.filter(g => g.data === dataParam)

    // Sort by hour
    filtered.sort((a, b) => (a.hora || '99:99').localeCompare(b.hora || '99:99'))

    // Fire-and-forget upsert to Supabase
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (supabaseUrl && supabaseKey && filtered.length > 0) {
        const { createClient } = await import('@supabase/supabase-js')
        const supabase = createClient(supabaseUrl, supabaseKey)
        // Don't await — fire and forget
        supabase.from('games_2025_2026').upsert(
            filtered.map(g => ({ ...g, updated_at: new Date().toISOString() })),
            { onConflict: 'slug' }
        ).then(() => {}, () => {})
    }

    return Response.json({
        jogos: filtered,
        total: filtered.length,
        competicoes: COMPS.map(c => c.name),
    })
}
