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
export function semiAbrev(fullName: string): string {
    const rules: [RegExp, string][] = [
        [/^Futebol\s+Clube\s+(do|da|de)\s+/i, 'FC '],
        [/^Sporting\s+Clube\s+(de\s+)?/i, 'SC '],
        [/^Vitória\s+Sport\s+Clube/i, 'Vitória SC'],
        [/^União\s+Desportiva\s+/i, 'UD '],
        [/^Clube\s+Desportivo\s+/i, 'CD '],
        [/^Grupo\s+Desportivo\s+/i, 'GD '],
        [/^Associação\s+Académica\s+de\s+/i, 'AA '],
        [/^Sport\s+Lisboa\s+e\s+Benfica/i, 'SL Benfica'],
    ]
    for (const [regex, replacement] of rules) {
        if (regex.test(fullName)) return fullName.replace(regex, replacement).trim()
    }
    return fullName
}

/**
 * Map a team name from any source (FPB, Tugabasket) to the club's display name.
 * Uses the same matching logic as findClubSlug in Game.tsx —
 * exact match, substring both ways, and semi-abbreviated forms.
 *
 * @returns The club's short_name if matched, otherwise the original team name unchanged.
 */
export function normalizeTeamDisplay(teamName: string, clubs: { name: string; search_name?: string; short_name?: string | null; slug: string }[]): string {
    if (!teamName) return teamName
    const n = teamName.trim().replace(/\s+/g, ' ').toUpperCase()

    // 1. Exact match
    for (const c of clubs) {
        const cn = c.name.toUpperCase()
        const sn = (c.search_name || '').toUpperCase()
        const sa = semiAbrev(c.name).toUpperCase()
        if (n === cn || n === sn || n === sa) return c.short_name || c.name
    }

    // 2. Word-level: first word matches AND team name is in club's short_name or vice versa
    const teamWords = n.split(/\s+/).filter(w => w.length > 1)
    if (teamWords.length >= 1) {
        const firstWord = teamWords[0]
        for (const c of clubs) {
            const cn = c.name.toUpperCase()
            const sn = (c.search_name || '').toUpperCase()
            const sa = semiAbrev(c.name).toUpperCase()
            const short = (c.short_name || '').toUpperCase()
            const clubWords = cn.split(/\s+/)
            const allClubWords = new Set([...clubWords, sa.split(/\s+/), sn.split(/\s+/)])
            // First word matches AND team name is shorter (abbreviation)
            if (allClubWords.has(firstWord) && n.length < cn.length)
                return c.short_name || c.name
            // Team name IS the short_name
            if (n === short)
                return c.short_name || c.name
        }
    }

    // 3. Substring both ways
    for (const c of clubs) {
        const cn = c.name.toUpperCase()
        const sn = (c.search_name || '').toUpperCase()
        const sa = semiAbrev(c.name).toUpperCase()
        if (cn.includes(n) || n.includes(cn) || sn.includes(n) || n.includes(sn) || sa.includes(n) || n.includes(sa))
            return c.short_name || c.name
    }

    // No match — return original
    return teamName
}

const SUPABASE_URL = 'https://qdzmwgahencinoucvoop.supabase.co'

/**
 * Build the Supabase bucket logo URL for a club slug.
 * Bucket "club-logos" contains {slug}.png for all 295 clubs.
 */
export function clubLogoUrl(club: { slug: string; logo_url?: string | null } | null | undefined): string | null {
    if (!club?.slug) return club?.logo_url ?? null
    return `${SUPABASE_URL}/storage/v1/object/public/club-logos/${club.slug}.png`
}
