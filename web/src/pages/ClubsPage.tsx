import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Search, Loader2, Heart } from 'lucide-react'
import { useClub, displayName } from '../lib/ClubContext'
import { useAuth } from '../lib/AuthContext'
import { useFollows } from '../hooks/useFollows'
import { normalize, buildSearchText } from '../lib/clubSearch'
import { supabase } from '../lib/supabase'

const prefetchedIds = new Set<number>()

function prefetchClubGames(clubId: number, clubName: string) {
    if (prefetchedIds.has(clubId)) return
    prefetchedIds.add(clubId)
    supabase
        .from('games_2025_2026')
        .select('*', { count: 'exact', head: true })
        .or(`equipa_casa.ilike.%${clubName}%,equipa_fora.ilike.%${clubName}%`)
        .order('data', { ascending: true })
        .then(() => undefined)
}

export default function ClubsPage() {
    const { clubs, loadClubs } = useClub()
    const { user } = useAuth()
    const { isFollowing, toggleFollow } = useFollows()
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadClubs().then(() => setLoading(false))
    }, [])

    const q = normalize(search)
    const filtered = q
        ? clubs.filter(c => buildSearchText(c).includes(q))
        : clubs

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-[#09090b] dark:via-zinc-950 dark:to-[#09090b]">
            <div className="max-w-6xl mx-auto px-3 sm:px-5 pt-6 pb-24">
                <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight mb-2 text-center">Clubes</h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center mb-6">
                    {clubs.length} clubes registados na FPB
                </p>

                {/* Search */}
                <div className="relative max-w-sm mx-auto mb-6">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Pesquisar clube..."
                        className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl text-sm text-zinc-900 dark:text-white placeholder-zinc-400 outline-none transition-all focus:ring-2 focus:ring-dribly-purple/30 focus:border-dribly-purple"
                    />
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <Loader2 className="animate-spin text-dribly-purple" size={28} />
                        <span className="text-sm text-zinc-400">A carregar clubes...</span>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16">
                        <p className="text-sm text-zinc-400">Nenhum clube encontrado.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                        {filtered.map(club => {
                            const isFol = user ? isFollowing('club', club.id) : false
                            return (
                                <div key={club.id} className="group relative">
                                    <Link
                                        to={`/clube/${club.slug}/home`}
                                        onMouseEnter={() => prefetchClubGames(club.id, club.name)}
                                        className="block bg-white dark:bg-zinc-900/90 border border-zinc-200/60 dark:border-zinc-800/60 rounded-2xl p-4 hover:border-dribly-purple/40 dark:hover:border-dribly-purple/40 hover:shadow-md transition-all duration-200 text-center"
                                    >
                                        <div className="w-16 h-16 mx-auto rounded-full bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center overflow-hidden mb-3 border border-zinc-100 dark:border-zinc-700/50 group-hover:scale-105 transition-transform">
                                            {club.logo_url ? (
                                                <img src={club.logo_url} alt="" className="w-12 h-12 object-contain" loading="lazy" />
                                            ) : (
                                                <span className="text-xl font-bold text-zinc-400">{displayName(club).charAt(0)}</span>
                                            )}
                                        </div>
                                        <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 leading-tight line-clamp-2">
                                            {displayName(club)}
                                        </p>
                                    </Link>
                                    {/* Action buttons */}
                                    {user && (
                                        <div className="absolute top-2 right-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={(e) => { e.preventDefault(); toggleFollow('club', club.id) }}
                                                className={`p-1 rounded-full transition-all ${
                                                    isFol ? 'text-dribly-purple bg-dribly-purple/10' : 'text-zinc-400 hover:text-dribly-purple bg-white dark:bg-zinc-800'
                                                }`}
                                                title={isFol ? 'Deixar de seguir' : 'Seguir'}>
                                                <Heart size={13} strokeWidth={isFol ? 2.5 : 2} fill={isFol ? 'currentColor' : 'none'} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
