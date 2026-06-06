import { describe, it, expect } from 'vitest'
import { parseDatePt, slugify, semiAbrev, MONTHS_PT } from './fpbUtils'

describe('MONTHS_PT', () => {
    it('should map all 12 months', () => {
        expect(Object.keys(MONTHS_PT).length).toBe(12)
        expect(MONTHS_PT['JAN']).toBe(1)
        expect(MONTHS_PT['DEZ']).toBe(12)
    })
})

describe('parseDatePt', () => {
    it('should parse "15 ABR 2026" → "2026-04-15"', () => {
        expect(parseDatePt('15 ABR 2026')).toBe('2026-04-15')
    })

    it('should parse "1 JAN 2025" → "2025-01-01"', () => {
        expect(parseDatePt('1 JAN 2025')).toBe('2025-01-01')
    })

    it('should parse "31 DEZ 2024" → "2024-12-31"', () => {
        expect(parseDatePt('31 DEZ 2024')).toBe('2024-12-31')
    })

    it('should handle comma in date "15 ABR, 2026"', () => {
        expect(parseDatePt('15 ABR, 2026')).toBe('2026-04-15')
    })

    it('should handle lowercase', () => {
        expect(parseDatePt('15 abr 2026')).toBe('2026-04-15')
    })

    it('should return null for empty string', () => {
        expect(parseDatePt('')).toBeNull()
    })

    it('should return null for invalid date', () => {
        expect(parseDatePt('não é uma data')).toBeNull()
    })

    it('should return null for incomplete date', () => {
        expect(parseDatePt('15 ABR')).toBeNull()
    })
})

describe('slugify', () => {
    it('should slugify "FC Porto" → "fc-porto"', () => {
        expect(slugify('FC Porto')).toBe('fc-porto')
    })

    it('should slugify "SL Benfica" → "sl-benfica"', () => {
        expect(slugify('SL Benfica')).toBe('sl-benfica')
    })

    it('should handle special characters', () => {
        expect(slugify('G.D. Estoril Praia')).toBe('gd-estoril-praia')
    })

    it('should handle multiple spaces and dashes', () => {
        expect(slugify('  FC   Porto--Gaia  ')).toBe('fc-porto-gaia')
    })

    it('should strip accents from slug', () => {
        // regex [^\w\s-] removes ã, õ → "So Joo" → "so-joo"
        expect(slugify('São João')).toBe('so-joo')
    })
})

describe('semiAbrev', () => {
    it('should abbreviate "Futebol Clube do Porto" → "FC Porto"', () => {
        expect(semiAbrev('Futebol Clube do Porto')).toBe('FC Porto')
    })

    it('should abbreviate "Sporting Clube de Portugal" → "SC Portugal"', () => {
        expect(semiAbrev('Sporting Clube de Portugal')).toBe('SC Portugal')
    })

    it('should abbreviate "Sport Lisboa e Benfica" → "SL Benfica"', () => {
        expect(semiAbrev('Sport Lisboa e Benfica')).toBe('SL Benfica')
    })

    it('should abbreviate "União Desportiva Oliveirense" → "UD Oliveirense"', () => {
        expect(semiAbrev('União Desportiva Oliveirense')).toBe('UD Oliveirense')
    })

    it('should abbreviate "Grupo Desportivo Estoril" → "GD Estoril"', () => {
        expect(semiAbrev('Grupo Desportivo Estoril')).toBe('GD Estoril')
    })

    it('should abbreviate "Clube Desportivo Feirense" → "CD Feirense"', () => {
        expect(semiAbrev('Clube Desportivo Feirense')).toBe('CD Feirense')
    })

    it('should abbreviate "Associação Académica de Coimbra" → "AA Coimbra"', () => {
        expect(semiAbrev('Associação Académica de Coimbra')).toBe('AA Coimbra')
    })

    it('should abbreviate "Vitória Sport Clube" → "Vitória SC"', () => {
        expect(semiAbrev('Vitória Sport Clube')).toBe('Vitória SC')
    })

    it('should keep unchanged names as-is', () => {
        expect(semiAbrev('FC Porto')).toBe('FC Porto')
        expect(semiAbrev('SL Benfica')).toBe('SL Benfica')
    })
})
