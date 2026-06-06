interface Performer {
    nome: string
    foto: string
}

interface PerfStat {
    label: string
    casa: string
    fora: string
}

interface GameDueloCardProps {
    topPerfCasa: Performer
    topPerfFora: Performer
    topPerfStats: PerfStat[]
}

/**
 * "Duelo" section showing the top performer from each team
 * with a head-to-head stat comparison bar.
 */
export function GameDueloCard({ topPerfCasa, topPerfFora, topPerfStats }: GameDueloCardProps) {
    if (!topPerfCasa.nome || !topPerfFora.nome) return null

    return (
        <div className="glass-card overflow-hidden ">
            <div className="p-4 border-b border-zinc-100 dark:border-white/5">
                <h3 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-dribly-purple" />
                    Duelo
                </h3>
            </div>
            <div className="p-4">
                <div className="flex items-center justify-center gap-3 sm:gap-5 mb-5">
                    <div className="flex flex-col items-center gap-1 text-center min-w-0" style={{ flex: '1 1 0px' }}>
                        <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden">
                            {topPerfCasa.foto ? <img src={topPerfCasa.foto} alt="" className="w-14 h-14 sm:w-20 sm:h-20 rounded-full object-cover" /> : <span className="text-lg sm:text-xl font-semibold text-zinc-400">{topPerfCasa.nome.charAt(0)}</span>}
                        </div>
                        <span className="text-xs sm:text-sm font-semibold text-zinc-700 dark:text-zinc-300 leading-tight">{topPerfCasa.nome}</span>
                    </div>
                    <div className="shrink-0 flex items-center">
                        <span className="text-[10px] sm:text-xs font-bold text-zinc-400 uppercase tracking-[0.15em]">VS</span>
                    </div>
                    <div className="flex flex-col items-center gap-1 text-center min-w-0" style={{ flex: '1 1 0px' }}>
                        <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden">
                            {topPerfFora.foto ? <img src={topPerfFora.foto} alt="" className="w-14 h-14 sm:w-20 sm:h-20 rounded-full object-cover" /> : <span className="text-lg sm:text-xl font-semibold text-zinc-400">{topPerfFora.nome.charAt(0)}</span>}
                        </div>
                        <span className="text-[10px] sm:text-sm font-semibold text-zinc-700 dark:text-zinc-200 leading-tight line-clamp-1">{topPerfFora.nome}</span>
                    </div>
                </div>
                <div className="space-y-2">
                    {topPerfStats.map((stat, i) => {
                        const cv = parseInt(stat.casa) || 0
                        const fv = parseInt(stat.fora) || 0
                        const total = cv + fv || 1
                        const cpct = Math.round((cv / total) * 100)
                        return (
                            <div key={i} className="flex items-center gap-3">
                                <span className="text-[10px] sm:text-xs font-medium text-zinc-400 uppercase w-24 shrink-0">{stat.label}</span>
                                <span className="text-xs sm:text-sm font-semibold text-dribly-purple tabular-nums w-8 text-right">{stat.casa}</span>
                                <div className="flex-1 h-2 rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                                    <div className="h-full bg-dribly-purple/70 rounded-full" style={{ width: cpct + '%' }} />
                                    <div className="h-full bg-zinc-200 dark:bg-zinc-700" style={{ width: (100 - cpct) + '%' }} />
                                </div>
                                <span className="text-xs sm:text-sm font-semibold text-zinc-700 dark:text-zinc-300 tabular-nums w-8">{stat.fora}</span>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
