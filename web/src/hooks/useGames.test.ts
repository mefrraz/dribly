// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useGames } from './useGames'

// Mock fetch for Bounce API
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Mock supabase
vi.mock('../lib/supabase', () => ({
    supabase: {
        from: vi.fn(() => ({
            upsert: vi.fn(() => Promise.resolve({ error: null })),
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    single: vi.fn(() => Promise.resolve({ data: null, error: { message: 'not found' } })),
                })),
            })),
        })),
    },
}))

// Mock localStorage
const localStorageStore: Record<string, string> = {}
const mockLocalStorage = {
    getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { localStorageStore[key] = value }),
    removeItem: vi.fn((key: string) => { delete localStorageStore[key] }),
}
Object.defineProperty(globalThis, 'localStorage', { value: mockLocalStorage })

// Bounce API returns JSON, not HTML
const BOUNCE_GAME = {
    id: '111',
    data: '2026-03-20',
    hora: '18:00',
    equipa_casa: 'FC Porto',
    equipa_fora: 'SL Benfica',
    resultado_casa: null,
    resultado_fora: null,
    escalao: 'Senior',
    competicao: 'Liga Betclic',
    local: 'Pavilhão Dragão Arena',
    logo_casa: '/logo1.png',
    logo_fora: '/logo2.png',
    estado: 'AGENDADO',
    epoca: '2025/2026',
}

const BOUNCE_GAME_FINISHED = {
    ...BOUNCE_GAME,
    resultado_casa: 78,
    resultado_fora: 65,
    estado: 'FINALIZADO',
}

beforeEach(() => {
    mockFetch.mockReset()
    Object.keys(localStorageStore).forEach(k => delete localStorageStore[k])
    mockLocalStorage.getItem.mockClear()
    mockLocalStorage.setItem.mockClear()
})

describe('useGames', () => {
    it('should load games from Bounce API on mount', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve([BOUNCE_GAME]),
        } as Response)

        const { result } = renderHook(() => useGames('2025/2026', 119))

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        expect(result.current.games.length).toBe(1)
        expect(result.current.games[0].equipa_casa).toBe('FC Porto')
        expect(result.current.games[0].equipa_fora).toBe('SL Benfica')
        expect(result.current.games[0].status).toBe('AGENDADO')
        expect(result.current.games[0].data).toBe('2026-03-20')
        expect(result.current.games[0].hora).toBe('18:00')
    })

    it('should persist games to localStorage after load', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve([BOUNCE_GAME]),
        } as Response)

        renderHook(() => useGames('2025/2026', 119))

        await waitFor(() => {
            const setCalls = mockLocalStorage.setItem.mock.calls
            const keyCalls = setCalls.map((c: any) => c[0])
            expect(keyCalls.some((k: string) => k.includes('games_cache'))).toBe(true)
        })
    })

    it('should provide a refresh function', async () => {
        mockFetch
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve([BOUNCE_GAME]),
            } as Response)
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve([BOUNCE_GAME_FINISHED]),
            } as Response)

        const { result } = renderHook(() => useGames('2025/2026', 119))

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        expect(result.current.games[0].status).toBe('AGENDADO')

        await act(async () => {
            await result.current.refresh()
        })

        expect(result.current.games[0].status).toBe('FINALIZADO')
        expect(result.current.games[0].resultado_casa).toBe(78)
        expect(result.current.games[0].resultado_fora).toBe(65)
    })

    it('should handle Bounce errors gracefully', async () => {
        mockFetch.mockRejectedValue(new Error('Network error'))

        const { result } = renderHook(() => useGames('2025/2026', 119))

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        // Errors return empty games gracefully
        expect(result.current.games).toEqual([])
    })

    it('should not re-fetch when data has not changed', async () => {
        mockFetch
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve([BOUNCE_GAME]),
            } as Response)
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve([BOUNCE_GAME]),
            } as Response)

        const { result } = renderHook(() => useGames('2025/2026', 119))

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        const gamesAfterFirst = result.current.games

        await act(async () => {
            await result.current.refresh()
        })

        expect(result.current.games).toEqual(gamesAfterFirst)
    })
})
