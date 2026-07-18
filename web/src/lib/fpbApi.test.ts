import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { fetchFPBGames } from './fpbApi'
import { JSDOM } from 'jsdom'

// Polyfill DOMParser (jsdom 29 may not expose it as a global in vitest)
beforeAll(() => {
    const dom = new JSDOM('<!DOCTYPE html>')
    globalThis.DOMParser = dom.window.DOMParser as unknown as typeof DOMParser
})

// Sample FPB HTML for a game day with 2 games (1 scheduled, 1 finished)
const CALENDAR_HTML = `
<html><body>
<div class="day-wrapper">
    <h3 class="date">15 ABR 2026</h3>
    <a class="game-wrapper-a" href="/ficha-de-jogo?internalID=12345">
        <div class="team-container">
            <span class="fullName">FC Porto</span>
            <div class="image-container"><img src="https://fpb.pt/logo1.png"/></div>
        </div>
        <div class="team-container">
            <span class="sigla">SLB</span>
            <div class="image-container"><img src="https://fpb.pt/logo2.png"/></div>
        </div>
        <div class="competition"><span>Sub 18 | CN SUB18 MASC</span></div>
        <div class="location-wrapper"><b>Pavilhão Dragão Arena</b></div>
        <div class="hour"><h3>18H00</h3></div>
    </a>
    <a class="game-wrapper-a" href="/ficha-de-jogo?internalID=12346">
        <div class="team-container">
            <span class="fullName">Sporting CP</span>
        </div>
        <div class="team-container">
            <span class="fullName">UD Oliveirense</span>
        </div>
        <div class="competition"><span>Liga Betclic</span></div>
        <div class="location-wrapper"><b>Pavilhão João Rocha</b></div>
        <div class="results_wrapper">
            <h3 class="results_text">78</h3>
            <h3 class="results_text">65</h3>
        </div>
    </a>
</div>
</body></html>`

const RESULTS_HTML = `
<html><body>
<div class="day-wrapper">
    <h3 class="date">10 ABR 2026</h3>
    <a class="game-wrapper-a" href="/ficha-de-jogo?internalID=99999">
        <div class="team-container">
            <span class="fullName">FC Porto</span>
        </div>
        <div class="team-container">
            <span class="fullName">Benfica</span>
        </div>
        <div class="competition"><span>Liga Betclic</span></div>
        <div class="results_wrapper">
            <h3 class="results_text">82</h3>
            <h3 class="results_text">80</h3>
        </div>
    </a>
</div>
</body></html>`

// Mock fetch globally
const mockFetch = vi.fn()

beforeEach(() => {
    mockFetch.mockReset()
    vi.stubGlobal('fetch', mockFetch)
    // First fetch call is always to Bounce API — return 404 (ok: false) so fallback triggers
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 } as Response)
})

