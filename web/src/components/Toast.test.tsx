// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, cleanup } from '@testing-library/react'
import { toast, ToastContainer } from './Toast'

describe('Toast', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })
    afterEach(() => {
        vi.useRealTimers()
        cleanup()
    })

    it('should show success toast', () => {
        render(<ToastContainer />)
        act(() => { toast.success('Clube adicionado!') })
        expect(screen.getByText('Clube adicionado!')).toBeTruthy()
    })

    it('should show error toast', () => {
        render(<ToastContainer />)
        act(() => { toast.error('Erro ao guardar') })
        expect(screen.getByText('Erro ao guardar')).toBeTruthy()
    })

    it('should dismiss toast after timeout', () => {
        render(<ToastContainer />)
        act(() => { toast.success('Mensagem temporária') })
        expect(screen.getByText('Mensagem temporária')).toBeTruthy()

        act(() => { vi.advanceTimersByTime(5000) })
        expect(screen.queryByText('Mensagem temporária')).toBeNull()
    })

    it('should display multiple toasts', () => {
        render(<ToastContainer />)
        act(() => { toast.success('A') })
        act(() => { toast.error('B') })
        expect(screen.getByText('A')).toBeTruthy()
        expect(screen.getByText('B')).toBeTruthy()
    })
})
