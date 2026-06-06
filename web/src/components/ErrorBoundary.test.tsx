// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ErrorBoundary } from './ErrorBoundary'

describe('ErrorBoundary', () => {
    afterEach(() => cleanup())

    it('should render children when no error', () => {
        render(
            <ErrorBoundary>
                <div>Healthy child</div>
            </ErrorBoundary>
        )
        expect(screen.getByText('Healthy child')).toBeTruthy()
    })

    it('should show fallback when child throws', () => {
        // Suppress React's error logging for this test
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
        
        function Broken() { throw new Error('boom') }
        
        render(
            <ErrorBoundary>
                <Broken />
            </ErrorBoundary>
        )
        
        expect(screen.getByText('Algo correu mal')).toBeTruthy()
        spy.mockRestore()
    })
})
