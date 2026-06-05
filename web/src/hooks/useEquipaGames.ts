import { useState, useEffect } from 'react'
import type { Match } from '../components/types'

const FPB_PROXY = '/api/fpb'

/** Fetch games for a specific equipa using FPB's admin-ajax POST endpoint */
async function fetchEquipaGames(equipaId: string, type: 'calendario' | 'resultados'): Promise<Match[]> {
    try {
        const body = new URLSearchParams({
            action: `get_${type}`,
            id: equipaId,
        }).toString()

        const r = await fetch(`${FPB_PROXY}?wp_action_post=1`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body,
        })
        if (!r.ok) return []
        const html = await r.text()
        return parseEquipaGames(html)
    } catch {
        return []
    }
}

/** Parse the FPB AJAX response HTML into Match objects */
function parseEquipaGames(html: string): Match[] {
    // The response is HTML with game cards similar to club calendar pages
    const games: Match[] = []

    // Extract game links
    const linkRe = /<a[^>]*href="\/ficha-de-jogo\?internalID=(\d+)"[^>]*>([\s\S]*?)<\/a>/g
    let m
    while ((m = linkRe.exec(html)) !== null) {
        const internalId = m[1]
        const block = m[2]

        // Extract date from parent .day-wrapper or .date
        // Date format: "Domingo, 15 Junho 2025"
        const dateMatch = html.substring(Math.max(0, m.index - 500), m.index).match(/(\d{1,2})\s+(Janeiro|Fevereiro|Mar[çc]o|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro)\s+(\d{4})/i)
        // Or try extracting from the block itself
        const dateMatch2 = block.match(/(\d{4}-\d{2}-\d{2})/)

        let data = ''
        if (dateMatch2) {
            data = dateMatch2[1]
        } else if (dateMatch) {
            const months: Record<string, number> = {
                'janeiro': 1, 'fevereiro': 2, 'março': 3, 'marco': 3, 'abril': 4, 'maio': 5, 'junho': 6,
                'julho': 7, 'agosto': 8, 'setembro': 9, 'outubro': 10, 'novembro': 11, 'dezembro': 12
            }
            const day = parseInt(dateMatch[1])
            const month = months[dateMatch[2].toLowerCase()]
            const year = parseInt(dateMatch[3])
            if (day && month && year) data = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        }

        // Teams
        const teams = block.match(/class="sigla">([^<]+)<\/div>/g)
        const homeTeam = teams?.[0]?.match(/>([^<]+)</)?.[1]?.trim() || ''
        const awayTeam = teams?.[1]?.match(/>([^<]+)</)?.[1]?.trim() || ''

        // Scores
        const scores = block.match(/class="score">(\d+)<\/div>/g)
        const homeScore = scores?.[0] ? parseInt(scores[0].match(/>(\d+)</)?.[1] || '0') : null
        const awayScore = scores?.[1] ? parseInt(scores[1].match(/>(\d+)</)?.[1] || '0') : null

        // Logos
        const logos = block.match(/src="([^"]*LOGO[^"]*\.(?:png|jpg|jpeg|svg))"/gi)
        const homeLogo = logos?.[0]?.match(/src="([^"]+)"/)?.[1] || null
        const awayLogo = logos?.[1]?.match(/src="([^"]+)"/)?.[1] || null

        // Hour
        const hourMatch = block.match(/(\d{2}:\d{2})/)
        const hora = hourMatch?.[1] || ''

        // Status
        const status: Match['status'] = homeScore !== null ? 'FINALIZADO' : 'AGENDADO'

        const slug = `${data}-${homeTeam.toLowerCase().replace(/\s+/g, '-')}-${awayTeam.toLowerCase().replace(/\s+/g, '-')}`

        games.push({
            id: internalId,
            slug,
            data,
            hora,
            equipa_casa: homeTeam,
            equipa_fora: awayTeam,
            resultado_casa: homeScore,
            resultado_fora: awayScore,
            escalao: '',
            competicao: '',
            local: null,
            logotipo_casa: homeLogo,
            logotipo_fora: awayLogo,
            status,
        })
    }

    return games
}

export function useEquipaGames(equipaId: string) {
    const [games, setGames] = useState<Match[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!equipaId) { setLoading(false); return }

        let cancelled = false
        async function load() {
            const [cal, res] = await Promise.all([
                fetchEquipaGames(equipaId, 'calendario'),
                fetchEquipaGames(equipaId, 'resultados'),
            ])
            if (cancelled) return
            // Merge, deduplicate by id
            const map = new Map<string, Match>()
            for (const g of [...cal, ...res]) if (!map.has(g.id)) map.set(g.id, g)
            setGames(Array.from(map.values()))
            setLoading(false)
        }
        load()
        return () => { cancelled = true }
    }, [equipaId])

    return { games, loading }
}
