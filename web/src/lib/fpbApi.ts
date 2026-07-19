import { Match } from '../components/types'
import { slugify } from './fpbUtils'

const BOUNCE_API = 'https://bounce.dribly.pt/api'
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
  const res = await fetchBounce(`/games?club=${clube}&season=${encodeURIComponent(epoca)}&category=${encodeURIComponent(category)}&gender=${encodeURIComponent(gender)}`)
  if (res && res.ok) {
    const games = await res.json()
    if (Array.isArray(games)) {
      return games
        .filter((g: any) => g.data && !isNaN(Date.parse(g.data)))
        .map((g: any) => mapBounceGame(g, epoca))
    }
  }
  return []
}
