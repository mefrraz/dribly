import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useFollows } from './useFollows'

// Mock deps
vi.mock('../lib/supabase', () => ({
    supabase: {
        from: vi.fn(),
    },
}))

vi.mock('../lib/AuthContext', () => ({
    useAuth: vi.fn(),
}))

vi.mock('../components/Toast', () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('../lib/logger', () => ({
    logger: { warn: vi.fn(), error: vi.fn(), log: vi.fn() },
}))

import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const mockFrom = supabase.from as ReturnType<typeof vi.fn>

describe('useFollows', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns empty follows when no user', () => {
        (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ user: null, loading: false })
        const { result } = renderHook(() => useFollows())

        expect(result.current.follows).toEqual([])
        expect(result.current.loading).toBe(false)
    })

    it('loads follows for authenticated user', async () => {
        const mockFollows = [
            { id: 1, user_id: 'user_1', entity_type: 'club', entity_id: 119 },
            { id: 2, user_id: 'user_1', entity_type: 'competition', entity_id: 10902 },
        ]
        ;(useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
            user: { id: 'user_1', email: 'test@test.com' },
            loading: false,
        })

        const mockSelect = vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockFollows, error: null }),
            }),
        })
        mockFrom.mockReturnValue({ select: mockSelect })

        const { result } = renderHook(() => useFollows())

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        expect(result.current.follows).toEqual(mockFollows)
        expect(result.current.followedClubIds).toEqual([119])
        expect(result.current.followedCompIds).toEqual([10902])
    })

    it('isFollowing returns correct boolean', async () => {
        const mockFollows = [{ id: 1, user_id: 'user_1', entity_type: 'club', entity_id: 119 }]
        ;(useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
            user: { id: 'user_1', email: 'test@test.com' },
            loading: false,
        })

        mockFrom.mockReturnValue({
            select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                    order: vi.fn().mockResolvedValue({ data: mockFollows, error: null }),
                }),
            }),
        })

        const { result } = renderHook(() => useFollows())

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        expect(result.current.isFollowing('club', 119)).toBe(true)
        expect(result.current.isFollowing('club', 999)).toBe(false)
        expect(result.current.isFollowing('competition', 10902)).toBe(false)
    })

    it('sets error on load failure', async () => {
        (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
            user: { id: 'user_1', email: 'test@test.com' },
            loading: false,
        })

        mockFrom.mockReturnValue({
            select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                    order: vi.fn().mockRejectedValue(new Error('Network error')),
                }),
            }),
        })

        const { result } = renderHook(() => useFollows())

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        expect(result.current.error).toBeTruthy()
        expect(result.current.follows).toEqual([])
    })

    it('toggleFollow does nothing when no user', async () => {
        (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ user: null, loading: false })
        const { result } = renderHook(() => useFollows())

        const success = await act(() => result.current.toggleFollow('club', 119))
        expect(success).toBe(false)
    })
})
