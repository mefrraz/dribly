import { useEffect, useState, useMemo } from 'react'
import { Search, Play, Square, Clock, Star, Download } from 'lucide-react'
import { useAdminApi, type AdminClub } from '../../lib/adminApi'
import { useScraper } from '../../hooks/useScraper'

const SEASONS = ['2025/2026', '2024/2025', '2023/2024', '2022/2023']

function formatDate(iso: string | null): string {
    if (!iso) return '—'
    const d = new Date(iso)
    return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })
}

export default function ScrapeAdmin() {
    const api = useAdminApi()
    const [clubs, setClubs] = useState<AdminClub[]>([])
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showDates, setShowDates] = useState(false)

    const {
        selected, progress, running, summary,
        season, cleanBefore, lastScrapeDates,
        toggleClub, selectAll, deselectAll, selectPopular,
        setSeason, setCleanBefore, loadLastScrapeDates,
        startScrape, abort,
    } = useScraper(clubs)

    useEffect(() => {
        api.listClubs()
            .then(data => setClubs(data.clubs))
            .catch(e => setError(e.message))
            .finally(() => setLoading(false))
    }, [])

    const toggleShowDates = () => {
        if (!showDates) {
            loadLastScrapeDates()
        }
        setShowDates(!showDates)
    }

    const filtered = useMemo(() => {
        if (!search) return clubs
        return clubs.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    }, [clubs, search])

    if (loading) return <p className="text-zinc-500 text-sm">A carregar clubes...</p>
    if (error) return <p className="text-red-500 text-sm font-bold">Erro: {error}</p>

    return (
        <div>
            <h2 className="text-lg font-black text-zinc-900 dark:text-white mb-4">
                Atualizar Jogos
            </h2>

            {/* Controls row */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
                {/* Season selector */}
                <select
                    value={season}
                    onChange={e => setSeason(e.target.value)}
                    disabled={running}
                    className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-bold text-zinc-700 dark:text-zinc-300"
                >
                    {SEASONS.map(s => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>

                {/* Clean checkbox */}
                <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-600 dark:text-zinc-400 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900">
                    <input
                        type="checkbox"
                        checked={cleanBefore}
                        onChange={e => setCleanBefore(e.target.checked)}
                        disabled={running}
                        className="w-3.5 h-3.5 rounded border-zinc-300 text-dribly-purple"
                    />
                    Limpar antes
                </label>

                <div className="flex-1" />

                <a
                    href="https://raw.githubusercontent.com/mefrraz/dribly/main/scrapers/dribly-scraper.mjs"
                    download="dribly-scraper.mjs"
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-dribly-purple/10 hover:text-dribly-purple transition-colors flex items-center gap-1"
                    title="Descarrega o script para correr no teu PC (Node.js). Não gasta cota Vercel."
                >
                    <Download size={11} /> Script
                </a>

                <span className="text-xs text-zinc-400">
                    {selected.size}/{clubs.length} clubes
                </span>

                {/* Action buttons */}
                {!running ? (
                    <>
                        <button onClick={selectAll}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-dribly-purple/10 hover:text-dribly-purple transition-colors">
                            Todos
                        </button>
                        <button onClick={selectPopular}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-dribly-purple/10 hover:text-dribly-purple transition-colors flex items-center gap-1">
                            <Star size={11} /> Populares
                        </button>
                        <button onClick={deselectAll}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-dribly-purple/10 hover:text-dribly-purple transition-colors">
                            Nenhum
                        </button>
                        <button onClick={startScrape} disabled={selected.size === 0}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-dribly-purple text-white hover:bg-dribly-purple-dark transition-colors disabled:opacity-50 flex items-center gap-1.5">
                            <Play size={13} /> Atualizar
                        </button>
                    </>
                ) : (
                    <button onClick={abort}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-500 text-white hover:bg-red-600 transition-colors flex items-center gap-1.5">
                        <Square size={13} /> Parar
                    </button>
                )}
            </div>

            {/* Search + date toggle */}
            <div className="flex items-center gap-2 mb-4">
                <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input type="text" placeholder="Filtrar clubes..." value={search} onChange={e => setSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-dribly-purple" />
                </div>
                <button onClick={toggleShowDates}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 ${
                        showDates ? 'bg-dribly-purple/10 text-dribly-purple' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                    }`}>
                    <Clock size={11} /> Datas
                </button>
            </div>

            {/* Progress bar */}
            {progress && (
                <div className="mb-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-3">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-zinc-500">
                            {progress.current}/{progress.total} — {progress.clubName}
                        </span>
                        <span className="text-xs font-bold text-dribly-purple">{progress.newGames} jogos</span>
                    </div>
                    <div className="w-full h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-dribly-purple rounded-full transition-all duration-300"
                            style={{ width: `${(progress.current / progress.total) * 100}%` }} />
                    </div>
                </div>
            )}

            {/* Summary card */}
            {summary && (
                <div className="mb-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-3">Resumo</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div><span className="text-[10px] text-zinc-400 uppercase">Clubes</span>
                            <p className="text-lg font-black text-zinc-900 dark:text-white">{summary.totalClubs}</p></div>
                        <div><span className="text-[10px] text-zinc-400 uppercase">Jogos</span>
                            <p className="text-lg font-black text-zinc-900 dark:text-white">{summary.totalGames}</p></div>
                        <div><span className="text-[10px] text-zinc-400 uppercase">Erros</span>
                            <p className={`text-lg font-black ${summary.errors > 0 ? 'text-red-500' : 'text-emerald-500'}`}>{summary.errors}</p></div>
                        <div><span className="text-[10px] text-zinc-400 uppercase">Tempo</span>
                            <p className="text-lg font-black text-zinc-900 dark:text-white">{summary.durationSec}s</p></div>
                    </div>
                </div>
            )}

            {/* Club list */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                <div className="max-h-[55vh] overflow-y-auto">
                    {filtered.map(club => {
                        const isSel = selected.has(club.id)
                        const lastDate = lastScrapeDates[club.id]
                        return (
                            <label key={club.id}
                                className={`flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-950 transition-colors border-b border-zinc-50 dark:border-zinc-900 ${
                                    isSel ? 'bg-dribly-purple/5 dark:bg-dribly-purple/10' : ''}`}>
                                <input type="checkbox" checked={isSel} onChange={() => toggleClub(club.id)}
                                    disabled={running}
                                    className="w-4 h-4 rounded border-zinc-300 text-dribly-purple focus:ring-dribly-purple" />
                                {club.logo_url ? (
                                    <img src={club.logo_url} alt="" className="w-5 h-5 object-contain rounded shrink-0" />
                                ) : (
                                    <span className="w-5 h-5 rounded-full bg-zinc-100 dark:bg-white/10 flex items-center justify-center text-[9px] font-bold shrink-0">
                                        {club.name.charAt(0)}</span>
                                )}
                                <span className="text-xs text-zinc-700 dark:text-zinc-300 truncate">{club.name}</span>
                                {showDates && (
                                    <span className="text-[10px] text-zinc-400 shrink-0">{formatDate(lastDate || null)}</span>
                                )}
                                {!showDates && <span className="text-[10px] text-zinc-400 ml-auto shrink-0">#{club.id}</span>}
                            </label>
                        )
                    })}
                    {filtered.length === 0 && (
                        <p className="text-center py-8 text-zinc-400 text-xs">Nenhum clube encontrado.</p>
                    )}
                </div>
            </div>
        </div>
    )
}
