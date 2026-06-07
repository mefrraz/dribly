import { useEffect, useState } from 'react'
import { Search, Play, Square, CheckCircle, XCircle } from 'lucide-react'
import { useAdminApi, type AdminClub } from '../../lib/adminApi'
import { useScraper } from '../../hooks/useScraper'

export default function ScrapeAdmin() {
    const api = useAdminApi()
    const [clubs, setClubs] = useState<AdminClub[]>([])
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const {
        selected,
        progress,
        running,
        results,
        toggleClub,
        selectAll,
        deselectAll,
        startScrape,
        abort,
    } = useScraper(clubs)

    useEffect(() => {
        api.listClubs()
            .then(data => setClubs(data.clubs))
            .catch(e => setError(e.message))
            .finally(() => setLoading(false))
    }, [])

    const filtered = clubs.filter(c =>
        !search || c.name.toLowerCase().includes(search.toLowerCase()),
    )

    if (loading) return <p className="text-zinc-500 text-sm">A carregar clubes...</p>
    if (error) return <p className="text-red-500 text-sm font-bold">Erro: {error}</p>

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-black text-zinc-900 dark:text-white">
                    Atualizar Jogos ({selected.size}/{clubs.length})
                </h2>
                <div className="flex gap-2">
                    {!running ? (
                        <>
                            <button
                                onClick={selectAll}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-dribly-purple/10 hover:text-dribly-purple transition-colors"
                            >
                                Todos
                            </button>
                            <button
                                onClick={deselectAll}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-dribly-purple/10 hover:text-dribly-purple transition-colors"
                            >
                                Nenhum
                            </button>
                            <button
                                onClick={startScrape}
                                disabled={selected.size === 0}
                                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-dribly-purple text-white hover:bg-dribly-purple-dark transition-colors disabled:opacity-50 flex items-center gap-1.5"
                            >
                                <Play size={13} />
                                Atualizar
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={abort}
                            className="px-4 py-1.5 rounded-lg text-xs font-bold bg-red-500 text-white hover:bg-red-600 transition-colors flex items-center gap-1.5"
                        >
                            <Square size={13} />
                            Parar
                        </button>
                    )}
                </div>
            </div>

            {/* Search */}
            <div className="relative mb-4">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                    type="text"
                    placeholder="Filtrar clubes..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-dribly-purple"
                />
            </div>

            {/* Progress bar */}
            {progress && (
                <div className="mb-4">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-zinc-500">
                            {progress.current}/{progress.total} — {progress.clubName}
                        </span>
                        <span className="text-xs font-bold text-dribly-purple">
                            {progress.newGames} jogos
                        </span>
                    </div>
                    <div className="w-full h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-dribly-purple rounded-full transition-all duration-300"
                            style={{ width: `${(progress.current / progress.total) * 100}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Results summary */}
            {results.length > 0 && (
                <div className="mb-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-2">
                        Resultados
                    </h3>
                    <div className="text-xs text-zinc-500 space-y-1 max-h-48 overflow-y-auto">
                        {results.map((r, i) => (
                            <div key={i} className="flex items-center gap-2">
                                {r.errors.length === 0 ? (
                                    <CheckCircle size={12} className="text-emerald-500 shrink-0" />
                                ) : (
                                    <XCircle size={12} className="text-red-500 shrink-0" />
                                )}
                                <span className="truncate">{r.club}</span>
                                <span className="text-zinc-400 ml-auto shrink-0">{r.games} jogos</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Club list */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                <div className="max-h-[60vh] overflow-y-auto">
                    {filtered.map(club => {
                        const isSel = selected.has(club.id)
                        return (
                            <label
                                key={club.id}
                                className={`flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-950 transition-colors border-b border-zinc-50 dark:border-zinc-900 ${
                                    isSel ? 'bg-dribly-purple/5 dark:bg-dribly-purple/10' : ''
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={isSel}
                                    onChange={() => toggleClub(club.id)}
                                    disabled={running}
                                    className="w-4 h-4 rounded border-zinc-300 text-dribly-purple focus:ring-dribly-purple"
                                />
                                {club.logo_url ? (
                                    <img src={club.logo_url} alt="" className="w-5 h-5 object-contain rounded shrink-0" />
                                ) : (
                                    <span className="w-5 h-5 rounded-full bg-zinc-100 dark:bg-white/10 flex items-center justify-center text-[9px] font-bold shrink-0">
                                        {club.name.charAt(0)}
                                    </span>
                                )}
                                <span className="text-xs text-zinc-700 dark:text-zinc-300 truncate">
                                    {club.name}
                                </span>
                                <span className="text-[10px] text-zinc-400 ml-auto shrink-0">#{club.id}</span>
                            </label>
                        )
                    })}
                    {filtered.length === 0 && (
                        <p className="text-center py-8 text-zinc-400 text-xs">
                            Nenhum clube encontrado.
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
}
