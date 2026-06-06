import { useState, useEffect } from 'react'
import type { Match } from '../components/types'

const FPB_PROXY = '/api/fpb'

const MONTHS: Record<string, number> = {
    'JAN': 1, 'FEV': 2, 'MAR': 3, 'ABR': 4, 'MAI': 5, 'JUN': 6,
    'JUL': 7, 'AGO': 8, 'SET': 9, 'OUT': 10, 'NOV': 11, 'DEZ': 12,
}

function parseDate(dateStr: string): string {
    const parts = dateStr.trim().split(/\s+/)
    if (parts.length < 3) return ''
    const day = parseInt(parts[0])
    const month = MONTHS[parts[1]?.toUpperCase()]
    const year = parseInt(parts[2])
    if (!day || !month || !year) return ''
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function parseGames(html: string, isCalendar: boolean): Match[] {
    const games: Match[] = []
    const gameRe = /<a href="\/ficha-de-jogo\?internalID=(\d+)"[^>]*>([\s\S]*?)<\/a>/g
    let gm
    while ((gm = gameRe.exec(html)) !== null) {
            const internalId = gm[1]
            const block = gm[2]
            const gamePos = gm.index

            // Find date: look backward for nearest <h3 class="date">
            const before = html.substring(Math.max(0, gamePos - 2000), gamePos)
            const dateMatch = before.match(/<h3 class="date">\s*([^<]+)\s*<\/h3>/g)
            const dateStr = dateMatch ? dateMatch[dateMatch.length - 1]?.match(/>([^<]+)</)?.[1]?.trim() : ''
            const date = dateStr ? parseDate(dateStr) : ''

            const siglas = [...block.matchAll(/<span class="sigla">([^<]+)<\/span>/g)].map(m => m[1].trim())
            const scores = [...block.matchAll(/results_text[^>]*>[\s\S]*?(\d+)[\s\S]*?<\/h3>/g)].map(m => parseInt(m[1]))
            const logos = [...block.matchAll(/<img[^>]*src="([^"]+)"[^>]*>/g)].map(m => m[1].replace(/^FPB%20-%20Equipa_files\//, ''))
            const hourMatch = block.match(/hour[^>]*>[\s\S]*?(\d{1,2})H(\d{2})/i)
            const hora = hourMatch ? `${hourMatch[1].padStart(2, '0')}:${hourMatch[2]}` : ''
            const localMatch = block.match(/<b>\s*([^<]+?)\s*<\/b>/)
            const local = localMatch?.[1]?.trim() || null
            const compMatch = block.match(/<div class="competition">[\s\S]*?<span>\s*([^<]+)\s*<\/span>/)
            const compRaw = compMatch?.[1]?.trim() || ''
            // "Sub 14 Masculino | CD 2DIV S14 MASC" → escalão = first part
            const partes = compRaw.split('|')
            const escalao = partes[0]?.trim() || ''
            const competicao = partes[1]?.trim() || compRaw

            const hasScore = scores[0] !== undefined && scores[1] !== undefined
            const status: Match['status'] = hasScore ? 'FINALIZADO' : 'AGENDADO'
            // In calendar section, skip games that already happened (past date or have scores)
            if (isCalendar) {
                if (hasScore) continue
                if (date && date < new Date().toISOString().split('T')[0]) continue
            }

            games.push({
                id: internalId,
                slug: `${date}-${siglas[0]?.toLowerCase().replace(/\s+/g, '-') || 'x'}-${siglas[1]?.toLowerCase().replace(/\s+/g, '-') || 'y'}`,
                data: date,
                hora,
                equipa_casa: siglas[0] || '',
                equipa_fora: siglas[1] || '',
                resultado_casa: scores[0] ?? null,
                resultado_fora: scores[1] ?? null,
                escalao,
                competicao,
                local,
                logotipo_casa: logos[0] || null,
                logotipo_fora: logos[1] || null,
                status,
            })
        }
    return games
}

function extractTeamPhoto(html: string): string | null {
    const m = html.match(/<div class="team-right[^"]*">\s*<img\s+src="([^"]+)"\s*\/>/)
    return m?.[1]?.trim() || null
}

function extractTeamInfo(html: string): { nome: string; escalao: string } {
    const nm = html.match(/<div class="team-nome">\s*([^<]+)\s*<\/div>/)
    const lv = html.match(/<div class="team-level">\s*([^<]+)\s*<\/div>/)
    return {
        nome: nm?.[1]?.trim() || '',
        escalao: (lv?.[1]?.trim() || '').split('|')[0]?.trim() || '',
    }
}

export function useEquipaGames(equipaId: string) {
    const [games, setGames] = useState<Match[]>([])
    const [photo, setPhoto] = useState<string | null>(null)
    const [teamInfo, setTeamInfo] = useState<{ nome: string; escalao: string }>({ nome: '', escalao: '' })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!equipaId) { setLoading(false); return }

        let cancelled = false
        async function load() {
            try {
                const r = await fetch(`${FPB_PROXY}?page=equipa&equipa_id=${equipaId}`)
                if (!r.ok || cancelled) { setLoading(false); return }
                const html = await r.text()
                setPhoto(extractTeamPhoto(html))
                setTeamInfo(extractTeamInfo(html))

                // Extract sections by finding start positions and taking content until next team-wrapper
                function extractSection(tabindex: number): string {
                    const startTag = `<div class="team-wrapper" tabindex=${tabindex}>`
                    const start = html.indexOf(startTag)
                    if (start < 0) return ''
                    const contentStart = start + startTag.length
                    // Find the next team-wrapper after this one
                    const nextIndex = html.indexOf('<div class="team-wrapper" tabindex=', contentStart)
                    const end = nextIndex > 0 ? nextIndex : html.length
                    return html.substring(contentStart, end)
                }
                const calendarHtml = extractSection(2)
                const resultsHtml = extractSection(3)

                const calendarGames = parseGames(calendarHtml, true)
                const resultsGames = parseGames(resultsHtml, false)

                // Merge, deduplicate by id
                const map = new Map<string, Match>()
                for (const g of [...calendarGames, ...resultsGames]) {
                    if (!map.has(g.id)) map.set(g.id, g)
                }

                if (!cancelled) {
                    setGames(Array.from(map.values()))
                    setLoading(false)
                }
            } catch { if (!cancelled) setLoading(false) }
        }
        load()
        return () => { cancelled = true }
    }, [equipaId])

    return { games, photo, teamInfo, loading }
}
