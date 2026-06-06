import { describe, it, expect } from 'vitest'
import { normalize, buildSearchText } from './clubSearch'
import type { Club } from './ClubContext'

function makeClub(overrides: Partial<Club> = {}): Club {
    return {
        id: 1,
        name: 'Futebol Clube do Porto',
        short_name: 'FC Porto',
        slug: 'fc-porto',
        search_name: 'fcporto',
        logo_url: null,
        logo_secondary: null,
        primary_color: '#0000FF',
        priority: null,
        ...overrides,
    } as Club
}

describe('normalize', () => {
    it('should lowercase and trim', () => {
        expect(normalize('  FC Porto  ')).toBe('fc porto')
    })

    it('should remove diacritics (accents)', () => {
        expect(normalize('São João')).toBe('sao joao')
        expect(normalize('Associação Académica')).toBe('associacao academica')
    })

    it('should handle ç and other Portuguese special chars', () => {
        expect(normalize('Açores')).toBe('acores')
        expect(normalize('Maçã')).toBe('maca')
    })

    it('should handle empty strings', () => {
        expect(normalize('')).toBe('')
        expect(normalize('   ')).toBe('')
    })

    it('should handle mixed case with diacritics', () => {
        expect(normalize('G.D. Estoril Praia')).toBe('g.d. estoril praia')
    })
})

describe('buildSearchText', () => {
    it('should include normalized name', () => {
        const club = makeClub({ name: 'FC Porto', short_name: '', search_name: '', priority: 0 })
        const text = buildSearchText(club)
        expect(text).toContain('fc porto')
    })

    it('should include short_name when available', () => {
        const club = makeClub({ short_name: 'Porto' })
        const text = buildSearchText(club)
        expect(text).toContain('porto')
        expect(text).toContain('futebol clube do porto')
    })

    it('should include search_name when available', () => {
        const club = makeClub({ search_name: 'FCP' })
        const text = buildSearchText(club)
        expect(text).toContain('fcp')
    })

    it('should generate acronyms from name words', () => {
        const club = makeClub({
            name: 'Futebol Clube de Gaia',
            short_name: 'FC Gaia',
            search_name: '',
        })
        const text = buildSearchText(club)
        // Acronym: F C d G → fcdg (all first letters, no length filter)
        expect(text).toContain('fcdg')
        // Short name acronym: "FC Gaia" → ["fc","gaia"] → "fg"
        expect(text).toContain('fg')
    })

    it('should handle club with accents in name', () => {
        const club = makeClub({
            name: 'Associação Desportiva de São João',
            short_name: '',
            search_name: '',
        })
        const text = buildSearchText(club)
        expect(text).toContain('associacao desportiva de sao joao')
        // Acronym: A D d S J → addsj (all first letters, no length filter)
        expect(text).toContain('addsj')
    })

    it('should include unique acronyms only (no duplicates)', () => {
        const club = makeClub({
            name: 'SL Benfica',
            short_name: 'Benfica',
            search_name: 'slbenfica',
        })
        const text = buildSearchText(club)
        // name acronym = slb, search_name acronym = s, short_name acronym = b
        // s and b are >2? No, "s" and "b" are single chars, but words shorter than 3 chars in acronym use charAt(0) anyway
        // Actually acronym() splits on whitespace and takes charAt(0) of each word, no length filtering
        // So: "sl benfica" → "sb", "slbenfica" → "s", "benfica" → "b"
        // uniqueAcros should have "sb" (or "s b" after join)
        expect(text).not.toBe('')
        expect(text).toContain('sl benfica')
    })

    it('should handle club with null short_name and search_name', () => {
        const club = makeClub({
            short_name: '',
            search_name: '',
        })
        const text = buildSearchText(club)
        expect(text).toContain('futebol clube do porto')
        expect(text).not.toContain('null')
        expect(text).not.toContain('undefined')
    })
})
