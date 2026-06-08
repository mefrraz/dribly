import { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Search, TrendingUp, Loader2, HelpCircle, X } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { SeoHead } from '../components/SeoHead'
import { useClub, type Club, displayName } from '../lib/ClubContext'
import { normalize } from '../lib/clubSearch'

function weightedElo(club: Club): number {
    const raw = club.elo_rating ?? 1500
    const p = club.priority ?? 4
    // Lower priority = bigger club: 1 → +300, 2 → +200, 3 → +100, 4+ → 0
    const bonus = p === 1 ? 300 : p === 2 ? 200 : p === 3 ? 100 : 0
    return raw + bonus
}

const SEASONS = ['2025/2026', '2024/2025', '2023/2024', '2022/2023', '2021/2022']

function Ranking() {
    const { clubs, loadClubs } = useClub()
    const [query, setQuery] = useState('')
    const [loading, setLoading] = useState(true)
    const [showHelp, setShowHelp] = useState(false)
    const [season, setSeason] = useState(SEASONS[0])

    useEffect(() => {
        loadClubs().finally(() => setLoading(false))
    }, [loadClubs])

    const ranked = useMemo(() => {
        return [...clubs].sort((a, b) => weightedElo(b) - weightedElo(a))
    }, [clubs])

    const filtered = useMemo(() => {
        if (!query.trim()) return ranked
        const q = normalize(query)
        return ranked.filter(c =>
            normalize(c.name).includes(q) ||
            normalize(c.search_name || '').includes(q)
        )
    }, [ranked, query])

    if (loading && clubs.length === 0) {
        return (
            <div className="max-w-xl mx-auto pb-24 px-3 flex items-center justify-center min-h-[50vh]">
                <Loader2 size={24} className="animate-spin text-dribly-purple" />
            </div>
        )
    }

    return (
        <div className="max-w-xl mx-auto pb-24 px-3">
            <SeoHead title="Ranking Nacional" description="Ranking ELO de todos os clubes de basquetebol português baseado em 24.000+ jogos." />
            <PageHeader title="Voltar" />

            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-base font-black text-zinc-900 dark:text-white">Ranking Nacional</h1>
                    <p className="text-[11px] text-zinc-400">{ranked.length} clubes ordenados por desempenho</p>
                </div>
                <button
                    onClick={() => setShowHelp(true)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                >
                    <HelpCircle size={13} />
                    Como funciona
                </button>
            </div>

            {/* Season selector */}
            <div className="flex items-center gap-2 mb-4">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Época</span>
                <select
                    value={season}
                    onChange={e => setSeason(e.target.value)}
                    className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 outline-none focus:ring-2 focus:ring-dribly-purple/30"
                >
                    {SEASONS.map(s => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>
                {season !== '2025/2026' && (
                    <span className="text-[10px] text-amber-500">(dados limitados)</span>
                )}
            </div>

            {/* Search */}
            <div className="relative mb-4">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Pesquisar clube..."
                    className="w-full pl-9 pr-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl text-sm text-zinc-900 dark:text-white placeholder-zinc-400 outline-none transition-all focus:ring-2 focus:ring-dribly-purple/30"
                />
            </div>

            {/* List */}
            <div className="glass-card divide-y divide-zinc-100 dark:divide-white/5">
                {filtered.length === 0 ? (
                    <p className="text-xs text-zinc-400 text-center py-12">Nenhum clube encontrado.</p>
                ) : (
                    filtered.map((club) => (
                        <Link
                            key={club.id}
                            to={`/clube/${club.slug}/home`}
                            className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-white/[0.03] transition-colors group"
                        >
                            {/* Posição */}
                            <span className="w-6 text-xs font-bold text-zinc-400 dark:text-zinc-500 text-right shrink-0">
                                {ranked.indexOf(club) + 1}
                            </span>

                            {/* Logo */}
                            <div className="w-8 h-8 shrink-0 rounded-full bg-zinc-100 dark:bg-white/10 flex items-center justify-center overflow-hidden">
                                {club.logo_url ? (
                                    <img src={club.logo_url} alt="" className="w-5 h-5 object-contain" />
                                ) : (
                                    <span className="text-[10px] font-bold text-zinc-500">
                                        {displayName(club).charAt(0)}
                                    </span>
                                )}
                            </div>

                            {/* Nome + prioridade se relevante */}
                            <div className="flex-1 min-w-0">
                                <span className="text-sm font-bold text-zinc-900 dark:text-white truncate block">
                                    {displayName(club)}
                                </span>
                            </div>

                            {/* ELO */}
                            <span className="text-sm font-mono font-bold text-dribly-purple shrink-0 ml-2">
                                {weightedElo(club)}
                            </span>
                        </Link>
                    ))
                )}
            </div>

            <p className="text-[10px] text-zinc-400 text-center mt-4 flex items-center justify-center gap-1">
                <TrendingUp size={11} />
                Atualizado diariamente · {ranked.length} clubes
            </p>

            {/* Help modal */}
            {showHelp && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={() => setShowHelp(false)}>
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                    <div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-white/10 p-5 max-w-sm w-full" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setShowHelp(false)} className="absolute top-3 right-3 p-1 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                            <X size={16} />
                        </button>
                        <h3 className="text-sm font-black text-zinc-900 dark:text-white mb-3">Como funciona o ranking</h3>
                        <div className="space-y-2.5 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                            <p>O <strong>ELO Rating</strong> é um sistema matemático usado no xadrez há 60 anos. Adaptado ao basquetebol português:</p>
                            <ul className="list-disc list-inside space-y-1">
                                <li>Cada clube começa com <strong>1500 pts</strong></li>
                                <li>Ganhar contra um clube <strong>mais forte</strong> → sobe muito</li>
                                <li>Ganhar contra um clube <strong>mais fraco</strong> → sobe pouco</li>
                                <li>Perder contra um mais fraco → desce muito</li>
                            </ul>
                            <p>A <strong>importância</strong> do clube também pesa: clubes de topo têm um bónus de <strong>+100 a +200 pts</strong>, refletindo a competitividade da divisão onde jogam.</p>
                            <p className="text-zinc-400">Baseado em 24.000+ jogos da época {season}. Atualizações diárias.</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Ranking
