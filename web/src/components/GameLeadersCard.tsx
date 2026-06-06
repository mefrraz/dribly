interface GameLeader {
    categoria: string
    casa: { nome: string; valor: string; foto?: string }
    fora: { nome: string; valor: string; foto?: string }
}

interface GameLeadersCardProps {
    detailLeaders: GameLeader[]
}

/**
 * "Top Performers" section showing the best player in each stat category.
 */
export function GameLeadersCard({ detailLeaders }: GameLeadersCardProps) {
    if (detailLeaders.length === 0) return null

    return (
        <div className="glass-card overflow-hidden ">
            <div className="p-4 border-b border-zinc-100 dark:border-white/5">
                <h3 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-dribly-purple" />
                    Top Performers
                </h3>
            </div>
            <div className="p-4 space-y-2">
                {detailLeaders.map((l, i) => {
                    const cv = parseInt(l.casa.valor) || 0
                    const fv = parseInt(l.fora.valor) || 0
                    const isCasa = cv >= fv
                    const best = isCasa ? l.casa : l.fora
                    return (
                        <div key={i} className="flex items-center gap-3">
                            <span className="text-[10px] sm:text-xs font-medium text-zinc-400 uppercase w-20 shrink-0">{l.categoria}</span>
                            <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-full bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center overflow-hidden shrink-0 border border-zinc-100 dark:border-zinc-700">
                                {best.foto ? (
                                    <img src={best.foto} alt="" className="w-7 h-7 sm:w-10 sm:h-10 rounded-full object-cover" />
                                ) : (
                                    <span className="text-[10px] sm:text-xs font-semibold text-zinc-400">{best.nome?.charAt(0)?.toUpperCase() || '?'}</span>
                                )}
                            </div>
                            <span className="text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 flex-1 truncate">{best.nome}</span>
                            <span className="text-sm sm:text-base font-semibold text-dribly-purple tabular-nums">{best.valor}</span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
