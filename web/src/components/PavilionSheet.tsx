/**
 * Bottom sheet that shows pavilion info + upcoming games.
 * Slides up when user taps a pavilion marker on the map.
 */
import { useEffect, useState } from 'react'
import { X, MapPin, Loader2, ChevronRight } from 'lucide-react'
import type { Pavilion, GameAtPavilion } from '../lib/mapData'
import { fetchGamesAtPavilion, displayPavilionName } from '../lib/mapData'
import { GameCard } from './GameCard'
import type { Match } from './types'

interface Props {
    pavilion: Pavilion
    isOpen: boolean
    onClose: () => void
}

/** Convert GameAtPavilion to Match for GameCard */
function toMatch(g: GameAtPavilion): Match {
    return {
        id: g.id || g.slug,
        slug: g.slug,
        data: g.data,
        hora: g.hora || '',
        equipa_casa: g.equipa_casa,
        equipa_fora: g.equipa_fora,
        resultado_casa: g.resultado_casa,
        resultado_fora: g.resultado_fora,
        escalao: '',
        competicao: '',
        local: g.local,
        logotipo_casa: g.logotipo_casa,
        logotipo_fora: g.logotipo_fora,
        status: g.status as Match['status'],
    }
}

export function PavilionSheet({ pavilion, isOpen, onClose }: Props) {
    const [games, setGames] = useState<GameAtPavilion[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!isOpen || !pavilion) return
        setLoading(true)
        fetchGamesAtPavilion(pavilion.nome, pavilion.cidade)
            .then((data) => {
                setGames(data)
            })
            .catch(() => setGames([]))
            .finally(() => setLoading(false))
    }, [isOpen, pavilion])

    if (!isOpen) return null

    const displayName = displayPavilionName(pavilion)
    const address = [pavilion.rua, pavilion.cidade].filter(Boolean).join(', ')

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm animate-fade-in"
                onClick={onClose}
            />

            {/* Sheet */}
            <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up max-h-[60vh] overflow-hidden flex flex-col bg-white dark:bg-zinc-900 rounded-t-2xl shadow-2xl border-t border-zinc-200 dark:border-white/10">
                {/* Handle */}
                <div className="flex justify-center pt-2 pb-1">
                    <div className="w-10 h-1 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                </div>

                {/* Header */}
                <div className="px-5 pt-2 pb-3 border-b border-zinc-100 dark:border-white/5">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                            <h3 className="text-base font-bold text-zinc-900 dark:text-white truncate">
                                {displayName}
                            </h3>
                            <div className="flex items-center gap-1.5 mt-1 text-zinc-500 dark:text-zinc-400">
                                <MapPin size={13} />
                                <p className="text-xs truncate">{address || pavilion.cidade || 'Portugal'}</p>
                            </div>
                            {pavilion.fpb_url && (
                                <a
                                    href={pavilion.fpb_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 mt-1.5 text-[11px] text-dribly-purple hover:underline"
                                >
                                    Ver na FPB <ChevronRight size={11} />
                                </a>
                            )}
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors shrink-0"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Games list */}
                <div className="overflow-y-auto flex-1 px-5 py-3 pb-safe">
                    {loading ? (
                        <div className="flex items-center justify-center py-8 gap-2">
                            <Loader2 size={18} className="animate-spin text-dribly-purple" />
                            <span className="text-sm text-zinc-400">A carregar jogos...</span>
                        </div>
                    ) : games.length === 0 ? (
                        <p className="text-sm text-zinc-400 text-center py-8">
                            Sem jogos futuros neste pavilhão.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
                                {games.length} jogo{games.length !== 1 ? 's' : ''} futuro{games.length !== 1 ? 's' : ''}
                            </p>
                            {games.map((g, i) => (
                                <GameCard key={g.slug || i} match={toMatch(g)} mode="agenda" />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    )
}
