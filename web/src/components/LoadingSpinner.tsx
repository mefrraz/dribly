import { Loader2 } from 'lucide-react'

interface LoadingSpinnerProps {
    /** Optional message shown below the spinner. Defaults to "A carregar..." */
    message?: string
    /** Size of the spinner icon. Default 24. */
    size?: number
}

/**
 * Consistent loading spinner used across all pages.
 *
 * Usage:
 *   <LoadingSpinner />
 *   <LoadingSpinner message="A carregar classificações..." />
 *   <LoadingSpinner size={32} />
 */
export function LoadingSpinner({ message = 'A carregar...', size = 24 }: LoadingSpinnerProps) {
    return (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 size={size} className="animate-spin text-dribly-purple" />
            <span className="text-xs font-medium text-zinc-400">{message}</span>
        </div>
    )
}
