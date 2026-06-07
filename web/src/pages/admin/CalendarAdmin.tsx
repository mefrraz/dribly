import { useEffect, useState, useMemo } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Match } from '../../components/types'

const GAME_TABLES = ['games_2025_2026', 'games_2024_2025', 'games_2023_2024', 'games_2022_2023']
const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const DAYS_HEADER = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

interface DayGames {
    date: string
    games: Match[]
}

export default function CalendarAdmin() {
    const [year, setYear] = useState(new Date().getFullYear())
    const [gamesByDate, setGamesByDate] = useState<Map<string, Match[]>>(new Map())
    const [loading, setLoading] = useState(true)
    const [selectedDay, setSelectedDay] = useState<DayGames | null>(null)

    useEffect(() => {
        setLoading(true)
        const start = `${year}-01-01`
        const end = `${year}-12-31`
        const all: Match[] = []

        Promise.all(
            GAME_TABLES.map(table =>
                supabase
                    .from(table)
                    .select('*')
                    .gte('data', start)
                    .lte('data', end)
                    .order('data')
                    .then(({ data }) => {
                        if (data) all.push(...(data as Match[]))
                    }),
            ),
        ).then(() => {
            const map = new Map<string, Match[]>()
            for (const g of all) {
                const list = map.get(g.data) || []
                list.push(g)
                map.set(g.data, list)
            }
            setGamesByDate(map)
            setLoading(false)
        })
    }, [year])

    // Build 12 month grids
    const months = useMemo(() => {
        return MONTHS.map((_, mIdx) => {
            const month = mIdx // 0-indexed
            const firstDay = new Date(year, month, 1)
            const startDow = firstDay.getDay() // 0=Sun
            const daysInMonth = new Date(year, month + 1, 0).getDate()

            const cells: (number | null)[] = []
            // Empty cells before first day
            for (let i = 0; i < startDow; i++) cells.push(null)
            // Day cells
            for (let d = 1; d <= daysInMonth; d++) cells.push(d)

            return { month, cells }
        })
    }, [year])

    const formatDate = (m: number, d: number) => {
        const mm = String(m + 1).padStart(2, '0')
        const dd = String(d).padStart(2, '0')
        return `${year}-${mm}-${dd}`
    }

    const handleDayClick = (m: number, d: number) => {
        const dateStr = formatDate(m, d)
        const games = gamesByDate.get(dateStr) || []
        setSelectedDay({ date: dateStr, games })
    }

    const availableYears = [2022, 2023, 2024, 2025, 2026]

    if (loading) return <p className="text-zinc-500 text-sm">A carregar jogos...</p>

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-black text-zinc-900 dark:text-white">
                    Calendário {year}
                </h2>
                <select
                    value={year}
                    onChange={e => setYear(parseInt(e.target.value))}
                    className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-bold text-zinc-700 dark:text-zinc-300"
                >
                    {availableYears.map(y => (
                        <option key={y} value={y}>{y}</option>
                    ))}
                </select>
            </div>

            {/* 4x3 month grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {months.map(({ month, cells }) => (
                    <div key={month}
                        className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-3">
                        <h3 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 text-center mb-2">
                            {MONTHS[month]}
                        </h3>

                        {/* Day headers */}
                        <div className="grid grid-cols-7 mb-1">
                            {DAYS_HEADER.map((d, i) => (
                                <span key={i}
                                    className="text-center text-[10px] text-zinc-400 font-bold py-0.5">
                                    {d}
                                </span>
                            ))}
                        </div>

                        {/* Day grid */}
                        <div className="grid grid-cols-7 gap-0.5">
                            {cells.map((day, i) => {
                                if (day === null) return <div key={`e${i}`} />
                                const dateStr = formatDate(month, day)
                                const hasGames = gamesByDate.has(dateStr)
                                const gameCount = gamesByDate.get(dateStr)?.length || 0

                                return (
                                    <button
                                        key={i}
                                        onClick={() => handleDayClick(month, day)}
                                        className={`aspect-square flex flex-col items-center justify-center rounded-md text-[11px] font-bold transition-colors ${
                                            hasGames
                                                ? 'bg-dribly-purple/10 text-dribly-purple hover:bg-dribly-purple/20'
                                                : 'text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                                        }`}
                                    >
                                        {day}
                                        {hasGames && (
                                            <span className="text-[8px] leading-none opacity-70">
                                                {gameCount}
                                            </span>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* Day modal */}
            {selectedDay && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
                    onClick={() => setSelectedDay(null)}>
                    <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 max-w-lg w-full mx-4 shadow-xl max-h-[80vh] overflow-y-auto"
                        onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-black text-zinc-900 dark:text-white">
                                {new Date(selectedDay.date + 'T00:00:00').toLocaleDateString('pt-PT', {
                                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                                })}
                            </h3>
                            <button onClick={() => setSelectedDay(null)}
                                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                                <X size={16} />
                            </button>
                        </div>

                        {selectedDay.games.length === 0 ? (
                            <p className="text-xs text-zinc-500">Nenhum jogo neste dia.</p>
                        ) : (
                            <div className="space-y-2">
                                {selectedDay.games.map((g, i) => (
                                    <div key={i}
                                        className="flex items-center gap-3 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 text-xs">
                                        <span className="font-bold text-zinc-900 dark:text-white min-w-0 truncate flex-1 text-right">
                                            {g.equipa_casa}
                                        </span>
                                        <span className="font-mono font-bold shrink-0 text-zinc-900 dark:text-white">
                                            {g.resultado_casa != null ? `${g.resultado_casa} - ${g.resultado_fora}` : g.hora || '—'}
                                        </span>
                                        <span className="font-bold text-zinc-900 dark:text-white min-w-0 truncate flex-1">
                                            {g.equipa_fora}
                                        </span>
                                        <span className={`text-[10px] font-bold shrink-0 px-1.5 py-0.5 rounded ${
                                            g.status === 'FINALIZADO'
                                                ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'
                                                : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                                        }`}>
                                            {g.status === 'FINALIZADO' ? 'Fim' : g.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
