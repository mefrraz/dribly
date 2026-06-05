import { type Match } from '../components/types'
import { z } from 'zod'

const FPB_PROXY = '/api/fpb'

// Zod schema for FPB AJAX responses to prevent crashes on malformed data
const FpbAjaxResponseSchema = z.object({
    result: z.object({
        body: z.string()
    }).optional()
}).catch({})

export interface FPBStandingTeam {
    posicao: number
    equipa: string
    equipa_id?: string
    clube_id?: number
    j: number
    v: number
    d: number
    pm?: number
    ps?: number
    dif?: number
    pts: number
    logo?: string
    // Game-type (phase-game) fields
    data?: string
    casa?: string
    fora?: string
    score_casa?: number
    score_fora?: number
    logo_casa?: string
    logo_fora?: string
}

export interface FPBGame {
    jogo_id?: string
    jornada?: number | string
    data: string
    hora?: string
    equipa_casa: string
    equipa_casa_id?: string
    equipa_fora: string
    equipa_fora_id?: string
    resultado_casa?: number
    resultado_fora?: number
    pavilhao?: string
    estado?: string
    logo_casa?: string
    logo_fora?: string
}

export interface FPBTeam {
    equipa_id?: string
    clube_id?: number
    nome: string
    abreviatura?: string
    logo?: string
    photo?: string
    associacao?: string
}

export interface FPBPlayerStat {
    atleta_id: number
    nome: string
    clube_nome: string
    j: number
    pts: number
    reb?: number
    ast?: number
    blk?: number
    stl?: number
    val: number
    min?: number
}

const MONTHS_PT: Record<string, number> = {
  'JAN': 1, 'FEV': 2, 'MAR': 3, 'ABR': 4, 'MAI': 5, 'JUN': 6,
  'JUL': 7, 'AGO': 8, 'SET': 9, 'OUT': 10, 'NOV': 11, 'DEZ': 12,
}

