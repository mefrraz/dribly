import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { JSDOM } from 'jsdom'
import { fetchStandings } from './fpbCompetitionsApi'

// Polyfill DOMParser
beforeAll(() => {
    const dom = new JSDOM('<!DOCTYPE html>')
    globalThis.DOMParser = dom.window.DOMParser as unknown as typeof DOMParser
})

// HTML returned by /classificacao/N
const HTML_WITH_FASES = `<html><body><ul><li class="option" tag="Fase Regular" value="30969">Fase Regular</li><li class="option" tag="Playoff" value="30970">Playoff</li></ul></body></html>`
const HTML_NO_FASES = `<html><body>Sem fases</body></html>`

// WordPress AJAX table response
// The real FPB HTML wraps position in <b>: <h5><b>1</b></h5>, team name is plain <h5>
const AJAX_TABLE = { result: { body: '<div class="team-row"><h5><b>1</b></h5><h5>FC Porto</h5><h5>FCP</h5><h5>14</h5><h5>12</h5><h5>2</h5><h5>0</h5><h5>850</h5><h5>620</h5><h5>230</h5><h5>26</h5></div>' } }
const AJAX_GAMES = { result: { body: '<div class="phase-game"><div class="date">15 MAI</div><div class="sigla">FCP</div><div class="score">78</div><div class="sigla">SLB</div><div class="score">65</div><div class="clear"></div></div>' } }

let _htmlResponse = HTML_WITH_FASES
let _ajaxResponses: any[] = [AJAX_TABLE, AJAX_GAMES]

const mockFetch = vi.fn((_url: string) => {
    // First call is always for the classificacao HTML
    const callsSoFar = mockFetch.mock.calls.length
    if (callsSoFar === 1) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve(_htmlResponse) } as Response)
    }
    // Subsequent calls are AJAX
    const ajaxIdx = callsSoFar - 2
    const resp = _ajaxResponses[ajaxIdx] || _ajaxResponses[_ajaxResponses.length - 1]
    return Promise.resolve({ ok: true, json: () => Promise.resolve(resp) } as Response)
})

beforeEach(() => {
    vi.clearAllMocks()
    _htmlResponse = HTML_WITH_FASES
    _ajaxResponses = [AJAX_TABLE, AJAX_GAMES]
    vi.stubGlobal('fetch', mockFetch)
})

describe('fetchStandings', () => {
    it('should extract fase IDs and parse table + game phases', async () => {
        const phases = await fetchStandings(10902)

        expect(phases.length).toBe(2)
        expect(phases[0].name).toBe('Fase Regular')
        expect(phases[0].type).toBe('table')
        expect(phases[0].teams.length).toBe(1)
        expect(phases[0].teams[0].equipa).toBe('FC Porto')
        expect(phases[0].teams[0].j).toBe(14)
        expect(phases[0].teams[0].v).toBe(12)
        expect(phases[0].teams[0].pts).toBe(26)

        expect(phases[1].name).toBe('Playoff')
        expect(phases[1].type).toBe('games')
    })

    it('should fallback to default fase when no options found', async () => {
        _htmlResponse = HTML_NO_FASES
        _ajaxResponses = [AJAX_TABLE]

        const phases = await fetchStandings(10902)

        expect(phases.length).toBe(1)
        expect(phases[0].name).toBe('Fase Regular')
        expect(phases[0].teams.length).toBe(1)
    })

    it('should handle HTML fetch failure gracefully', async () => {
        // Make first fetch fail
        _htmlResponse = 'WILL_BE_OVERRIDDEN'
        let firstCall = true
        const errorFetch = vi.fn((_url: string) => {
            if (firstCall) { firstCall = false; return Promise.reject(new Error('Network error')) }
            return Promise.resolve({ ok: true, json: () => Promise.resolve(AJAX_TABLE) } as Response)
        })
        vi.stubGlobal('fetch', errorFetch)

        const phases = await fetchStandings(10902)

        expect(phases.length).toBe(1)
        expect(phases[0].name).toBe('Fase Regular')
        expect(phases[0].teams.length).toBe(1)
    })

    it('should return empty teams when AJAX response is malformed', async () => {
        _ajaxResponses = [{ result: null }, { malformed: true }]

        const phases = await fetchStandings(10902)

        expect(phases.length).toBe(2)
        expect(phases[0].teams).toEqual([])
        expect(phases[1].teams).toEqual([])
    })

    it('should handle AJAX HTTP errors gracefully', async () => {
        let firstAjax = true
        const mixedFetch = vi.fn((_url: string) => {
            // First call is HTML
            if (mixedFetch.mock.calls.length === 1) {
                return Promise.resolve({ ok: true, text: () => Promise.resolve(HTML_WITH_FASES) } as Response)
            }
            // First AJAX fails, second succeeds
            if (firstAjax) { firstAjax = false; return Promise.resolve({ ok: false, status: 500 } as Response) }
            return Promise.resolve({ ok: true, json: () => Promise.resolve(AJAX_TABLE) } as Response)
        })
        vi.stubGlobal('fetch', mixedFetch)

        const phases = await fetchStandings(10902)

        expect(phases.length).toBe(2)
        expect(phases[0].teams).toEqual([])
        expect(phases[1].teams.length).toBe(1)
    })

    it('should detect table vs games type correctly', async () => {
        _ajaxResponses = [AJAX_TABLE, AJAX_GAMES]

        const phases = await fetchStandings(10902)

        expect(phases[0].type).toBe('table')
        expect(phases[1].type).toBe('games')
    })
})
