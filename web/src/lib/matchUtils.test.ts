import { describe, it, expect } from 'vitest'
import { normalizeName, matchName, isClubWin } from './matchUtils'

describe('normalizeName', () => {
    it('should remove diacritics and convert to uppercase', () => {
        expect(normalizeName('São João')).toBe('SAO JOAO')
        expect(normalizeName('G.D. Estoril Praia')).toBe('G.D. ESTORIL PRAIA')
    })
})

describe('matchName', () => {
    it('should match exact names', () => {
        expect(matchName('FC Porto', 'FC Porto')).toBe(true)
    })

    it('should match names with diacritics differences', () => {
        expect(matchName('São João', 'SAO JOAO')).toBe(true)
    })

    it('should match partial names', () => {
        expect(matchName('FC Gaia', 'Futebol Clube de Gaia')).toBe(true)
    })

    it('should match using word-level fallback for abbreviations', () => {
        // "Benfica" vs "SL Benfica" -> "BENFICA" vs "SL BENFICA"
        // shorter: ["BENFICA"], longer: ["SL", "BENFICA"]
        // matching: ["BENFICA"] -> length 1 >= ceil(1 * 0.5) = 1 -> true
        expect(matchName('Benfica', 'SL Benfica')).toBe(true)
    })

    it('should not match completely different names', () => {
        expect(matchName('Sporting CP', 'FC Porto')).toBe(false)
    })
})

describe('isClubWin', () => {
    it('should return null if scores are missing', () => {
        expect(isClubWin({ resultado_casa: null, resultado_fora: 2, equipa_casa: 'A', equipa_fora: 'B' }, 'A')).toBe(null)
    })

    it('should return "draw" if scores are equal', () => {
        expect(isClubWin({ resultado_casa: 1, resultado_fora: 1, equipa_casa: 'A', equipa_fora: 'B' }, 'A')).toBe('draw')
    })

    it('should return true if home team wins and matches club name', () => {
        expect(isClubWin({ resultado_casa: 3, resultado_fora: 1, equipa_casa: 'FC Porto', equipa_fora: 'Benfica' }, 'FC Porto')).toBe(true)
    })

    it('should return false if home team loses and matches club name', () => {
        expect(isClubWin({ resultado_casa: 0, resultado_fora: 2, equipa_casa: 'FC Porto', equipa_fora: 'Benfica' }, 'FC Porto')).toBe(false)
    })

    it('should return true if away team wins and matches club name', () => {
        expect(isClubWin({ resultado_casa: 1, resultado_fora: 3, equipa_casa: 'Benfica', equipa_fora: 'FC Porto' }, 'FC Porto')).toBe(true)
    })
})