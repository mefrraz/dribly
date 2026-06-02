/**
 * Pavilion card — floats over the map.
 * Mobile: full-width bottom sheet.
 * Desktop: floating card (bottom-right, ~400px).
 */
import { useEffect, useState } from 'react'
import { X, MapPin, Loader2, ExternalLink } from 'lucide-react'
import type { Pavilion, GameAtPavilion } from '../lib/mapData'
import { fetchGamesAtPavilion, displayPavilionName } from '../lib/mapData'
import { GameCard } from './GameCard'
import type { Match } from './types'

interface Props {
    pavilion: Pavilion
    isOpen: boolean
    onClose: () => void
}

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
        escalao: g.escalao || '',
        competicao: g.competicao || '',
        local: g.local,
        logotipo_casa: g.logotipo_casa,
        logotipo_fora: g.logotipo_fora,
        status: g.status as Match['status'],
    }
}

import { Link } from 'react-router-dom'

export function PavilionSheet({ pavilion, isOpen, onClose }: Props) {
    const [games, setGames] = useState<GameAtPavilion[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!isOpen || !pavilion) return
        setLoading(true)
        fetchGamesAtPavilion(pavilion.nome, pavilion.cidade)
            .then(setGames)
            .catch(() => setGames([]))
            .finally(() => setLoading(false))
    }, [isOpen, pavilion])

    if (!isOpen) return null

    const displayName = displayPavilionName(pavilion)
    const address = [pavilion.rua, pavilion.cidade].filter(Boolean).join(', ')

    return (
        <>
            {/* Backdrop — only on mobile */}
            <div
                className="fixed inset-0 z-[2000] md:hidden bg-black/30 backdrop-blur-sm animate-fade-in"
                onClick={onClose}
            />

            {/* Card — full-width bottom sheet on mobile, floating card on desktop */}
            <div className={`
                fixed z-[2001] animate-slide-up
                inset-x-0 bottom-0
                md:inset-x-auto md:bottom-6 md:right-6 md:left-auto
                md:w-[400px] md:max-h-[70vh] md:rounded-2xl md:border md:shadow-2xl
                max-h-[60vh] rounded-t-2xl md:rounded-2xl
                overflow-hidden flex flex-col
                bg-white dark:bg-zinc-900
                border-t md:border border-zinc-200 dark:border-white/10
                shadow-2xl
            `}>
                {/* Header */}
                <div className="px-5 pt-4 pb-3 border-b border-zinc-100 dark:border-white/5 shrink-0">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                            <h3 className="text-base font-bold text-zinc-900 dark:text-white truncate">
                                {displayName}
                            </h3>
                            <div className="flex items-center gap-1.5 mt-0.5 text-zinc-500 dark:text-zinc-400">
                                <MapPin size={13} />
                                <p className="text-xs truncate">{address || pavilion.cidade || 'Portugal'}</p>
                            </div>
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
                <div className="overflow-y-auto flex-1 px-5 py-3">
                    {loading ? (
                        <div className="flex items-center justify-center py-6 gap-2">
                            <Loader2 size={16} className="animate-spin text-dribly-purple" />
                            <span className="text-sm text-zinc-400">A carregar...</span>
                        </div>
                    ) : games.length === 0 ? (
                        <p className="text-sm text-zinc-400 text-center py-6">
                            Sem jogos futuros neste pavilhão.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                                {games.length} jogo{games.length !== 1 ? 's' : ''} futuro{games.length !== 1 ? 's' : ''}
                            </p>
                            {games.slice(0, 4).map((g, i) => {
                                const m = toMatch(g)
                                return (
                                    <div key={g.slug || i}>
                                        <GameCard match={m} mode="agenda" />
                                        {(m.escalao || m.competicao) && (
                                            <p className="text-[10px] text-zinc-400 mt-0.5 px-1">
                                                {m.escalao || m.competicao}
                                            </p>
                                        )}
                                    </div>
                                )
                            })}
                            {games.length > 4 && (
                                <p className="text-[11px] text-zinc-400 text-center">
                                    +{games.length - 4} jogos
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer — link to Dribly pavilion page */}
                {pavilion.recinto_id && (
                    <div className="px-5 py-2.5 border-t border-zinc-100 dark:border-white/5 shrink-0">
                        <Link
                            to={`/pavilhao/${pavilion.recinto_id}`}
                            onClick={onClose}
                            className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl bg-dribly-purple text-white text-xs font-bold hover:bg-dribly-purple/90 transition-colors"
                        >
                            Ver pavilhão <ExternalLink size={12} />
                        </Link>
                    </div>
                )}
            </div>
        </>
    )
}
