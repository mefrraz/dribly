// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { GameCard } from './GameCard'
import type { Match } from './types'

function makeMatch(overrides: Partial<Match> = {}): Match {
    return {
        id: '123',
        slug: '2026-04-15-fc-porto-benfica',
        data: '2026-04-15',
        hora: '18:00',
        equipa_casa: 'FC Porto',
        equipa_fora: 'SL Benfica',
        resultado_casa: null,
        resultado_fora: null,
        escalao: 'Liga Betclic',
        competicao: 'Liga Betclic Masculina',
        local: 'Dragão Arena',
        logotipo_casa: null,
        logotipo_fora: null,
        status: 'AGENDADO',
        ...overrides,
    }
}

// Mock matchUtils since we're testing rendering, not match logic
vi.mock('../lib/matchUtils', () => ({
    isClubWin: vi.fn(),
}))

describe('GameCard', () => {
    afterEach(() => { cleanup() })
    it('should render scheduled game with hour', () => {
        render(
            <MemoryRouter>
                <GameCard match={makeMatch()} mode="agenda" />
            </MemoryRouter>
        )

        // Date format varies: "15 abr · 18:00" or "15/04 · 18:00" depending on Node ICU
        expect(screen.getByText(/15.*18:00/)).toBeTruthy()
        expect(screen.getByText('FC Porto')).toBeTruthy()
        expect(screen.getByText('SL Benfica')).toBeTruthy()
        expect(screen.getByText('Dragão Arena')).toBeTruthy()
    })

    it('should render result game with scores', () => {
        render(
            <MemoryRouter>
                <GameCard
                    match={makeMatch({
                        resultado_casa: 78,
                        resultado_fora: 65,
                        status: 'FINALIZADO',
                        hora: '',
                    })}
                    mode="results"
                />
            </MemoryRouter>
        )

        expect(screen.getByText('78')).toBeTruthy()
        expect(screen.getByText('65')).toBeTruthy()
        // Should not show hora for results
        expect(screen.queryByText('18:00')).toBeNull()
    })

    it('should dim losing team', () => {
        render(
            <MemoryRouter>
                <GameCard
                    match={makeMatch({
                        resultado_casa: 65,
                        resultado_fora: 78,
                        status: 'FINALIZADO',
                    })}
                    mode="results"
                />
            </MemoryRouter>
        )

        // FC Porto (home) has 65 < 78 (away) → home row should be dimmed
        // The TeamRow container with opacity-60 wraps the inner div
        const portoName = screen.getByText('FC Porto')
        const teamRow = portoName.closest('.flex.items-center.justify-between')
        expect(teamRow?.className).toContain('opacity-60')
    })

    it('should show LIVE indicator', () => {
        render(
            <MemoryRouter>
                <GameCard
                    match={makeMatch({
                        status: 'A DECORRER',
                        resultado_casa: 45,
                        resultado_fora: 42,
                    })}
                    mode="results"
                />
            </MemoryRouter>
        )

        expect(screen.getByText('LIVE')).toBeTruthy()
    })

    it('should render without hora when hora is empty', () => {
        render(
            <MemoryRouter>
                <GameCard match={makeMatch({ hora: '' })} mode="agenda" />
            </MemoryRouter>
        )

        // Hour should not appear if no valid hora
        expect(screen.getByText(/15/)).toBeTruthy()
        expect(screen.queryByText(/18:00/)).toBeNull()
    })

    it('should link to game detail page', () => {
        render(
            <MemoryRouter>
                <GameCard match={makeMatch()} mode="agenda" />
            </MemoryRouter>
        )

        const link = screen.getByRole('link')
        expect(link.getAttribute('href')).toContain('/jogo/2026-04-15-fc-porto-benfica')
    })

    it('should include clubSlug in link when provided', () => {
        render(
            <MemoryRouter>
                <GameCard match={makeMatch()} mode="agenda" clubSlug="fc-porto" clubName="FC Porto" />
            </MemoryRouter>
        )

        const link = screen.getByRole('link')
        expect(link.getAttribute('href')).toContain('clube=fc-porto')
    })

    it('should render with logo images when provided', () => {
        const { container } = render(
            <MemoryRouter>
                <GameCard
                    match={makeMatch({
                        logotipo_casa: '/logo1.png',
                        logotipo_fora: '/logo2.png',
                    })}
                    mode="agenda"
                />
            </MemoryRouter>
        )

        // Images have alt="" so not accessible roles — use querySelector
        const imgs = container.querySelectorAll('img')
        expect(imgs.length).toBe(2)
    })

    it('should render with fallback initials when no logo', () => {
        render(
            <MemoryRouter>
                <GameCard match={makeMatch()} mode="agenda" />
            </MemoryRouter>
        )

        // Should show first letter as fallback
        expect(screen.getByText('F')).toBeTruthy() // FC Porto
        expect(screen.getByText('S')).toBeTruthy() // SL Benfica
    })
})