function parseDatePt(dateStr: string): string | null {
  if (!dateStr) return null
  const cleaned = dateStr.replace(/,/g, '').trim().toUpperCase()
  const parts = cleaned.split(/\s+/)
  if (parts.length < 3) return null
  const day = parseInt(parts[0])
  if (isNaN(day)) return null
  const month = MONTHS_PT[parts[1]] || null
  if (!month) return null
  const year = parseInt(parts[2])
  if (isNaN(year)) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function slugify(s: string): string {
  return s.toLowerCase().trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// ---- API proxy helpers ----

async function fetchFromProxy(path: string): Promise<any> {
    const res = await fetch(`${FPB_PROXY}?endpoint=${encodeURIComponent(path)}`)
    if (!res.ok) throw new Error(`FPB API error: ${res.status}`)
    return res.json()
}

async function fetchHtml(page: string, competicao: number): Promise<string> {
    const params = new URLSearchParams()
    params.append('page', page)
    params.append('competicao', String(competicao))
    params.append('_t', String(Date.now()))
    const res = await fetch(`${FPB_PROXY}?${params.toString()}`)
    if (!res.ok) throw new Error(`FPB error: ${res.status}`)
    return res.text()
}

// ---- Standings: API first, HTML fallback ----

export interface FPBStandingPhase {
    name: string
    teams: FPBStandingTeam[]
    type: 'table' | 'games'
}

export async function fetchStandings(provaId: number): Promise<FPBStandingPhase[]> {
    // Step 1: Fetch HTML and extract ALL fase IDs
    const faseIds: { id: string; name: string }[] = []
    try {
        const html = await fetchHtml('classificacao', provaId)
        const re = /<li[^>]*class="[^"]*option[^"]*"[^>]*tag="([^"]*)"[^>]*value="([^"]+)"/g
        let m: RegExpExecArray | null
        while ((m = re.exec(html)) !== null) {
            const name = m[1].trim()
            const id = m[2]
            if (!faseIds.find(f => f.id === id)) {
                faseIds.push({ id, name })
            }
        }
    } catch { /* use fallback */ }

    if (faseIds.length === 0) {
        faseIds.push({ id: '30969', name: 'Fase Regular' })
    }

    // Step 2: Fetch all phases in parallel
    const results = await Promise.all(faseIds.map(async (fase) => {
        const params = new URLSearchParams({
            wp_action: 'get_more_fase_regular',
            competicao: String(provaId),
            fase: fase.id,
        })
        try {
            const res = await fetch(`${FPB_PROXY}?${params.toString()}`)
            if (!res.ok) return { name: fase.name, teams: [], type: 'table' as const }
            const json = await res.json()
            
            // Validate JSON structure with Zod
            const parsed = FpbAjaxResponseSchema.safeParse(json)
            const body: string = parsed.success && parsed.data.result?.body ? parsed.data.result.body : ''
            
            if (!body) return { name: fase.name, teams: [], type: 'table' as const }
            const teams = scrapeStandings(body)
            const type = body.includes('phase-game') ? 'games' as const : 'table' as const
            return { name: fase.name, teams, type }
        } catch {
            return { name: fase.name, teams: [], type: 'table' as const }
        }
    }))

    return results // keep all phases, even empty ones (playoffs/finals)
}

function parsePhaseGames(html: string): FPBStandingTeam[] {
    const standings: FPBStandingTeam[] = []
    const re = /<div[^>]*class="[^"]*phase-game[^"]*"[^>]*>([\s\S]*?)<div[^>]*class="[^"]*clear[^"]*"[^>]*><\/div>\s*<\/div>/g
    let m: RegExpExecArray | null
    while ((m = re.exec(html)) !== null) {
        const block = m[1]
        // Date
        const dateMatch = block.match(/<div[^>]*class="[^"]*date[^"]*"[^>]*>([^<]*)<\/div>/)
        const date = (dateMatch?.[1] || '').trim()

        // Teams and scores
        const siglas = [...block.matchAll(/<div class="sigla">([^<]*)<\/div>/g)].map(m => m[1].trim())
        const scores = [...block.matchAll(/<div class="score">(\d+)<\/div>/g)].map(m => parseInt(m[1]))
        const logos = [...block.matchAll(/<div class="logo"><img[^>]*src="([^"]*)"[^>]*><\/div>/g)].map(m => m[1])

        const homeName = siglas[0] || ''
        const awayName = siglas[1] || ''

        const entry: FPBStandingTeam = {
            posicao: standings.length + 1,
            equipa: `${homeName} ${scores[0] ?? '?'} - ${scores[1] ?? '?'} ${awayName}`,
            j: 1, v: 0, d: 0, pts: 0,
            data: date,
            casa: homeName,
            fora: awayName,
            score_casa: scores[0],
            score_fora: scores[1],
            logo_casa: logos[0],
            logo_fora: logos[1],
        }
        if (date) entry.equipa = `${date} · ` + entry.equipa
        standings.push(entry)
    }
    return standings
}

function scrapeStandings(html: string): FPBStandingTeam[] {
    // Try phase-game format first (elimination phases with games)
    const phaseGames = html.match(/<div[^>]*class="[^"]*phase-game[^"]*"[^>]*>/g)
    if (phaseGames && phaseGames.length > 0) {
        return parsePhaseGames(html)
    }

    // WordPress AJAX response has team-row divs with h5 elements
    const standings: FPBStandingTeam[] = []

    // Split by team-row — each is one team
    const rows = html.split(/<div[^>]*class="[^"]*team-row[^"]*"[^>]*>/)
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i]

        // Extract team name: first <h5> without <b>/<strong> (skip position h5)
        const nameMatch = row.match(/<h5[^>]*>([^<]+)<\/h5>/)
        if (!nameMatch) continue
        const nome = nameMatch[1].trim()
        if (!nome || nome.length < 3) continue

        // Extract logo from .logo img
        const logoMatch = row.match(/<div class="logo[^"]*"[^>]*><img[^>]*src="([^"]*)"[^>]*><\/div>/)
        const logo = logoMatch?.[1]

        // Collect all h5 values (with optional attributes, <b>/<strong>)
        const h5s: string[] = []
        const h5Regex = /<h5[^>]*>(?:\s*<(?:b|strong)>)?([^<]*?)(?:<\/(?:b|strong)>)?\s*<\/h5>/g
        let m: RegExpExecArray | null
        while ((m = h5Regex.exec(row)) !== null) {
            h5s.push(m[1].trim())
        }

        if (h5s.length < 4) continue

        // Position is first h5 (inside <b>), name is second, abbreviation is third
        // Stats follow: J, V, D, FC, PM, PS, DIF, PTS
        const stats = h5s.slice(3) // skip pos, name, abrev

        standings.push({
            posicao: standings.length + 1,
            equipa: nome,
            logo,
            j: num(stats[0]),
            v: num(stats[1]),
            d: num(stats[2]),
            pm: num(stats[4]),
            ps: num(stats[5]),
            dif: signedNum(stats[6]),
            pts: num(stats[7]),
        })
    }

    return standings
}

function num(s: string | undefined): number {
    return parseInt(s || '0') || 0
}

function signedNum(s: string | undefined): number | undefined {
    if (!s) return undefined
    const v = parseInt(s)
    return isNaN(v) ? undefined : v
}

// ---- Schedule & Results via HTML scraping ----

export async function fetchSchedule(provaId: number): Promise<FPBGame[]> {
    const html = await fetchHtml('calendario', provaId)
    return scrapeGames(html, 'AGENDADO')
}

export async function fetchResults(provaId: number): Promise<FPBGame[]> {
    const html = await fetchHtml('resultados', provaId)
    return scrapeGames(html, 'FINALIZADO')
}

function scrapeGames(html: string, defaultStatus: Match['status']): FPBGame[] {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const games: FPBGame[] = []

    // Try .day-wrapper (same as club pages)
    const dayWrappers = doc.querySelectorAll('.day-wrapper')
    dayWrappers.forEach(dayWrapper => {
        const dateEl = dayWrapper.querySelector('h3.date')
        const dateStr = dateEl?.textContent?.trim() || ''
        const isoDate = parseDatePt(dateStr)
        if (!isoDate) return

        const gameLinks = dayWrapper.querySelectorAll('a.game-wrapper-a')
        gameLinks.forEach((link: Element) => {
            const href = link.getAttribute('href') || ''
            const internalId = href.match(/internalID=(\d+)/)?.[1] || ''

            const teamContainers = link.querySelectorAll('.team-container')
            const homeName = (teamContainers[0]?.querySelector('.fullName') || teamContainers[0]?.querySelector('.sigla'))?.textContent?.trim() || ''
            const awayName = (teamContainers[1]?.querySelector('.fullName') || teamContainers[1]?.querySelector('.sigla'))?.textContent?.trim() || ''
            const logo_casa = teamContainers[0]?.querySelector('.image-container img')?.getAttribute('src') || undefined
            const logo_fora = teamContainers[1]?.querySelector('.image-container img')?.getAttribute('src') || undefined

            let resultado_casa: number | null = null
            let resultado_fora: number | null = null
            let status: FPBGame['estado'] = defaultStatus

            // Results
            const resultsWrapper = link.querySelector('.results_wrapper')
            if (resultsWrapper) {
                const scoreEls = resultsWrapper.querySelectorAll('h3.results_text')
                if (scoreEls.length >= 2) {
                    status = 'FINALIZADO'
                    resultado_casa = parseInt(scoreEls[0].textContent?.trim() || '0') || null
                    resultado_fora = parseInt(scoreEls[1].textContent?.trim() || '0') || null
                }
            }

            // Fallback: hour text might show score pattern
            const hourEl = link.querySelector('.hour h3')
            const hourText = hourEl?.textContent?.trim() || ''
            let hora = ''
            if (defaultStatus === 'AGENDADO' && hourText.includes('-') && !hourText.includes('H')) {
                const parts = hourText.split('-')
                if (parts.length === 2) {
                    const s1 = parseInt(parts[0].trim())
                    const s2 = parseInt(parts[1].trim())
                    if (!isNaN(s1) && !isNaN(s2)) {
                        status = 'FINALIZADO'
                        resultado_casa = s1
                        resultado_fora = s2
                    }
                }
            }
            if (defaultStatus === 'AGENDADO' && status === 'AGENDADO') {
                hora = (hourText || '').replace('H', ':').replace(/\s+/g, '')
            }

            // Fix: if default was FINALIZADO but no scores found and has hour → it's scheduled
            if (status === 'FINALIZADO' && !resultado_casa && !resultado_fora && hora) {
                status = 'AGENDADO'
            }

            // Competition name
            // (Not needed for competition pages — all games belong to same competition)

            // Location
            const locEl = link.querySelector('.location-wrapper b')
            const pavilhao = locEl?.textContent?.trim() || undefined

            const jogo_id = internalId || `${isoDate}-${slugify(homeName)}-${slugify(awayName)}`

            games.push({
                jogo_id,
                data: isoDate,
                hora: hora || undefined,
                equipa_casa: homeName.trim(),
                equipa_fora: awayName.trim(),
                resultado_casa: resultado_casa ?? undefined,
                resultado_fora: resultado_fora ?? undefined,
                pavilhao,
                estado: status,
                logo_casa,
                logo_fora,
            })
        })
    })

    // If no .day-wrapper found, try alternative: table rows
    if (games.length === 0) {
        const tables = doc.querySelectorAll('table')
        tables.forEach(table => {
            const rows = table.querySelectorAll('tbody tr')
            rows.forEach(row => {
                const cols = row.querySelectorAll('td')
                if (cols.length < 4) return

                const data = cols[0]?.textContent?.trim() || ''
                const hora = cols[1]?.textContent?.trim() || ''
                const equipa_casa = cols[2]?.textContent?.trim() || ''
                const resultado = cols[3]?.textContent?.trim() || ''
                const equipa_fora = cols[4]?.textContent?.trim() || ''

                if (!equipa_casa || !equipa_fora) return

                const isoDate = parseDatePt(data) || data

                let resultado_casa: number | undefined
                let resultado_fora: number | undefined
                let status: FPBGame['estado'] = defaultStatus

                if (resultado.includes('-') || resultado.includes('–')) {
                    const sep = resultado.includes('-') ? '-' : '–'
                    const parts = resultado.split(sep)
                    const s1 = parseInt(parts[0]?.trim())
                    const s2 = parseInt(parts[1]?.trim())
                    if (!isNaN(s1) && !isNaN(s2)) {
                        status = 'FINALIZADO'
                        resultado_casa = s1
                        resultado_fora = s2
                    }
                }

                games.push({
                    jogo_id: `${isoDate}-${slugify(equipa_casa)}-${slugify(equipa_fora)}`,
                    data: isoDate,
                    hora: hora || undefined,
                    equipa_casa,
                    equipa_fora,
                    resultado_casa,
                    resultado_fora,
                    estado: status,
                })
            })
        })
    }

    return games
}

// ---- Teams: API first, HTML fallback ----

export async function fetchTeams(provaId: number): Promise<FPBTeam[]> {
    // WordPress AJAX: admin-ajax.php?action=get_equipas&idCompeticao=10902
    const res = await fetch(`${FPB_PROXY}?wp_action=get_equipas&idCompeticao=${provaId}&_t=${Date.now()}`)
    if (res.ok) {
        const html = await res.text()
        if (html) {
            const parser = new DOMParser()
            const doc = parser.parseFromString(html, 'text/html')
            const teams: FPBTeam[] = []

            // Strategy 1: find team cards by anchoring on <h5> team names
            // Walk up DOM to find the card container, then extract logo + photo from it
            const h5s = doc.querySelectorAll('h5')
            const seen = new Set<string>()
            h5s.forEach(h5 => {
                const nome = h5.textContent?.trim() || ''
                if (!nome || nome.length < 3 || seen.has(nome)) return
                seen.add(nome)

                // Walk up to find the card container (up to 5 levels)
                let card: Element | null = h5
                for (let i = 0; i < 5; i++) {
                    card = card?.parentElement || null
                    if (!card) break
                    // Check if this container has images
                    const imgs = card.querySelectorAll('img')
                    if (imgs.length >= 1) break
                }
                const container = card || h5

                // Extract equipa ID from any link
                const equipaId = container.querySelector('a')?.href?.match(/equipa_(\d+)/)?.[1]

                // Extract logo: img with LOGO/logotipo in src, or first img if only one
                const allImgs = container.querySelectorAll('img')
                let logo: string | undefined
                let photo: string | undefined
                for (const img of allImgs) {
                    const src = img.getAttribute('src') || ''
                    if (/LOGO|logotipo/i.test(src)) {
                        logo = src
                    } else if (/equipas|EQU_/i.test(src)) {
                        photo = src
                    }
                }
                // Also check background-image for photo
                if (!photo) {
                    const bgEl = container.querySelector('[style*="background"]')
                    const style = bgEl?.getAttribute('style') || ''
                    const bgm = style.match(/url\(['"]?([^'")]*equipas[^'")]*)['"]?\)/i)
                    if (bgm) photo = bgm[1]
                }

                teams.push({ nome, equipa_id: equipaId ? `equipa_${equipaId}` : undefined, logo, photo })
            })
            if (teams.length > 0) return teams

            // Strategy 2: regex fallback — extract names, logos, photos and pair by position
            const nameRe = /<h5[^>]*>([^<]+)<\/h5>/g
            const names: string[] = []
            let nm: RegExpExecArray | null
            while ((nm = nameRe.exec(html)) !== null) {
                const n = nm[1].trim()
                if (n.length > 2) names.push(n)
            }

            const logoRe = /<img[^>]*src="([^"]*(?:LOGO|logotipo)[^"]*)"[^>]*>/gi
            const logos: string[] = []
            let lm: RegExpExecArray | null
            while ((lm = logoRe.exec(html)) !== null) {
                logos.push(lm[1])
            }

            const photoRe = /<img[^>]*src="([^"]*(?:equipas|EQU_)[^"]*)"[^>]*>/gi
            const photos: string[] = []
            let pm: RegExpExecArray | null
            while ((pm = photoRe.exec(html)) !== null) {
                photos.push(pm[1])
            }

            const bgRe = /url\(['"]?([^'")]*equipas[^'")]*)['"]?\)/gi
            let bm: RegExpExecArray | null
            while ((bm = bgRe.exec(html)) !== null) {
                if (!photos.includes(bm[1])) photos.push(bm[1])
            }

            if (names.length > 0) {
                for (let i = 0; i < names.length; i++) {
                    teams.push({
                        nome: names[i],
                        logo: logos[i] || undefined,
                        photo: photos[i] || undefined,
                    })
                }
                if (teams.length > 0) return teams
            }

            // Strategy 3: FPB page HTML structure — .equipa blocks with img.logo + .equipa-name
            const equipaRe = /<div class="equipa">\s*<a href="([^"]*)">[\s\S]*?<img class="logo" src="([^"]*)"[^>]*>[\s\S]*?<div class="equipa-name">([^<]*)<\/div>/g
            let em: RegExpExecArray | null
            while ((em = equipaRe.exec(html)) !== null) {
                const href = em[1]
                const logoUrl = em[2]
                const nome = em[3].trim()
                const equipaId = href.match(/equipa_(\d+)/)?.[1]
                // Extract photo from equipa-head background-image
                const blockStart = em.index
                const blockEnd = html.indexOf('</div>', html.indexOf('equipa-name', blockStart) + 12) + 6
                const block = html.slice(blockStart, Math.min(blockEnd, blockStart + 2000))
                const bgMatch = block.match(/background-image:\s*url\(['"]?([^'")]*equipas[^'")]*)['"]?\)/i)
                const photo = bgMatch?.[1]
                teams.push({ nome, equipa_id: equipaId ? `equipa_${equipaId}` : undefined, logo: logoUrl, photo })
            }
            if (teams.length > 0) return teams
        }
    }

    // Fallback: extract unique team names from the classification standings
    // (needed for competitions where get_equipas AJAX returns empty, e.g. association-level comps)
    try {
        const phases = await fetchStandings(provaId)
        const seen = new Set<string>()
        const fallbackTeams: FPBTeam[] = []
        for (const phase of phases) {
            for (const t of phase.teams) {
                const name = t.equipa.trim()
                if (name && !seen.has(name)) {
                    seen.add(name)
                    fallbackTeams.push({
                        nome: name,
                        equipa_id: t.equipa_id,
                        clube_id: t.clube_id,
                        logo: t.logo,
                    })
                }
            }
        }
        return fallbackTeams
    } catch {
        return []
    }
}

// ---- Club team photos via FPB equipas page ----

interface ClubTeamPhoto {
    nome: string      // e.g., "Sénior Masculino"
    photo_url: string | null
    equipa_id: string | null
}

/**
 * Fetch team photos directly from the FPB club equipas page.
 * Much more reliable than going through competition pages.
 * URL: https://www.fpb.pt/equipas/clube_127/
 */
export async function fetchClubTeamPhotos(clubId: number): Promise<ClubTeamPhoto[]> {
    try {
        // Use Vercel proxy to avoid CORS
        const res = await fetch(`${FPB_PROXY}?page=equipas&clube=${clubId}`)
        if (!res.ok) return []
        const html = await res.text()
        return scrapeClubTeamPhotos(html)
    } catch {
        return []
    }
}

/** Parse .equipa blocks from FPB clube equipas HTML */
function scrapeClubTeamPhotos(html: string): ClubTeamPhoto[] {
    const results: ClubTeamPhoto[] = []

    // Pattern: <div class="equipa"> with .equipa-photo (background-image) and .equipa-name
    const blockRe = /<div class="equipa">([\s\S]*?)<div class="equipa-name">([^<]*)<\/div>[\s\S]*?<\/a>\s*<\/div>/g
    let m: RegExpExecArray | null
    while ((m = blockRe.exec(html)) !== null) {
        const block = m[1]
        const nameRaw = m[2].trim()
        if (!nameRaw) continue

        // Extract photo URL from background-image
        const bgMatch = block.match(/background-image:\s*url\(([^)]+)\)/)
        const photoUrl = bgMatch?.[1]?.replace(/['"]/g, '') || null

        // Extract equipa ID from link
        const linkMatch = block.match(/href="\/equipa\/(equipa_\d+)"/)
        const equipaId = linkMatch?.[1] || null

        // Normalize name: "Sénior                Masculino" → "Sénior Masculino"
        const nome = nameRaw.replace(/\s+/g, ' ').trim()

        // Skip default placeholder images
        const isDefault = photoUrl && /ass_highlight_default/i.test(photoUrl)

        results.push({
            nome,
            photo_url: isDefault ? null : photoUrl,
            equipa_id: equipaId,
        })
    }

    return results
}

// ---- Player stats via HTML scraping ----

export async function fetchPlayerStats(provaId: number, _tipo: string = 'val'): Promise<FPBPlayerStat[]> {
    const html = await fetchHtml('estatistica', provaId)
    return scrapePlayerStats(html)
}

function scrapePlayerStats(html: string): FPBPlayerStat[] {
    const allStats: Map<string, FPBPlayerStat & { photoUrl?: string }> = new Map()

    // Map category labels to stat keys
    const CAT_MAP: Record<string, (keyof FPBPlayerStat)[]> = {
        'Valorização': ['val'],
        'Pontos': ['pts'],
        'Lançamentos 2 pontos': [],
        'Lançamentos 3 pontos': [],
        'Lances Livres': [],
        'Ressaltos': ['reb'],
        'Ressaltos Ofensivos': [],
        'Ressaltos Defensivos': [],
        'Assistências': ['ast'],
        'Roubos de Bola': ['stl'],
        'Desarmes de Lançamentos': ['blk'],
    }

    // Find category sections
    const catRe = /<div class="row row-title semi-bold">\s*([^<]+)\s*<\/div>/g
    let cm: RegExpExecArray | null
    while ((cm = catRe.exec(html)) !== null) {
        const catName = cm[1].trim()
        const keys = CAT_MAP[catName]
        if (!keys || keys.length === 0) continue

        const sectionStart = cm.index
        const nextCat = /<div class="row row-title semi-bold">/g
        nextCat.lastIndex = sectionStart + 1
        const nextMatch = nextCat.exec(html)
        const sectionEnd = nextMatch ? nextMatch.index : sectionStart + 20000
        const section = html.slice(sectionStart, sectionEnd)

        // Parse player-name, team, score
        const playerRe = /<div class="player-name">\s*([^<]+)\s*<\/div>\s*<div class="team">\s*([^<]+)\s*<\/div>\s*<div class="score[^"]*">\s*([^<]+)\s*<\/div>/g
        let pb: RegExpExecArray | null
        while ((pb = playerRe.exec(section)) !== null) {
            const nome = pb[1].trim()
            const team = pb[2].trim()
            const score = parseFloat(pb[3].trim().replace(',', '.'))

            if (!nome || isNaN(score)) continue
            const key = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

            let existingEntry = allStats.get(key)
            if (!existingEntry) {
                for (const [, e] of allStats) {
                    if (nome.includes(e.nome) || e.nome.includes(nome)) {
                        existingEntry = e; break
                    }
                }
            }
            if (!existingEntry) {
                existingEntry = {
                    atleta_id: 300000 + allStats.size,
                    nome, clube_nome: team,
                    j: 0, pts: 0, reb: 0, ast: 0, blk: 0, stl: 0, val: 0,
                }
                allStats.set(key, existingEntry)
            }
            for (const k of keys) {
                (existingEntry as any)[k] = score
            }
            if (!existingEntry.clube_nome) existingEntry.clube_nome = team
        }
    }

    // Extract photo URLs from data-src
    const imgRe = /<img[^>]*data-src="([^"]*uploads\/utilizadores\/(\d+)_\d+\.(?:png|jpg))"[^>]*alt="([^"]*)"/g
    let im: RegExpExecArray | null
    while ((im = imgRe.exec(html)) !== null) {
        const photoUrl = im[1] // data-src already has full URL
        const altName = im[3].trim()
        const userId = parseInt(im[2])
        for (const [, player] of allStats) {
            if (altName.includes(player.nome) || player.nome.includes(altName)) {
                (player as any).photoUrl = photoUrl
                player.atleta_id = userId
                break
            }
        }
    }

    return Array.from(allStats.values())
}

export async function fetchMVP(provaId: number): Promise<FPBPlayerStat[]> {
    const data = await fetchFromProxy(`mvp/prova/${provaId}`)
    return data || []
}

// ---- Game Detail via HTML scraping ----

export interface FPBGameDetail {
    internalID: string
    data: string
    fase: string
    competicao: string
    equipa_casa: string
    equipa_fora: string
    abrev_casa: string
    abrev_fora: string
    resultado_casa: number
    resultado_fora: number
    status: string
    hora: string
    logo_casa: string | null
    logo_fora: string | null
    parciais: { periodo: string; casa: number; fora: number }[]
    pavilhao: string
    espetadores: number
    gameLeaders: { categoria: string; casa: { nome: string; valor: string; foto?: string }; fora: { nome: string; valor: string; foto?: string } }[]
    boxScoreCasa: FPBBoxScorePlayer[]
    boxScoreFora: FPBBoxScorePlayer[]
    teamStats: { label: string; casa: string; fora: string }[]
    topPerfCasa: { nome: string; foto: string }
    topPerfFora: { nome: string; foto: string }
    topPerfStats: { label: string; casa: string; fora: string }[]
}

export interface FPBBoxScorePlayer {
    numero: number
    nome: string
    foto?: string
    min: string
    pts: number
    l2: string
    l2pct: string
    l3: string
    l3pct: string
    ll: string
    llpct: string
    ro: number
    rd: number
    rt: number
    as: number
    rb: number
    to: number
    dl: number
    fc: number
    fs: number
    mais_menos: number
    val: number
}

export async function fetchGameDetail(internalID: string): Promise<FPBGameDetail | null> {
    const params = new URLSearchParams({ internalID })
    const res = await fetch(`${FPB_PROXY}?${params.toString()}`)
    if (!res.ok) return null
    const html = await res.text()
    return scrapeGameDetail(html, internalID)
}

function scrapeGameDetail(html: string, internalID: string): FPBGameDetail | null {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')

    // Title for competition name
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i)
    const title = titleMatch?.[1]?.trim() || ''
    const titleParts = title.split(/\s+vs\.?\s+/i)
    const competicao = (titleParts[1] || '').split('|')[1]?.trim() || ''

    // Phase: <p class="phase">
    const fase = doc.querySelector('.phase')?.textContent?.trim() || ''

    // Date: <p class="date"> — format "30 MAI 2026"
    const dateText = doc.querySelector('.date')?.textContent?.trim() || ''
    const MONTHS: Record<string, string> = { JAN: '01', FEV: '02', MAR: '03', ABR: '04', MAI: '05', JUN: '06', JUL: '07', AGO: '08', SET: '09', OUT: '10', NOV: '11', DEZ: '12' }
    let data = ''
    const dateMatch = dateText.match(/(\d{1,2})\s+(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\s+(\d{4})/i)
    if (dateMatch) {
        data = `${dateMatch[3]}-${MONTHS[dateMatch[2].toUpperCase()] || '01'}-${dateMatch[1].padStart(2, '0')}`
    }

    // Teams: .team.home .bigName and .team.away .bigName
    const equipa_casa = doc.querySelector('.team.home .bigName')?.textContent?.trim() || ''
    const equipa_fora = doc.querySelector('.team.away .bigName')?.textContent?.trim() || ''

    // Abbreviations: .team.home .smallName and .team.away .smallName
    const abrev_casa = doc.querySelector('.team.home .smallName')?.textContent?.trim() || ''
    const abrev_fora = doc.querySelector('.team.away .smallName')?.textContent?.trim() || ''

    // Logos: .team.home img and .team.away img
    const logo_casa = doc.querySelector('.team.home img')?.getAttribute('src') || null
    const logo_fora = doc.querySelector('.team.away img')?.getAttribute('src') || null

    // Check if game has scores or is scheduled (has .match-time)
    const matchTimeEl = doc.querySelector('.match-time')
    const hora = matchTimeEl?.textContent?.trim()?.replace(/\s*H\s*/, ':').replace(/\s+/g, '') || ''

    // Scores: .points span elements (e.g., <span>86</span><div class="dash"></div><span>76</span>)
    const pointsSpans = doc.querySelectorAll('.points span')
    let resultado_casa = 0
    let resultado_fora = 0
    let status = 'AGENDADO'
    if (pointsSpans.length >= 2) {
        const s1 = parseInt(pointsSpans[0].textContent?.trim() || '0') || 0
        const s2 = parseInt(pointsSpans[1].textContent?.trim() || '0') || 0
        // If both are 0, this might be a scheduled game with no scores yet
        if (s1 > 0 || s2 > 0) {
            resultado_casa = s1
            resultado_fora = s2
            status = 'FINALIZADO'
        }
    }
    if (status !== 'FINALIZADO' && hora) {
        status = 'AGENDADO'
    } else if (status !== 'FINALIZADO') {
        status = 'FINALIZADO' // fallback
    }

    // Quarters: .match-period .partial-score → "21 - 20" format
    const parciais: FPBGameDetail['parciais'] = []
    doc.querySelectorAll('.match-period').forEach(period => {
        const label = period.querySelector('p')?.textContent?.trim() || ''
        const partialMatch = period.querySelector('.partial-score')?.textContent?.match(/(\d+)\s*[-–]\s*(\d+)/)
        if (label && partialMatch) {
            parciais.push({ periodo: label, casa: parseInt(partialMatch[1]), fora: parseInt(partialMatch[2]) })
        }
    })

    // Pavilhao: .location a or .location
    const locEl = doc.querySelector('.location a') || doc.querySelector('.location')
    const pavilhao = locEl?.textContent?.trim() || ''

    // Espetadores: .attendance element (e.g., "1286 Espectadores")
    const attEl = doc.querySelector('.attendance')
    const attMatch = attEl?.textContent?.match(/(\d+)\s*Espectadores/i)
    const espetadores = attMatch ? parseInt(attMatch[1]) : 0

    // Game Leaders: .player-performance-head-to-head / .players-wrapper
    const gameLeaders: FPBGameDetail['gameLeaders'] = []
    doc.querySelectorAll('.performance-wrapper').forEach((wrapper, idx) => {
        const players = wrapper.querySelectorAll('.player')
        if (players.length >= 2) {
            const homePlayer = players[0]
            const awayPlayer = players[1]
            const divider = wrapper.querySelector('.divider')
            gameLeaders.push({
                categoria: ['PONTOS', 'RESSALTOS', 'ASSISTÊNCIAS', 'ROUBOS', 'DESARMES'][Math.min(idx, 4)] || '',
                casa: {
                    nome: homePlayer.querySelector('.name')?.textContent?.trim() || '',
                    foto: homePlayer.querySelector('img')?.getAttribute('src') || '',
                    valor: divider?.children[0]?.textContent?.trim() || '0',
                },
                fora: {
                    nome: awayPlayer.querySelector('.name')?.textContent?.trim() || '',
                    foto: awayPlayer.querySelector('img')?.getAttribute('src') || '',
                    valor: divider?.children[2]?.textContent?.trim() || '0',
                },
            } as any)
        }
    })

    // Box Score: .team-players-table-wrapper tables
    const boxScoreCasa: FPBBoxScorePlayer[] = []
    const boxScoreFora: FPBBoxScorePlayer[] = []
    doc.querySelectorAll('.team-players-table-wrapper').forEach((wrapper, teamIdx) => {
        const roster: FPBBoxScorePlayer[] = teamIdx === 0 ? boxScoreCasa : boxScoreFora
        const playerRows = wrapper.querySelectorAll('tr.player-row')
        playerRows.forEach(row => {
            const cols = row.querySelectorAll('td')
            if (cols.length < 3) return
            const nomeTd = cols[1]
            const fotoUrl = nomeTd?.querySelector('img')?.getAttribute('src') || undefined
            roster.push({
                numero: parseInt(cols[0]?.textContent?.trim() || '0') || 0,
                nome: nomeTd?.textContent?.trim() || '',
                foto: fotoUrl,
                min: cols[2]?.textContent?.trim() || '',
                pts: parseInt(cols[3]?.textContent?.trim() || '0') || 0,
                l2: cols[4]?.textContent?.trim() || '',
                l2pct: cols[5]?.textContent?.trim() || '',
                l3: cols[6]?.textContent?.trim() || '',
                l3pct: cols[7]?.textContent?.trim() || '',
                ll: cols[8]?.textContent?.trim() || '',
                llpct: cols[9]?.textContent?.trim() || '',
                ro: parseInt(cols[10]?.textContent?.trim() || '0') || 0,
                rd: parseInt(cols[11]?.textContent?.trim() || '0') || 0,
                rt: parseInt(cols[12]?.textContent?.trim() || '0') || 0,
                as: parseInt(cols[13]?.textContent?.trim() || '0') || 0,
                rb: parseInt(cols[14]?.textContent?.trim() || '0') || 0,
                to: parseInt(cols[15]?.textContent?.trim() || '0') || 0,
                dl: parseInt(cols[16]?.textContent?.trim() || '0') || 0,
                fc: parseInt(cols[17]?.textContent?.trim() || '0') || 0,
                fs: parseInt(cols[18]?.textContent?.trim() || '0') || 0,
                mais_menos: parseInt(cols[19]?.textContent?.trim() || '0') || 0,
                val: parseFloat(cols[20]?.textContent?.trim()?.replace(',', '.') || '0') || 0,
            })
        })
    })

    // Team Stats: .type-shooting + .type-rebound + .type-key-stats
    const teamStats: { label: string; casa: string; fora: string }[] = []
    // Shooting percentages
    doc.querySelectorAll('.type-shooting').forEach(el => {
        const label = el.querySelector('p')?.textContent?.trim() || ''
        const vals = el.querySelectorAll('.bar p')
        const casa = vals[0]?.textContent?.trim() || ''
        const fora = vals[1]?.textContent?.trim() || ''
        if (label && (casa || fora)) teamStats.push({ label, casa, fora })
    })
    // Rebounds
    doc.querySelectorAll('.type-rebound').forEach(el => {
        const label = el.querySelector('p')?.textContent?.trim() || ''
        const vals = el.querySelectorAll('.counter span')
        const casa = vals[0]?.textContent?.trim() || ''
        const fora = vals[1]?.textContent?.trim() || ''
        if (label && (casa || fora)) teamStats.push({ label, casa, fora })
    })
    // Key stats  
    doc.querySelectorAll('.type-key-stats:not(.big)').forEach(el => {
        const label = el.querySelector('p')?.textContent?.trim() || ''
        const vals = el.querySelectorAll('.one-line-graph.single p')
        const casa = vals[0]?.textContent?.trim() || ''
        const fora = vals[1]?.textContent?.trim() || ''
        if (label && (casa || fora)) teamStats.push({ label: label.replace(/Portugal/g, '').trim(), casa, fora })
    })

    // TOP Performers (best 2 players comparison)
    let topPerfCasa = { nome: '', foto: '' }
    let topPerfFora = { nome: '', foto: '' }
    const topPerfStats: { label: string; casa: string; fora: string }[] = []
    const topPerfWrapper = doc.querySelector('.players-wrapper')
    if (topPerfWrapper) {
        const players = topPerfWrapper.querySelectorAll('.player')
        if (players.length >= 2) {
            topPerfCasa = {
                nome: players[0].querySelector('.name')?.textContent?.trim() || '',
                foto: players[0].querySelector('img')?.getAttribute('src') || '',
            }
            topPerfFora = {
                nome: players[players.length - 1].querySelector('.name')?.textContent?.trim() || '',
                foto: players[players.length - 1].querySelector('img')?.getAttribute('src') || '',
            }
        }
    }
    doc.querySelectorAll('.topPerformers-stats .type-key-stats.big').forEach(el => {
        const label = el.querySelector('.double p')?.textContent?.trim() || ''
        const vals = el.querySelectorAll('.one-line-graph.single p')
        const casa = vals[0]?.textContent?.trim() || ''
        const fora = vals[1]?.textContent?.trim() || ''
        if (label && (casa || fora)) topPerfStats.push({ label, casa, fora })
    })

    return {
        internalID, data, fase, competicao, equipa_casa, equipa_fora, abrev_casa, abrev_fora, resultado_casa, resultado_fora,
        status, hora, logo_casa, logo_fora, parciais, pavilhao, espetadores,
        gameLeaders, boxScoreCasa, boxScoreFora, teamStats, topPerfCasa, topPerfFora, topPerfStats,
    }
}
