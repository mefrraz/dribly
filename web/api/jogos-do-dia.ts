/**
 * GET /api/jogos-do-dia?data=2026-06-14
 *
 * Busca as 4 competições principais na FPB, faz parse dos jogos,
 * devolve JSON. Upsert no Supabase em paralelo (não bloqueia resposta).
 */

export const config = { runtime: 'nodejs' }

const COMPS = [
    { name: 'Liga Betclic Masculina', fpbPage: 'calendario', fpbId: 10902 },
    { name: 'Proliga', fpbPage: 'calendario', fpbId: 10903 },
    { name: '1ª Divisão', fpbPage: 'calendario', fpbId: 10904 },
    { name: '2ª Divisão', fpbPage: 'calendario', fpbId: 10905 },
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
    const games: GameData[] = []

    // Match day wrappers with games
    const dayRegex = /<h3 class="date">([^<]+)<\/h3>([\s\S]*?)(?=<h3 class="date">|$)/g
    let dayMatch

    while ((dayMatch = dayRegex.exec(html)) !== null) {
        const dateRaw = dayMatch[1].trim()
        const dayContent = dayMatch[2]

        // Parse date: "Sábado, 14 Junho 2026" → "2026-06-14"
        const months: Record<string, string> = {
            'janeiro': '01', 'fevereiro': '02', 'março': '03', 'abril': '04',
            'maio': '05', 'junho': '06', 'julho': '07', 'agosto': '08',
            'setembro': '09', 'outubro': '10', 'novembro': '11', 'dezembro': '12',
        }
        const parts = dateRaw.split(' ')
        const day = parts[1]
        const monthName = (parts[2] || '').toLowerCase()
        const year = parts[3] || ''
        const month = months[monthName] || '01'
        const dateStr = `${year}-${month}-${String(day).padStart(2, '0')}`

        // Match game links
        const gameRegex = /<a[^>]*href="\/ficha-de-jogo\/\?internalID=(\d+)"[^>]*>([\s\S]*?)<\/a>/g
        let gameMatch

        while ((gameMatch = gameRegex.exec(dayContent)) !== null) {
            const id = gameMatch[1]
            const gameHtml = gameMatch[2]

            // Teams
            const teamRegex = /<span class="fullName[^"]*">([^<]+)<\/span>/g
            const teams: string[] = []
            let teamMatch
            while ((teamMatch = teamRegex.exec(gameHtml)) !== null) {
                teams.push(teamMatch[1].trim())
            }

            if (teams.length < 2) continue

            // Scores
            const scoreRegex = /<h3 class="results_text[^"]*">\s*(\d+)\s*<\/h3>/g
            const scores: number[] = []
            let scoreMatch
            while ((scoreMatch = scoreRegex.exec(gameHtml)) !== null) {
                scores.push(parseInt(scoreMatch[1]))
            }

            // Hour
            const horaMatch = gameHtml.match(/<span class="hour[^"]*">([^<]+)<\/span>/)
            const hora = horaMatch ? horaMatch[1].trim() : ''

            // Status
            const isFinished = scores.length >= 2
            const isLive = /a decorrer/i.test(gameHtml)
            const status = isLive ? 'A DECORRER' : isFinished ? 'FINALIZADO' : 'AGENDADO'

            // Logos
            const logoRegex = /<img[^>]*src="([^"]*\/CLU[^"]*)"[^>]*>/gi
            const logos: string[] = []
            let logoMatch
            while ((logoMatch = logoRegex.exec(gameHtml)) !== null) {
                logos.push(logoMatch[1])
            }

            const casa = teams[0]
            const fora = teams[1]
            const slug = `${dateStr}-${slugify(casa)}-${slugify(fora)}`

            games.push({
                id,
                slug,
                data: dateStr,
                hora,
                equipa_casa: casa,
                equipa_fora: fora,
                resultado_casa: isFinished ? scores[0] : null,
                resultado_fora: isFinished ? scores[1] : null,
                competicao,
                escalao: '',
                status,
                local: null,
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
    const results = await Promise.allSettled(
        COMPS.map(async (comp) => {
            const html = await fetchFPBPage(`${comp.fpbPage}/competition_${comp.fpbId}`)
            return parseGames(html, comp.name)
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
