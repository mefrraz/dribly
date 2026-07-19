import { Match } from '../components/types'
import { slugify } from './fpbUtils'

const BOUNCE_API = 'https://bounce.dribly.pt/api'

// Parse FPB date format "14 jun 2026" → "2026-06-14"
function parseBounceDate(raw: string): string {
  if (!raw) return ''
  // Already ISO?
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const months: Record<string, string> = {
    jan: '01', fev: '02', mar: '03', abr: '04', mai: '05', jun: '06',
    jul: '07', ago: '08', set: '09', out: '10', nov: '11', dez: '12',
  }
  const parts = raw.trim().split(' ')
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0')
    const month = months[(parts[1] || '').toLowerCase()]
    const year = parts[2]
    if (month && year) return `${year}-${month}-${day}`
  }
  return '' // invalid format
}

async function fetchBounce(path: string): Promise<Response | null> {
  try {
    const res = await fetch(`${BOUNCE_API}${path}`)
    // Rate limit bypassed by Origin header → Bounce BOUNCE_TRUSTED_ORIGINS
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
  const isoDate = parseBounceDate(g.data || '')
  return {
    id: g.id || '',
    slug: `${isoDate}-${slugify(equipa_casa)}-${slugify(equipa_fora)}`,
    data: isoDate,
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
        .filter((g: any) => g.data && parseBounceDate(g.data))
        .map((g: any) => mapBounceGame(g, epoca))
    }
  }
  return []
}
