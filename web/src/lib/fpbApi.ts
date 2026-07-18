import { Match } from '../components/types'
import { parseDatePt, slugify } from './fpbUtils'

const FPB_PROXY = '/api/fpb'
const BOUNCE_API = '/api/bounce'
const BOUNCE_API_KEY = 'b12ae2abfc2cbbbc040e0c5154bd048ebb74d7db51260770843c688b02a67eaf'

async function fetchBounce(path: string): Promise<Response | null> {
  try {
    const res = await fetch(`${BOUNCE_API}${path}`, {
      headers: { 'X-Bounce-Key': BOUNCE_API_KEY }
    })
    return res
  } catch {
    return null
  }
}

/** Fetch a single game detail from Bounce /api/game/{internalID} */
export async function fetchBounceGameDetail(internalID: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetchBounce(`/game/${encodeURIComponent(internalID)}`)
    if (res && res.ok) return await res.json()
  } catch { /* fallback */ }
  return null
}

// Map Bounce game JSON to Dribly Match format
function mapBounceGame(g: any, epoca: string): Match {
  const statusMap: Record<string, Match['status']> = {
    'FINALIZADO': 'FINALIZADO',
    'AGENDADO': 'AGENDADO',
    'A DECORRER': 'A DECORRER',
    'EM CURSO': 'A DECORRER',
    'AO VIVO': 'A DECORRER',
  }
  const equipa_casa = g.equipa_casa || ''
  const equipa_fora = g.equipa_fora || ''
  return {
    id: g.id || '',
    slug: `${g.data || ''}-${slugify(equipa_casa)}-${slugify(equipa_fora)}`,
    data: g.data || '',
    hora: g.hora || '',
    equipa_casa,
    equipa_fora,
    resultado_casa: g.resultado_casa ?? null,
    resultado_fora: g.resultado_fora ?? null,
    escalao: g.escalao || '',
    competicao: g.competicao || '',
    local: g.local || null,
    logotipo_casa: g.logo_casa || null,
    logotipo_fora: g.logo_fora || null,
    status: statusMap[g.estado] || 'AGENDADO',
    epoca: epoca || g.epoca || '',
  }
}

export async function fetchFPBGames(
  epoca: string,
  clube: number = 119,
  category = 'Senior',
  gender = 'masculino'
): Promise<Match[]> {
  // Try Bounce API first
  try {
    const res = await fetchBounce(`/games?club=${clube}&season=${encodeURIComponent(epoca)}&category=${encodeURIComponent(category)}&gender=${encodeURIComponent(gender)}`)
    if (res && res.ok) {
      const games = await res.json()
      if (Array.isArray(games)) {
        return games
          .filter((g: any) => g.data && !isNaN(Date.parse(g.data)))
          .map((g: any) => mapBounceGame(g, epoca))
      }
    }
    // Bounce returned non-ok or non-array — fall through to HTML scraping
  } catch { /* fallback to HTML scraping */ }

  // Fallback: HTML scraping via FPB proxy
  const [calHtml, resHtml] = await Promise.all([
    fetchPage('calendario', clube, epoca),
    fetchPage('resultados', clube, epoca)
  ])

  const calGames = parseGamesHTML(calHtml)
  const resGames = parseGamesHTML(resHtml)

  // Merge: results page games override calendar page games (only if scores exist)
  const merged = new Map<string, Match>()
  for (const g of calGames) merged.set(g.id, g)
  for (const g of resGames) {
    if (g.resultado_casa !== null && g.resultado_fora !== null) {
      merged.set(g.id, { ...merged.get(g.id), ...g })
    }
  }

  return Array.from(merged.values())
}

async function fetchPage(page: string, clube: number, epoca: string): Promise<string> {
  const params = new URLSearchParams()
  params.append('page', page)
  params.append('clube', String(clube))
  params.append('epoca', epoca)

  const res = await fetch(`${FPB_PROXY}?${params.toString()}`)
  if (!res || !res.ok) throw new Error(`FPB error: ${res ? res.status : 'network error'}`)
  return res.text()
}

function parseGamesHTML(html: string): Match[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const games: Match[] = []

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

      // Teams: first .team-container = home, second = away
      const teamContainers = link.querySelectorAll('.team-container')
      const homeTeamEl = teamContainers[0]
      const awayTeamEl = teamContainers[1]

      const homeName = (homeTeamEl?.querySelector('.fullName') || homeTeamEl?.querySelector('.sigla'))?.textContent?.trim() || ''
      const awayName = (awayTeamEl?.querySelector('.fullName') || awayTeamEl?.querySelector('.sigla'))?.textContent?.trim() || ''

      // Skip only if both teams are empty (completely unparseable)
      if (!homeName && !awayName) return

      // Generate fallback id for games without internalID (calendar page)
      const gameId = internalId || `cal-${isoDate}-${slugify(homeName)}-${slugify(awayName)}`
      if (!internalId && homeName === awayName && homeName) {
        // Self-match without internalID: skip — the resultados page will have the correct version
        return
      }

      // Logos
      const homeLogo = homeTeamEl?.querySelector('.image-container img')?.getAttribute('src') || null
      const awayLogo = awayTeamEl?.querySelector('.image-container img')?.getAttribute('src') || null

      // Competition
      const compEl = link.querySelector('.competition span')
      const compText = compEl?.textContent?.trim() || ''
      let escalao = ''
      let competicao = ''
      if (compText.includes('|')) {
        const parts = compText.split('|')
        escalao = parts[0]?.trim() || ''
        competicao = parts[1]?.trim() || ''
      } else {
        competicao = compText
      }

      // Location
      const locEl = link.querySelector('.location-wrapper b')
      const local = locEl?.textContent?.trim() || null

      // STATUS & SCORES
      let status: Match['status'] = 'AGENDADO'
      let resultado_casa: number | null = null
      let resultado_fora: number | null = null
      let hora = ''

      // Check for completed (results_wrapper)
      const resultsWrapper = link.querySelector('.results_wrapper')
      if (resultsWrapper) {
        const scoreEls = resultsWrapper.querySelectorAll('h3.results_text')
        if (scoreEls.length >= 2) {
          status = 'FINALIZADO'
          resultado_casa = parseInt(scoreEls[0].textContent?.trim() || '0') || null
          resultado_fora = parseInt(scoreEls[1].textContent?.trim() || '0') || null
        }
      }

      // Fallback: time text might show score pattern "78-65"
      const hourEl = link.querySelector('.hour h3')
      const hourText = hourEl?.textContent?.trim() || ''
      if (status === 'AGENDADO' && hourText.includes('-') && !hourText.includes('H')) {
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

      // Time
      if (status === 'AGENDADO') {
        hora = (hourText || '').replace('H', ':').replace(/\s+/g, '')
      }

      const slug = `${isoDate}-${slugify(homeName)}-${slugify(awayName)}`

      games.push({
        id: gameId,
        slug,
        data: isoDate,
        hora,
        equipa_casa: homeName.trim(),
        equipa_fora: awayName.trim(),
        resultado_casa,
        resultado_fora,
        escalao: escalao.trim(),
        competicao: competicao.trim(),
        local,
        logotipo_casa: homeLogo,
        logotipo_fora: awayLogo,
        status,
        epoca: ''
      })
    })
  })

  return games
}
