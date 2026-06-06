// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ErrorBoundary } from './ErrorBoundary'

// Component that throws
function BrokenComponent({ shouldThrow }: { shouldThrow: boolean }) {
    if (shouldThrow) throw new Error('Test explosion')
    return <div>All good</div>
}

describe('ErrorBoundary', () => {
    const originalError = console.error
    beforeAll(() => { console.error = () => {} })
    afterAll(() => { console.error = originalError })
    afterEach(() => { cleanup() })

    it('should render children when no error', () => {
        render(
            <ErrorBoundary>
                <div>Healthy child</div>
            </ErrorBoundary>
        )
        expect(screen.getByText('Healthy child')).toBeTruthy()
    })

    it('should show error fallback when child throws', () => {
        render(
            <ErrorBoundary>
                <BrokenComponent shouldThrow={true} />
            </ErrorBoundary>
        )
        expect(screen.getByText('Algo correu mal')).toBeTruthy()
    })

    it('should show custom fallback when provided', () => {
        render(
            <ErrorBoundary fallback={<div>Custom error UI</div>}>
                <BrokenComponent shouldThrow={true} />
            </ErrorBoundary>
        )
        expect(screen.getByText('Custom error UI')).toBeTruthy()
    })
})
