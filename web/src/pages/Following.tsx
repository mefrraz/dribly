import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Star, Heart, LogIn, Search, Bookmark, X } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { useFollows } from '../hooks/useFollows'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { type Club, displayName } from '../lib/ClubContext'
import { fetchBounceClubs } from '../lib/fpbApi'
import { supabase } from '../lib/supabase'

interface FollowedComp {
    competition_id: number
    competition_name: string
    association_id: number
    association_name: string
}

export default function Following() {
    const { user } = useAuth()
    const { follows, loading: followsLoading, toggleFollow, refresh: refreshFollows } = useFollows()
    const navigate = useNavigate()

    const [followedClubs, setFollowedClubs] = useState<Club[]>([])
    const [followedComps, setFollowedComps] = useState<FollowedComp[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!user || follows.length === 0) {
            setFollowedClubs([])
            setFollowedComps([])
            setLoading(false)
            return
        }
        setLoading(true)
        loadData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, follows])

    async function loadData() {
        const clubIds = follows.filter(f => f.entity_type === 'club').map(f => f.entity_id)
        const compIds = follows.filter(f => f.entity_type === 'competition').map(f => f.entity_id)

        const [clubData, compData] = await Promise.all([
            clubIds.length > 0
                ? fetchBounceClubs().then(all => all.filter(c => clubIds.includes(c.id)))
                : Promise.resolve([] as Club[]),
            compIds.length > 0
                ? supabase.from('competitions').select('competition_id, competition_name, association_id, association_name').in('competition_id', compIds).eq('season', '2025/2026').then(({ data }) => {
                    const seen = new Map<number, FollowedComp>()
                    if (data) (data as FollowedComp[]).forEach(c => { if (!seen.has(c.competition_id)) seen.set(c.competition_id, c) })
                    return Array.from(seen.values())
                })
                : Promise.resolve([] as FollowedComp[]),
        ])

        setFollowedClubs(clubData)
        setFollowedComps(compData)
        setLoading(false)
    }

    const handleUnfollowClub = async (clubId: number) => {
        await toggleFollow('club', clubId)
        setFollowedClubs(prev => prev.filter(c => c.id !== clubId))
        await refreshFollows()
    }

    const handleUnfollowComp = async (compId: number) => {
        await toggleFollow('competition', compId)
        setFollowedComps(prev => prev.filter(c => c.competition_id !== compId))
        await refreshFollows()
    }

    // Not logged in
    if (!user) {
        return (
            <div className="max-w-xl mx-auto px-3 py-16 text-center">
                <div className="w-16 h-16 mx-auto rounded-full bg-dribly-purple/10 flex items-center justify-center mb-4">
                    <LogIn size={28} className="text-dribly-purple" />
                </div>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Inicia sessão</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6 max-w-xs mx-auto">
                    Inicia sessão para seguir os teus clubes e competições favoritos e aceder rapidamente a eles aqui.
                </p>
                <button
                    onClick={() => navigate('/')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-dribly-purple text-white text-sm font-bold hover:bg-dribly-purple/90 transition-all active:scale-[0.97] shadow-sm shadow-dribly-purple/20"
                >
                    <LogIn size={16} /> Iniciar sessão
                </button>
            </div>
        )
    }

    // Loading
    if (loading || followsLoading) {
        return (
            <div className="max-w-xl mx-auto px-3 py-16 text-center">
                <LoadingSpinner />
            </div>
        )
    }

    // Empty
    if (followedClubs.length === 0 && followedComps.length === 0) {
        return (
            <div className="max-w-xl mx-auto px-3 py-16 text-center">
                <div className="w-16 h-16 mx-auto rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
                    <Bookmark size={28} className="text-zinc-400" />
                </div>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Nada seguido</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6 max-w-xs mx-auto">
                    Usa a pesquisa para encontrar clubes e competições e começar a segui-los.
                </p>
                <Link to="/pesquisa"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-dribly-purple text-white text-sm font-bold hover:bg-dribly-purple/90 transition-all active:scale-[0.97] shadow-sm shadow-dribly-purple/20">
                    <Search size={16} /> Pesquisar
                </Link>
            </div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto px-3 sm:px-5 pt-6 pb-24">
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight mb-2 text-center">Seguidos</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center mb-8">Os teus clubes e competições favoritos</p>

            {/* Followed Clubs */}
            {followedClubs.length > 0 && (
                <div className="mb-8">
                    <div className="flex items-center gap-2 mb-3">
                        <Star size={16} className="text-dribly-purple" strokeWidth={2.5} />
                        <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Clubes ({followedClubs.length})</h2>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                        {followedClubs.map(club => (
                            <div key={club.id} className="group relative">
                                <Link to={`/clube/${club.slug}/home`}
                                    className="block bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl p-4 hover:border-dribly-purple/40 hover:shadow-md transition-all duration-200 text-center">
                                    <div className="w-14 h-14 mx-auto rounded-full bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center overflow-hidden mb-2 border border-zinc-100 dark:border-zinc-700">
                                        {club.logo_url ? (
                                            <img src={club.logo_url} alt="" className="w-10 h-10 object-contain" loading="lazy" decoding="async" />
                                        ) : (
                                            <span className="text-lg font-bold text-zinc-400">{displayName(club).charAt(0)}</span>
                                        )}
                                    </div>
                                    <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 leading-tight truncate">{displayName(club)}</p>
                                </Link>
                                <button
                                    onClick={(e) => { e.preventDefault(); handleUnfollowClub(club.id) }}
                                    className="absolute top-2 right-2 p-1 rounded-full bg-white dark:bg-zinc-800 text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Followed Competitions */}
            {followedComps.length > 0 && (
                <div className="mb-8">
                    <div className="flex items-center gap-2 mb-3">
                        <Heart size={16} className="text-dribly-purple" strokeWidth={2.5} />
                        <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Competições ({followedComps.length})</h2>
                    </div>
                    <div className="space-y-2">
                        {followedComps.map(comp => (
                            <div key={comp.competition_id} className="group flex items-center gap-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl p-4 hover:border-dribly-purple/40 hover:shadow-md transition-all duration-200">
                                <Link to={`/competicao/${comp.competition_id}`}
                                    className="flex-1 min-w-0 flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-dribly-purple/10 to-dribly-purple/5 flex items-center justify-center shrink-0">
                                        <TrophyIcon size={18} className="text-dribly-purple" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200 truncate">{comp.competition_name}</p>
                                        <p className="text-[11px] text-zinc-400">{comp.association_name}</p>
                                    </div>
                                    <svg className="w-4 h-4 shrink-0 text-zinc-300 group-hover:text-dribly-purple transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                                </Link>
                                <button
                                    onClick={() => handleUnfollowComp(comp.competition_id)}
                                    className="p-1.5 rounded-full text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

function TrophyIcon({ size, className }: { size: number; className?: string }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
            <path d="M4 22h16" />
            <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
            <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
            <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
        </svg>
    )
}
