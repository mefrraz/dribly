/** Shared FPB parsing utilities — used by multiple API files and hooks. */

/** Portuguese month abbreviations → number (1-12) */
export const MONTHS_PT: Record<string, number> = {
  'JAN': 1, 'FEV': 2, 'MAR': 3, 'ABR': 4, 'MAI': 5, 'JUN': 6,
  'JUL': 7, 'AGO': 8, 'SET': 9, 'OUT': 10, 'NOV': 11, 'DEZ': 12,
}

/**
 * Parse a Portuguese date string like "15 ABR 2026" → "2026-04-15".
 * Returns null if the string can't be parsed.
 */
export function parseDatePt(dateStr: string): string | null {
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

/**
 * Slugify a string for use in URLs.
 * "FC Porto" → "fc-porto"
 */
export function slugify(s: string): string {
  return s.toLowerCase().trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Semi-abbreviate long Portuguese club names.
 * "Futebol Clube do Porto" → "FC Porto"
 */
/**
 * Map of FPB short names → canonical club names.
 * FPB often returns abbreviations like "Sporting CP" while the club
 * is stored as "Sporting Clube de Portugal". This map normalizes both ways.
 */
const FPB_NAME_MAP: Record<string, string> = {
    'sporting cp': 'SC Portugal',
    'fc porto': 'FC Porto',
    'sl benfica': 'SL Benfica',
    'ud oliveirense': 'UD Oliveirense',
    'sc braga': 'SC Braga',
    'cd povoa': 'CD Póvoa',
    'gdessa barreiro': 'GDESSA Barreiro',
}

/**
 * Normalize a team name from any source (FPB, Tugabasket, club DB)
 * to its canonical display form.
 */
export function normalizeTeamName(name: string): string {
    const key = name.trim().toLowerCase()
    // Check exact FPB short name map
    if (FPB_NAME_MAP[key]) return FPB_NAME_MAP[key]
    // Check if semiAbrev transforms it
    const abrev = semiAbrev(name)
    if (abrev !== name) return abrev
    // Check reverse: is this already an abbreviation of a known club?
    for (const [short, full] of Object.entries(FPB_NAME_MAP)) {
        if (abrev.toLowerCase() === full.toLowerCase()) return full
    }
    return abrev
}

export function semiAbrev(fullName: string): string {
    const rules: [RegExp, string][] = [
        [/^Futebol\s+Clube\s+(do|da|de)\s+/i, 'FC '],
        [/^Sporting\s+Clube\s+(de\s+)?/i, 'SC '],
        [/^Sporting\s+CP$/i, 'SC Portugal'],
        [/^Vitória\s+Sport\s+Clube/i, 'Vitória SC'],
        [/^União\s+Desportiva\s+/i, 'UD '],
        [/^Clube\s+Desportivo\s+/i, 'CD '],
        [/^Grupo\s+Desportivo\s+/i, 'GD '],
        [/^Associação\s+Académica\s+de\s+/i, 'AA '],
        [/^Sport\s+Lisboa\s+e\s+Benfica/i, 'SL Benfica'],
        [/^SL\s+Benfica$/i, 'SL Benfica'],
        [/^FC\s+Porto$/i, 'FC Porto'],
        [/^SC\s+Braga$/i, 'SC Braga'],
    ]
    for (const [regex, replacement] of rules) {
        if (regex.test(fullName)) return fullName.replace(regex, replacement).trim()
    }
    return fullName
}
