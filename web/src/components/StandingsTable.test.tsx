// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { StandingsTable } from './StandingsTable'
import type { Standing } from './types'
import { MemoryRouter } from 'react-router-dom'

const mockTeams: Standing[] = [
    { id: '1', competicao: 'Liga', grupo: 'Norte', equipa: 'FC Porto', posicao: 1, jogos: 14, vitorias: 12, derrotas: 2, pontos: 26, is_finished: false },
    { id: '2', competicao: 'Liga', grupo: 'Norte', equipa: 'SL Benfica', posicao: 2, jogos: 14, vitorias: 10, derrotas: 4, pontos: 24, is_finished: false },
]

describe('StandingsTable', () => {
    afterEach(() => cleanup())

    it('should render group name and team count', () => {
        render(<MemoryRouter><StandingsTable grupo="Zona Norte" teams={mockTeams} isOpen={false} onToggle={vi.fn()} status="active" /></MemoryRouter>)
        expect(screen.getByText('Zona Norte')).toBeTruthy()
        expect(screen.getByText('2 equipas')).toBeTruthy()
    })

    it('should call onToggle when clicked', () => {
        const onToggle = vi.fn()
        render(<MemoryRouter><StandingsTable grupo="Norte" teams={mockTeams} isOpen={false} onToggle={onToggle} status="active" /></MemoryRouter>)
        fireEvent.click(screen.getByText('Norte'))
        expect(onToggle).toHaveBeenCalled()
    })

    it('should show active indicator with pulse', () => {
        const { container } = render(<MemoryRouter><StandingsTable grupo="Norte" teams={mockTeams} isOpen={false} onToggle={vi.fn()} status="active" /></MemoryRouter>)
        expect(container.querySelector('.animate-pulse')).toBeTruthy()
    })

    it('should not show pulse for finished status', () => {
        const { container } = render(<MemoryRouter><StandingsTable grupo="Norte" teams={mockTeams} isOpen={false} onToggle={vi.fn()} status="finished" /></MemoryRouter>)
        expect(container.querySelector('.animate-pulse')).toBeNull()
    })
})
