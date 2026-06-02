/** Normalize a name for comparison: remove diacritics, uppercase, trim */
export function normalizeName(s: string): string {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim()
}

/** Check if a team name matches a club name, using word-level fallback */
export function matchName(teamName: string, clubName: string): boolean {
    const t = normalizeName(teamName)
    const c = normalizeName(clubName)
    if (t.includes(c) || c.includes(t)) return true
    
    // Word-level: filter short words, compare meaningful tokens
    const tWords = t.split(/\s+/).filter(w => w.length > 2)
    const cWords = c.split(/\s+/).filter(w => w.length > 2)
    if (tWords.length === 0 || cWords.length === 0) return false
    
    const [shorter, longer] = tWords.length <= cWords.length ? [tWords, cWords] : [cWords, tWords]
    const matching = shorter.filter(w => longer.some(lw => lw.includes(w) || w.includes(lw)))
    return matching.length >= Math.ceil(shorter.length * 0.5)
}

export type MatchResult = {
    resultado_casa: number | null
    resultado_fora: number | null
    equipa_casa: string
    equipa_fora: string
}

/** Determine if the target club won, lost, or drew */
export function isClubWin(match: MatchResult, clubName: string): boolean | 'draw' | null {
    if (match.resultado_casa === null || match.resultado_fora === null) return null
    if (match.resultado_casa === match.resultado_fora) return 'draw'
    
    if (matchName(match.equipa_casa, clubName)) {
        return match.resultado_casa > match.resultado_fora
    }
    if (matchName(match.equipa_fora, clubName)) {
        return match.resultado_fora > match.resultado_casa
    }
    return null
}