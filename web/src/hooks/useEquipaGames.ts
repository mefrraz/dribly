import { useState, useEffect } from 'react'
import type { Match } from '../components/types'
import { parseDatePt } from '../lib/fpbUtils'

const FPB_PROXY = '/api/fpb'

function parseDate(dateStr: string): string {
    return parseDatePt(dateStr) || ''
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
    const url = m?.[1]?.trim() || null
    // Filter out FPB default placeholder images
    if (url && /ass_highlight_default|noplayer/i.test(url)) return null
    return url
}

function extractTeamInfo(html: string): { nome: string; escalao: string } {
    const nm = html.match(/<div class="team-nome">\s*([^<]+)\s*<\/div>/)
    const lv = html.match(/<div class="team-level">\s*([^<]+)\s*<\/div>/)
    return {
        nome: nm?.[1]?.trim() || '',
        escalao: (lv?.[1]?.trim() || '').split('|')[0]?.trim() || '',
    }
}

export interface PlantelPlayer {
    nome: string
    foto: string | null
    atletaUrl: string | null
}

/** Extract an HTML section by tabindex anchor. 0 = info, 2 = calendar, 3 = results */
function extractSection(html: string, tabindex: number): string {
    const startTag = `<div class="team-wrapper" tabindex=${tabindex}>`
    const start = html.indexOf(startTag)
    if (start < 0) return ''
    const contentStart = start + startTag.length
    const nextIndex = html.indexOf('<div class="team-wrapper" tabindex=', contentStart)
    const end = nextIndex > 0 ? nextIndex : html.length
    return html.substring(contentStart, end)
}

function extractPlantel(html: string): PlantelPlayer[] {
    // Find plantel section (tabindex=1)
    const startTag = '<div class="team-wrapper" tabindex=1>'
    const start = html.indexOf(startTag)
    if (start < 0) return []
    const contentStart = start + startTag.length
    const nextIndex = html.indexOf('<div class="team-wrapper" tabindex=', contentStart)
    const section = html.substring(contentStart, nextIndex > 0 ? nextIndex : html.length)

    const players: PlantelPlayer[] = []
    const rowRe = /<div class="roster__player">\s*<a href="([^"]*)">([\s\S]*?)<\/a>\s*<\/div>/g
    let rm
    while ((rm = rowRe.exec(section)) !== null) {
        const href = rm[1]
        const block = rm[2]
        const nameMatch = block.match(/<h2[^>]*>([^<]+)<\/h2>/)
        if (!nameMatch) continue
        const nome = nameMatch[1].trim()

        // Photo from img in roster__player__photo
        const imgMatch = block.match(/<img[^>]*data-src="([^"]+)"[^>]*>/)
            || block.match(/<img[^>]*src="([^"]+)"[^>]*>/)
        let foto = imgMatch?.[1] || null
        // Filter placeholder images
        if (foto && (/noplayer/i.test(foto) || /ass_highlight/i.test(foto))) foto = null

        const atletaUrl = href ? `https://www.fpb.pt${href}` : null

        if (!players.find(p => p.nome === nome)) {
            players.push({ nome, foto, atletaUrl })
        }
    }
    return players
}

const EQUIPA_CACHE_TTL = 15 * 60_000 // 15 min
const EQUIPA_CACHE_KEY = (id: string) => `equipa_cache_${id}`

interface EquipaCache {
    games: Match[]
    photo: string | null
    teamInfo: { nome: string; escalao: string }
    plantel: PlantelPlayer[]
}

function loadEquipaCache(id: string): EquipaCache | null {
    try {
        const raw = localStorage.getItem(EQUIPA_CACHE_KEY(id))
        if (!raw) return null
        const { data, ts } = JSON.parse(raw)
        if (ts && Date.now() - ts < EQUIPA_CACHE_TTL) return data as EquipaCache
    } catch { /* ignore */ }
    return null
}

function saveEquipaCache(id: string, data: EquipaCache) {
    try {
        localStorage.setItem(EQUIPA_CACHE_KEY(id), JSON.stringify({ data, ts: Date.now() }))
    } catch { /* ignore */ }
}

export function useEquipaGames(equipaId: string) {
    const cached = equipaId ? loadEquipaCache(equipaId) : null
    const [games, setGames] = useState<Match[]>(cached?.games || [])
    const [photo, setPhoto] = useState<string | null>(cached?.photo || null)
    const [teamInfo, setTeamInfo] = useState<{ nome: string; escalao: string }>(cached?.teamInfo || { nome: '', escalao: '' })
    const [plantel, setPlantel] = useState<PlantelPlayer[]>(cached?.plantel || [])
    const [loading, setLoading] = useState(!cached && !!equipaId)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!equipaId) { setLoading(false); return }
        // If cache loaded, skip fetch
        if (cached) { setLoading(false); return }

        let cancelled = false
        async function load() {
            try {
                const r = await fetch(`${FPB_PROXY}?page=equipa&equipa_id=${equipaId}`)
                if (!r.ok || cancelled) { setLoading(false); return }
                const html = await r.text()
                const p = extractTeamPhoto(html)
                const ti = extractTeamInfo(html)
                const pl = extractPlantel(html)

                const calendarGames = parseGames(extractSection(html, 2), true)
                const resultsGames = parseGames(extractSection(html, 3), false)

                const map = new Map<string, Match>()
                for (const g of [...calendarGames, ...resultsGames]) {
                    if (!map.has(g.id)) map.set(g.id, g)
                }
                const merged = Array.from(map.values())

                saveEquipaCache(equipaId, { games: merged, photo: p, teamInfo: ti, plantel: pl })

                if (!cancelled) {
                    setPhoto(p)
                    setTeamInfo(ti)
                    setPlantel(pl)
                    setGames(merged)
                    setLoading(false)
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'Erro ao carregar dados da equipa')
                    setLoading(false)
                }
            }
        }
        load()
        return () => { cancelled = true }
    }, [equipaId])

    return { games, photo, teamInfo, plantel, loading, error }
}
