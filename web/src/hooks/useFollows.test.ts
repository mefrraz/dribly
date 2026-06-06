// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useFollows, type Follow } from './useFollows'

// vi.mock factories are hoisted — cannot reference outer variables
// Chain that resolves with provided data
let _mockFollowsData: any[] = []
const mockChain = {
    select: vi.fn(function(this: any) { return this }),
    eq: vi.fn(function(this: any) { return this }),
    order: vi.fn(function(this: any) {
        return Promise.resolve({ data: _mockFollowsData, error: null })
    }),
    delete: vi.fn(function(this: any) { return this }),
    upsert: vi.fn(function(this: any) { return this }),
}

vi.mock('../lib/supabase', () => ({
    supabase: {
        from: vi.fn(() => mockChain),
    },
}))

vi.mock('../lib/AuthContext', () => ({
    AuthProvider: ({ children }: { children: React.ReactNode }) => children,
    useAuth: () => ({
        user: { id: 'user_test_123', email: 'a@a.com', username: 't', firstName: null, lastName: null, imageUrl: null, bio: null },
        loading: false,
        signOut: async () => {},
    }),
}))

vi.mock('../components/Toast', () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}))

beforeEach(() => {
    vi.clearAllMocks()
    _mockFollowsData = []
})

describe('useFollows', () => {
    it('should load follows on mount', async () => {
        const follows: Follow[] = [
            { id: 1, user_id: 'user_test_123', entity_type: 'club', entity_id: 10 },
        ]
        _mockFollowsData = follows

        const { result } = renderHook(() => useFollows())

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        expect(result.current.follows).toEqual(follows)
    })

    it('should identify followed entities', async () => {
        const follows: Follow[] = [
            { id: 1, user_id: 'user_test_123', entity_type: 'club', entity_id: 10 },
        ]
        _mockFollowsData = follows

        const { result } = renderHook(() => useFollows())

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        expect(result.current.isFollowing('club', 10)).toBe(true)
        expect(result.current.isFollowing('club', 99)).toBe(false)
    })


})
