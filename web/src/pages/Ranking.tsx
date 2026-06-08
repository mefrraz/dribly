import { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Search, Trophy, TrendingUp } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { SeoHead } from '../components/SeoHead'
import { useClub, type Club, displayName } from '../lib/ClubContext'
import { normalize } from '../lib/clubSearch'

function Ranking() {
    const { clubs, loadClubs } = useClub()
    const [query, setQuery] = useState('')

    useEffect(() => { loadClubs() }, [loadClubs])

    // Sort clubs by ELO descending, fallback to 1500
    const ranked = useMemo(() => {
        return [...clubs]
            .sort((a, b) => (b.elo_rating ?? 1500) - (a.elo_rating ?? 1500))
    }, [clubs])

    const filtered = useMemo(() => {
        if (!query.trim()) return ranked
        const q = normalize(query)
        return ranked.filter(c =>
            normalize(c.name).includes(q) ||
            normalize(c.search_name || '').includes(q)
        )
    }, [ranked, query])

    const maxElo = ranked[0]?.elo_rating ?? 2000
    const minElo = ranked[ranked.length - 1]?.elo_rating ?? 1000

    return (
        <div className="max-w-2xl mx-auto pb-24 px-3">
            <SeoHead title="Ranking Nacional" description="Ranking ELO de todos os clubes de basquetebol português baseado em 23 épocas e 15.000+ jogos." />
            <PageHeader title="Voltar" />

            {/* Hero */}
            <div className="mb-5">
                <h1 className="text-xl font-black text-zinc-900 dark:text-white flex items-center gap-2">
                    <Trophy size={22} className="text-dribly-purple" />
                    Ranking Nacional
                </h1>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                    Baseado no sistema <strong>ELO Rating</strong> — 23 épocas, 15.000+ jogos.
                    Cada vitória sobe o rating; derrotas contra equipas mais fracas pesam mais.
                </p>
            </div>

            {/* Search */}
            <div className="relative mb-4">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Pesquisar clube..."
                    className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl text-sm text-zinc-900 dark:text-white placeholder-zinc-400 outline-none transition-all focus:ring-2 focus:ring-dribly-purple/30"
                />
            </div>

            {/* Ranking list */}
            <div className="space-y-1">
                {filtered.length === 0 ? (
                    <p className="text-xs text-zinc-400 text-center py-8">Nenhum clube encontrado.</p>
                ) : (
                    filtered.map((club) => (
                        <RankRow
                            key={club.id}
                            club={club}
                            position={ranked.indexOf(club) + 1}
                            maxElo={maxElo}
                            minElo={minElo}
                        />
                    ))
                )}
            </div>

            {/* Footer note */}
            <div className="mt-6 text-center">
                <p className="text-[10px] text-zinc-400 flex items-center justify-center gap-1">
                    <TrendingUp size={12} />
                    Rating atualizado diariamente
                </p>
            </div>
        </div>
    )
}

function RankRow({ club, position, maxElo, minElo }: { club: Club; position: number; maxElo: number; minElo: number }) {
    const elo = club.elo_rating ?? 1500
    const range = maxElo - minElo || 1
    const pct = Math.round(((elo - minElo) / range) * 100)

    // Position badge color
    const posColors: Record<number, string> = {
        1: 'bg-yellow-400 text-yellow-900',
        2: 'bg-zinc-300 dark:bg-zinc-500 text-zinc-700 dark:text-zinc-200',
        3: 'bg-amber-600 text-white',
    }

    const posStyle = posColors[position]
        ? `w-6 h-6 rounded-full ${posColors[position]} flex items-center justify-center text-[11px] font-black`
        : 'w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[11px] font-bold text-zinc-500 dark:text-zinc-400'

    return (
        <Link
            to={`/clube/${club.slug}/home`}
            className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors active:scale-[0.99]"
        >
            {/* Position */}
            <div className="shrink-0 w-8 flex justify-center">
                <span className={posStyle}>
                    {position}
                </span>
            </div>

            {/* Logo */}
            <div className="w-9 h-9 shrink-0 rounded-full bg-zinc-100 dark:bg-white/10 flex items-center justify-center overflow-hidden">
                {club.logo_url ? (
                    <img src={club.logo_url} alt="" className="w-7 h-7 object-contain" />
                ) : (
                    <span className="text-xs font-bold text-zinc-500">
                        {displayName(club).charAt(0).toUpperCase()}
                    </span>
                )}
            </div>

            {/* Name + bar */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-zinc-900 dark:text-white truncate">
                        {displayName(club)}
                    </span>
                    <span className="text-sm font-mono font-black text-dribly-purple ml-2 shrink-0">
                        {elo}
                    </span>
                </div>
                {/* Strength bar */}
                <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-dribly-purple to-purple-400 transition-all"
                        style={{ width: `${pct}%` }}
                    />
                </div>
            </div>
        </Link>
    )
}

export default Ranking
