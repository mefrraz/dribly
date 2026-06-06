// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { ClubProvider, useClub, displayName, type Club } from './ClubContext'

// Mock supabase
const mockSelect = vi.fn()
const mockOrder = vi.fn()
const mockEq = vi.fn()
const mockSingle = vi.fn()

vi.mock('./supabase', () => ({
    supabase: {
        from: vi.fn(() => ({
            select: mockSelect.mockReturnValue({
                order: mockOrder.mockReturnValue({
                    then: (cb: any) => {
                        cb({
                            data: [
                                { id: 1, name: 'Futebol Clube do Porto', short_name: 'FC Porto', slug: 'fc-porto', search_name: 'fcporto', logo_url: '/logo.png', logo_secondary: null, primary_color: '#0000FF', priority: null },
                                { id: 2, name: 'Sport Lisboa e Benfica', short_name: 'SL Benfica', slug: 'sl-benfica', search_name: 'slbenfica', logo_url: '/logo2.png', logo_secondary: null, primary_color: '#FF0000', priority: 1 },
                            ],
                            error: null,
                        })
                        return { catch: () => {} }
                    },
                }),
            }),
            // For getClubBySlug single lookup
        })),
    },
}))

beforeEach(() => {
    vi.clearAllMocks()
    // Default: from() returns clubs list
    mockSelect.mockReturnValue({
        order: mockOrder.mockReturnValue({
            then: (cb: any) => {
                cb({ data: [], error: null })
                return { catch: () => {} }
            },
        }),
    })
    mockOrder.mockReturnValue({
        then: (cb: any) => {
            cb({ data: [], error: null })
            return { catch: () => {} }
        },
    })
    mockEq.mockReturnValue({
        single: mockSingle.mockReturnValue({
            then: (cb: any) => {
                cb({ data: null, error: { message: 'not found' } })
                return { catch: () => {} }
            },
        }),
    })
})

describe('displayName', () => {
    const baseClub: Club = {
        id: 1, name: 'Futebol Clube do Porto', short_name: 'FC Porto', slug: 'fc-porto',
        search_name: 'fcporto', logo_url: null, logo_secondary: null, primary_color: null, priority: null,
    }

    it('should return short_name when available', () => {
        expect(displayName(baseClub)).toBe('FC Porto')
    })

    it('should fallback to name when short_name is null', () => {
        const club = { ...baseClub, short_name: null }
        expect(displayName(club)).toBe('Futebol Clube do Porto')
    })

    it('should fallback to name when short_name is empty', () => {
        const club = { ...baseClub, short_name: '' }
        expect(displayName(club)).toBe('Futebol Clube do Porto')
    })
})

describe('useClub', () => {
    it('should provide clubs and selectedClub within ClubProvider', () => {
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <ClubProvider>{children}</ClubProvider>
        )

        const { result } = renderHook(() => useClub(), { wrapper })

        expect(result.current.clubs).toEqual([])
        expect(result.current.selectedClub).toBeNull()
    })
})
