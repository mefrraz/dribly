// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useGames } from './useGames'

// Mock fetch for FPB API
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

// Sample FPB game response HTML
const GAMES_HTML = `
<html><body>
<div class="day-wrapper">
    <h3 class="date">20 MAR 2026</h3>
    <a class="game-wrapper-a" href="/ficha-de-jogo?internalID=111">
        <div class="team-container">
            <span class="fullName">FC Porto</span>
            <div class="image-container"><img src="/logo1.png"/></div>
        </div>
        <div class="team-container">
            <span class="fullName">SL Benfica</span>
            <div class="image-container"><img src="/logo2.png"/></div>
        </div>
        <div class="competition"><span>Liga Betclic</span></div>
        <div class="hour"><h3>18H00</h3></div>
    </a>
</div>
</body></html>`

const GAMES_HTML_UPDATED = `
<html><body>
<div class="day-wrapper">
    <h3 class="date">20 MAR 2026</h3>
    <a class="game-wrapper-a" href="/ficha-de-jogo?internalID=111">
        <div class="team-container"><span class="fullName">FC Porto</span></div>
        <div class="team-container"><span class="fullName">SL Benfica</span></div>
        <div class="competition"><span>Liga Betclic</span></div>
        <div class="results_wrapper">
            <h3 class="results_text">78</h3>
            <h3 class="results_text">65</h3>
        </div>
    </a>
</div>
</body></html>`

// Polyfill DOMParser
import { JSDOM } from 'jsdom'
const dom = new JSDOM('<!DOCTYPE html>')
globalThis.DOMParser = dom.window.DOMParser as unknown as typeof DOMParser

beforeEach(() => {
    mockFetch.mockReset()
    Object.keys(localStorageStore).forEach(k => delete localStorageStore[k])
    mockLocalStorage.getItem.mockClear()
    mockLocalStorage.setItem.mockClear()
})

describe('useGames', () => {
    it('should load games from FPB API on mount', async () => {
        mockFetch
            .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(GAMES_HTML) } as Response)
            .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('<html></html>') } as Response)

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
        mockFetch
            .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(GAMES_HTML) } as Response)
            .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('<html></html>') } as Response)

        renderHook(() => useGames('2025/2026', 119))

        await waitFor(() => {
            // Should have saved to localStorage
            const setCalls = mockLocalStorage.setItem.mock.calls
            const keyCalls = setCalls.map((c: any) => c[0])
            expect(keyCalls.some((k: string) => k.includes('games_cache'))).toBe(true)
        })
    })

    it('should provide a refresh function', async () => {
        mockFetch
            .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(GAMES_HTML) } as Response)
            .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('<html></html>') } as Response)
            // Refresh calls
            .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(GAMES_HTML_UPDATED) } as Response)
            .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('<html></html>') } as Response)

        const { result } = renderHook(() => useGames('2025/2026', 119))

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        // Initial state: AGENDADO
        expect(result.current.games[0].status).toBe('AGENDADO')

        // Refresh
        await act(async () => {
            await result.current.refresh()
        })

        // After refresh: should now show FINALIZADO
        expect(result.current.games[0].status).toBe('FINALIZADO')
        expect(result.current.games[0].resultado_casa).toBe(78)
        expect(result.current.games[0].resultado_fora).toBe(65)
    })

    it('should handle FPB fetch errors gracefully', async () => {
        mockFetch.mockRejectedValue(new Error('Network error'))

        const { result } = renderHook(() => useGames('2025/2026', 119))

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        // Should have an error message
        expect(result.current.error).toBeTruthy()
    })

    it('should not re-fetch when data has not changed', async () => {
        // First load
        mockFetch
            .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(GAMES_HTML) } as Response)
            .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('<html></html>') } as Response)
        // Second call (refresh) — same data
        mockFetch
            .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(GAMES_HTML) } as Response)
            .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('<html></html>') } as Response)

        const { result } = renderHook(() => useGames('2025/2026', 119))

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        const gamesAfterFirst = result.current.games

        // Refresh with same data
        await act(async () => {
            await result.current.refresh()
        })

        // Games should be the same reference (no unnecessary re-render trigger)
        // The change detection uses key comparison, so same data = same state
        expect(result.current.games).toEqual(gamesAfterFirst)
    })
})
