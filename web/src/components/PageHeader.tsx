import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

interface PageHeaderProps {
    /** The route to navigate back to. If omitted, uses browser history back. */
    backTo?: string
    /** Optional title shown next to the arrow. */
    title?: string
    /** Optional right-side element (e.g. a follow button). */
    right?: React.ReactNode
}

/**
 * Consistent "back" header used across all pages.
 *
 * Usage:
 *   <PageHeader backTo="/ligas" title="Voltar" />
 *   <PageHeader />  // just the arrow, goes back in history
 */
export function PageHeader({ backTo, title, right }: PageHeaderProps) {
    const navigate = useNavigate()

    return (
        <div className="flex items-center justify-between mb-6">
            {backTo ? (
                <button
                    onClick={() => navigate(backTo)}
                    className="inline-flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors group"
                >
                    <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                    {title || 'Voltar'}
                </button>
            ) : (
                <button
                    onClick={() => navigate(-1)}
                    className="inline-flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors group"
                >
                    <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                    {title || 'Voltar'}
                </button>
            )}
            {right && <div>{right}</div>}
        </div>
    )
}
