import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchFPBGames } from './fpbApi'

const SAMPLE_BOUNCE_GAMES = [
  {
    id: '12345',
    data: '2026-04-15',
    hora: '18:00',
    equipa_casa: 'FC Porto',
    equipa_fora: 'SL Benfica',
    resultado_casa: null,
    resultado_fora: null,
    escalao: 'Sub 18',
    competicao: 'CN SUB18 MASC',
    local: 'Pavilhão Dragão Arena',
    logo_casa: 'https://fpb.pt/logo1.png',
    logo_fora: 'https://fpb.pt/logo2.png',
    estado: 'AGENDADO',
    epoca: '2025/2026',
  },
  {
    id: '12346',
    data: '2026-04-15',
    hora: '21:00',
    equipa_casa: 'Sporting CP',
    equipa_fora: 'UD Oliveirense',
    resultado_casa: 78,
    resultado_fora: 65,
    escalao: 'Senior',
    competicao: 'Liga Betclic',
    local: 'Pavilhão João Rocha',
    logo_casa: 'https://fpb.pt/logo3.png',
    logo_fora: 'https://fpb.pt/logo4.png',
    estado: 'FINALIZADO',
    epoca: '2025/2026',
  },
]

const mockFetch = vi.fn()

beforeEach(() => {
    mockFetch.mockReset()
    vi.stubGlobal('fetch', mockFetch)
    // Bounce returns sample games by default
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(SAMPLE_BOUNCE_GAMES) } as Response)
})

describe('fetchFPBGames', () => {
    it('should parse games from Bounce API', async () => {
        const games = await fetchFPBGames('2025/2026', 119)

        expect(games.length).toBe(2)
        expect(games[0].equipa_casa).toBe('FC Porto')
        expect(games[0].equipa_fora).toBe('SL Benfica')
        expect(games[0].data).toBe('2026-04-15')
        expect(games[0].hora).toBe('18:00')
        expect(games[0].status).toBe('AGENDADO')
        expect(games[0].local).toBe('Pavilhão Dragão Arena')
        expect(games[0].escalao).toBe('Sub 18')
        expect(games[0].competicao).toBe('CN SUB18 MASC')
        expect(games[0].logotipo_casa).toBe('https://fpb.pt/logo1.png')
    })

    it('should handle finished games from Bounce', async () => {
        const games = await fetchFPBGames('2025/2026', 119)
        const finished = games.find(g => g.id === '12346')
        expect(finished).toBeDefined()
        expect(finished!.status).toBe('FINALIZADO')
        expect(finished!.resultado_casa).toBe(78)
        expect(finished!.resultado_fora).toBe(65)
    })

    it('should return empty array on Bounce error', async () => {
        mockFetch.mockReset()
        mockFetch.mockResolvedValue({ ok: false, status: 502 } as Response)

        const games = await fetchFPBGames('2025/2026', 119)
        expect(games).toEqual([])
    })

    it('should return empty array on network error', async () => {
        mockFetch.mockReset()
        mockFetch.mockRejectedValue(new Error('Network error'))

        const games = await fetchFPBGames('2025/2026', 119)
        expect(games).toEqual([])
    })

    it('should filter out invalid dates', async () => {
        const withInvalid = [
            { id: '1', data: '2026-04-15', equipa_casa: 'A', equipa_fora: 'B', estado: 'AGENDADO' },
            { id: '2', data: '', equipa_casa: 'C', equipa_fora: 'D', estado: 'AGENDADO' },
            { id: '3', data: 'invalid', equipa_casa: 'E', equipa_fora: 'F', estado: 'AGENDADO' },
        ]
        mockFetch.mockReset()
        mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(withInvalid) } as Response)

        const games = await fetchFPBGames('2025/2026', 119)
        expect(games.length).toBe(1)
        expect(games[0].id).toBe('1')
    })

    it('should generate correct slugs from Bounce data', async () => {
        const games = await fetchFPBGames('2025/2026', 119)
        expect(games[0].slug).toBe('2026-04-15-fc-porto-sl-benfica')
    })

    it('should return empty array for empty Bounce response', async () => {
        mockFetch.mockReset()
        mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve([]) } as Response)

        const games = await fetchFPBGames('2025/2026', 119)
        expect(games).toEqual([])
    })
})