describe('fetchFPBGames', () => {
    it('should parse games from calendar and results HTML', async () => {
        mockFetch
            .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(CALENDAR_HTML) } as Response)
            .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(RESULTS_HTML) } as Response)

        const games = await fetchFPBGames('2025/2026', 119)

        expect(games.length).toBeGreaterThanOrEqual(2)

        // Check scheduled game from calendar
        const scheduled = games.find(g => g.id === '12345')
        expect(scheduled).toBeDefined()
        expect(scheduled!.equipa_casa).toBe('FC Porto')
        expect(scheduled!.equipa_fora).toBe('SLB')
        expect(scheduled!.data).toBe('2026-04-15')
        expect(scheduled!.hora).toBe('18:00')
        expect(scheduled!.status).toBe('AGENDADO')
        expect(scheduled!.local).toBe('Pavilhão Dragão Arena')
        expect(scheduled!.escalao).toBe('Sub 18')
        expect(scheduled!.competicao).toBe('CN SUB18 MASC')

        // Check finished game from calendar (had results_wrapper)
        const finished = games.find(g => g.id === '12346')
        expect(finished).toBeDefined()
        expect(finished!.equipa_casa).toBe('Sporting CP')
        expect(finished!.equipa_fora).toBe('UD Oliveirense')
        expect(finished!.status).toBe('FINALIZADO')
        expect(finished!.resultado_casa).toBe(78)
        expect(finished!.resultado_fora).toBe(65)
    })

    it('should merge results page data overriding calendar data', async () => {
        // Calendar shows no scores, results shows scores
        const calWithGame = `
        <html><body>
        <div class="day-wrapper">
            <h3 class="date">10 ABR 2026</h3>
            <a class="game-wrapper-a" href="/ficha-de-jogo?internalID=99999">
                <div class="team-container"><span class="fullName">FC Porto</span></div>
                <div class="team-container"><span class="fullName">Benfica</span></div>
                <div class="competition"><span>Liga Betclic</span></div>
                <div class="hour"><h3>18H00</h3></div>
            </a>
        </div>
        </body></html>`

        mockFetch
            .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(calWithGame) } as Response)
            .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(RESULTS_HTML) } as Response)

        const games = await fetchFPBGames('2025/2026', 119)

        const merged = games.find(g => g.id === '99999')
        expect(merged).toBeDefined()
        // Results page overrides → should have scores
        expect(merged!.status).toBe('FINALIZADO')
        expect(merged!.resultado_casa).toBe(82)
        expect(merged!.resultado_fora).toBe(80)
    })

    it('should handle HTTP errors gracefully', async () => {
        mockFetch
            .mockResolvedValueOnce({ ok: false, status: 502 } as Response)

        await expect(fetchFPBGames('2025/2026', 119)).rejects.toThrow('FPB error: 502')
    })

    it('should handle score-in-hour-text fallback', async () => {
        const html = `
        <html><body>
        <div class="day-wrapper">
            <h3 class="date">20 MAR 2026</h3>
            <a class="game-wrapper-a" href="/ficha-de-jogo?internalID=55555">
                <div class="team-container"><span class="fullName">FC Porto</span></div>
                <div class="team-container"><span class="fullName">Benfica</span></div>
                <div class="competition"><span>Liga Betclic</span></div>
                <div class="hour"><h3>78-65</h3></div>
            </a>
        </div>
        </body></html>`

        mockFetch
            .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(html) } as Response)
            .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('<html></html>') } as Response)

        const games = await fetchFPBGames('2025/2026', 119)
        const game = games.find(g => g.id === '55555')
        expect(game).toBeDefined()
        expect(game!.status).toBe('FINALIZADO')
        expect(game!.resultado_casa).toBe(78)
        expect(game!.resultado_fora).toBe(65)
    })

    it('should handle empty responses', async () => {
        mockFetch
            .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('<html></html>') } as Response)
            .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('<html></html>') } as Response)

        const games = await fetchFPBGames('2025/2026', 119)
        expect(games).toEqual([])
    })

    it('should generate correct slugs', async () => {
        mockFetch
            .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(CALENDAR_HTML) } as Response)
            .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('<html></html>') } as Response)

        const games = await fetchFPBGames('2025/2026', 119)
        const game = games.find(g => g.id === '12345')
        expect(game!.slug).toBe('2026-04-15-fc-porto-slb')
    })

    it('should use sigla as fallback when fullName is missing', async () => {
        const html = `
        <html><body>
        <div class="day-wrapper">
            <h3 class="date">01 JAN 2026</h3>
            <a class="game-wrapper-a" href="/ficha-de-jogo?internalID=11111">
                <div class="team-container"><span class="sigla">FCP</span></div>
                <div class="team-container"><span class="sigla">SLB</span></div>
                <div class="competition"><span>Liga</span></div>
            </a>
        </div>
        </body></html>`

        mockFetch
            .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(html) } as Response)
            .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('<html></html>') } as Response)

        const games = await fetchFPBGames('2025/2026', 119)
        expect(games[0].equipa_casa).toBe('FCP')
        expect(games[0].equipa_fora).toBe('SLB')
    })
})
