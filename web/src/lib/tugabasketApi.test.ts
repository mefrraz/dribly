import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { fetchStandingsFromSource, resolveDisplayName } from './tugabasketApi'
import { JSDOM } from 'jsdom'

// Polyfill DOMParser (jsdom 29 may not expose it as a global in vitest)
beforeAll(() => {
    const dom = new JSDOM('<!DOCTYPE html>')
    globalThis.DOMParser = dom.window.DOMParser as unknown as typeof DOMParser
})

// Sample TugaBasket HTML with accordion standings
const TUGA_STANDINGS_HTML = `
<html><body>
<div class="accordion">
    <div class="accordion-title"><div>Zona Norte</div></div>
    <table class="standings">
        <thead><tr><th>#</th><th>Equipa</th><th>J</th><th>V</th><th>D</th><th>PTS</th></tr></thead>
        <tbody>
            <tr>
                <td><span>1</span></td>
                <td>FC Porto</td>
                <td>14</td><td>12</td><td>2</td><td>26</td>
            </tr>
            <tr>
                <td><span>2</span></td>
                <td>SL Benfica</td>
                <td>14</td><td>10</td><td>4</td><td>24</td>
            </tr>
        </tbody>
    </table>
</div>
<div class="accordion">
    <div class="accordion-title"><div>Zona Sul</div></div>
    <table class="standings">
        <thead><tr><th>#</th><th>Equipa</th><th>J</th><th>V</th><th>D</th><th>PTS</th></tr></thead>
        <tbody>
            <tr>
                <td><span>1</span></td>
                <td>Sporting CP</td>
                <td>14</td><td>11</td><td>3</td><td>25</td>
            </tr>
        </tbody>
    </table>
</div>
</body></html>`

// Sample HTML with game results to mark phases as finished
const TUGA_GAMES_HTML = `
<html><body>
<table>
    <thead><tr><th>Data</th><th>Casa</th><th>Fora</th><th>Resultado</th><th>Local</th><th>Fase</th></tr></thead>
    <tbody>
        <tr>
            <td>2026-04-01</td><td>FC Porto</td><td>Benfica</td><td>78:65</td><td>Porto</td><td>Zona Norte</td>
        </tr>
        <tr>
            <td>2026-04-01</td><td>Sporting CP</td><td>UD Oliveirense</td><td></td><td>Lisboa</td><td>Zona Sul</td>
        </tr>
    </tbody>
</table>
</body></html>`

const mockFetch = vi.fn()

beforeEach(() => {
    mockFetch.mockReset()
    vi.stubGlobal('fetch', mockFetch)
})

describe('fetchStandingsFromSource', () => {
    it('should parse standings from TugaBasket HTML', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            text: () => Promise.resolve(TUGA_STANDINGS_HTML),
        } as Response)

        const standings = await fetchStandingsFromSource([
            { id: 1, displayName: 'Liga Betclic' },
        ])

        expect(standings.length).toBe(3)

        const first = standings[0]
        expect(first.competicao).toBe('Liga Betclic')
        expect(first.grupo).toBe('Zona Norte')
        expect(first.equipa).toBe('FC Porto')
        expect(first.posicao).toBe(1)
        expect(first.jogos).toBe(14)
        expect(first.vitorias).toBe(12)
        expect(first.derrotas).toBe(2)
        expect(first.pontos).toBe(26)
    })

    it('should mark finished groups when all games have scores', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            text: () => Promise.resolve(TUGA_STANDINGS_HTML + TUGA_GAMES_HTML),
        } as Response)

        const standings = await fetchStandingsFromSource([
            { id: 1, displayName: 'Liga Betclic' },
        ])

        const zonaNorte = standings.find(s => s.grupo === 'Zona Norte')
        expect(zonaNorte!.is_finished).toBe(true)

        const zonaSul = standings.find(s => s.grupo === 'Zona Sul')
        expect(zonaSul!.is_finished).toBe(false)
    })

    it('should handle empty competitions array', async () => {
        const standings = await fetchStandingsFromSource([])
        expect(standings).toEqual([])
    })

    it('should handle HTTP errors gracefully', async () => {
        mockFetch.mockResolvedValue({
            ok: false,
            text: () => Promise.resolve(''),
        } as Response)

        // With Promise.allSettled, a single failing competition is silently skipped
        // rather than rejecting the whole batch.
        const result = await fetchStandingsFromSource([{ id: 1, displayName: 'Liga' }])
        expect(result).toEqual([])
    })

    it('should handle HTML with no standings tables', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            text: () => Promise.resolve('<html><body>No data</body></html>'),
        } as Response)

        const standings = await fetchStandingsFromSource([
            { id: 1, displayName: 'Liga' },
        ])

        expect(standings).toEqual([])
    })
})

describe('resolveDisplayName', () => {
    it('should keep short names unchanged', () => {
        expect(resolveDisplayName('Torneio Abertura')).toBe('Torneio Abertura')
    })

    it('should extract escalão from senior names', () => {
        expect(resolveDisplayName('SENIOR MASCULINO')).toBe('Séniores')
        expect(resolveDisplayName('SÉNIOR FEMININO')).toBe('Séniores')
        expect(resolveDisplayName('PROLIGA')).toBe('Séniores')
        expect(resolveDisplayName('BETCLIC MASCULINA')).toBe('Séniores')
    })

    it('should extract Sub escalões', () => {
        expect(resolveDisplayName('SUB18 MASCULINO')).toBe('Sub 18')
        expect(resolveDisplayName('SUB 16 FEMININO')).toBe('Sub 16')
        expect(resolveDisplayName('SUB14')).toBe('Sub 14')
        expect(resolveDisplayName('MINI 12')).toBe('Sub 12')
    })

    it('should truncate names longer than 30 chars', () => {
        const long = 'Campeonato Nacional da Primeira Divisão de Basquetebol Masculino 2025'
        const result = resolveDisplayName(long)
        expect(result.length).toBeLessThanOrEqual(33) // 30 + '...'
        expect(result.endsWith('...')).toBe(true)
    })
})
