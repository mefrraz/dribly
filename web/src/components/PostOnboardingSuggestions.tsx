import { useState, useEffect, useMemo } from 'react'
import { Heart, Trophy, ArrowRight, Loader2, Check, X, Search } from 'lucide-react'
import { useClub, type Club, displayName } from '../lib/ClubContext'
import { useFollows } from '../hooks/useFollows'
import { supabase } from '../lib/supabase'
import { markSuggestionsDone } from './suggestionsState'

// Re-export for backward compatibility
// eslint-disable-next-line react-refresh/only-export-components
export { isSuggestionsDone, markSuggestionsDone } from './suggestionsState'

interface Competition {
    competition_id: number
    competition_name: string
    association_name: string
}

const RECOMMENDED_CLUBS = [
    'futebol-clube-do-porto', 'sport-lisboa-e-benfica', 'sporting-clube-de-portugal', 'uni-o-desportiva-oliveirense',
    'sport-club-lusit-nia', 'vit-ria-sport-clube', 'clube-dos-galitos', 'clube-desportivo-da-p-voa',
    'sangalhos-desporto-clube', 'a-d-o-basquetebol-da-associa-o-desportiva-ovarense',
]

const COMP_SUGGESTIONS = [
    'Liga Betclic', 'Proliga', 'Taça de Portugal',
    'Troféu António Pratas', 'Campeonato Nacional Sub-18',
]

function normalize(s: string): string {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

interface Props {
    onComplete: () => void
}

export function PostOnboardingSuggestions({ onComplete }: Props) {
    const { clubs, loadClubs } = useClub()
    const { toggleFollow, follows } = useFollows()
    const [competitions, setCompetitions] = useState<Competition[]>([])
    const [loading, setLoading] = useState(true)

    const [step, setStep] = useState(0)
    const [visible, setVisible] = useState(false)
    const [exiting, setExiting] = useState(false)

    const [followedClubIds, setFollowedClubIds] = useState<Set<number>>(new Set())
    const [followedCompIds, setFollowedCompIds] = useState<Set<number>>(new Set())

    const [clubQuery, setClubQuery] = useState('')
    const [compQuery, setCompQuery] = useState('')
    const [compLogos, setCompLogos] = useState<Map<number, string>>(new Map())

    useEffect(() => { loadClubs() }, [loadClubs])

    useEffect(() => {
        supabase.from('competitions_meta').select('id, logo_url').then(({ data }) => {
            if (data) {
                const m = new Map<number, string>()
                ;(data as { id: number; logo_url: string | null }[]).forEach(r => { if (r.logo_url) m.set(r.id, r.logo_url) })
                setCompLogos(m)
            }
        })
    }, [])

    useEffect(() => {
        supabase
            .from('competitions')
            .select('competition_id, competition_name, association_name')
            .eq('season', '2025/2026')
            .then(({ data }) => {
                if (data) {
                    const seen = new Map<number, Competition>()
                    ;(data as Competition[]).forEach(c => {
                        if (!seen.has(c.competition_id)) seen.set(c.competition_id, c)
                    })
                    setCompetitions(Array.from(seen.values()))
                }
                setLoading(false)
            })
    }, [])

    useEffect(() => {
        setFollowedClubIds(new Set(follows.filter(f => f.entity_type === 'club').map(f => f.entity_id)))
        setFollowedCompIds(new Set(follows.filter(f => f.entity_type === 'competition').map(f => f.entity_id)))
    }, [follows])

    useEffect(() => {
        const t = setTimeout(() => setVisible(true), 300)
        return () => clearTimeout(t)
    }, [])

    // ---- Derived ----

    const recommendedClubs = RECOMMENDED_CLUBS
        .map(slug => clubs.find(c => c.slug === slug))
        .filter(Boolean) as Club[]

    const suggestedComps = competitions
        .filter(c => COMP_SUGGESTIONS.some(n => c.competition_name.toLowerCase().includes(n.toLowerCase())))
        .slice(0, 5)

    const clubSearchResults = useMemo(() => {
        if (!clubQuery.trim()) return [] as Club[]
        const q = normalize(clubQuery)
        return clubs
            .filter(c => normalize(c.name).includes(q))
            .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999))
            .slice(0, 8)
    }, [clubQuery, clubs])

    const compSearchResults = useMemo(() => {
        if (!compQuery.trim()) return [] as Competition[]
        const q = normalize(compQuery)
        return competitions
            .filter(c => normalize(c.competition_name).includes(q))
            .slice(0, 6)
    }, [compQuery, competitions])

    // ---- Actions ----

    const handleFollowClub = async (clubId: number) => {
        await toggleFollow('club', clubId)
        setFollowedClubIds(prev => {
            const next = new Set(prev)
            if (next.has(clubId)) {
                next.delete(clubId)
            } else {
                next.add(clubId)
            }
            return next
        })
    }

    const handleFollowComp = async (compId: number) => {
        await toggleFollow('competition', compId)
        setFollowedCompIds(prev => {
            const next = new Set(prev)
            if (next.has(compId)) {
                next.delete(compId)
            } else {
                next.add(compId)
            }
            return next
        })
    }

    const goTo = (s: number) => {
        setVisible(false)
        setTimeout(() => {
            setStep(s)
            setClubQuery('')
            setCompQuery('')
            setTimeout(() => setVisible(true), 80)
        }, 200)
    }

    const finish = () => {
        setExiting(true)
        setTimeout(() => {
            markSuggestionsDone()
            onComplete()
        }, 300)
    }

    // ---- Shared club row ----
    const renderClubRow = (club: Club) => {
        const isFollowed = followedClubIds.has(club.id)
        const active = isFollowed
        const bgClass = active
            ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400'
            : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300 hover:border-red-200 dark:hover:border-red-500/20'
        const icon = active ? <Heart size={14} className="text-red-500 fill-red-500 shrink-0" /> : <Heart size={14} className="text-zinc-300 shrink-0" />

        return (
            <button
                key={club.id}
                onClick={() => handleFollowClub(club.id)}
                className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-sm font-medium transition-all active:scale-[0.98] ${bgClass}`}
            >
                {club.logo_url ? (
                    <img src={club.logo_url} alt="" className="w-7 h-7 object-contain rounded-full shrink-0" />
                ) : (
                    <span className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-white/10 flex items-center justify-center text-[10px] font-bold shrink-0">
                        {displayName(club).charAt(0)}
                    </span>
                )}
                <span className="flex-1 text-left truncate">{displayName(club)}</span>
                {icon}
            </button>
        )
    }

    return (
        <div
            className={`fixed inset-0 z-[199] flex items-center justify-center p-4 transition-all duration-400 ${
                exiting ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
            }`}
        >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            <div
                className={`relative z-10 w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200 dark:border-white/10 p-6 transition-all duration-300 max-h-[85vh] overflow-y-auto ${
                    visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-[0.97]'
                }`}
            >
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 size={24} className="animate-spin text-dribly-purple" />
                    </div>
                ) : step === 0 ? (
                    /* ======== Step 0: Recommended clubs ======== */
                    <>
                        <button onClick={finish} className="absolute top-4 right-4 p-1.5 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"><X size={16} /></button>
                        <div className="w-12 h-12 mx-auto rounded-full bg-red-100 dark:bg-red-500/10 flex items-center justify-center mb-3"><Heart size={22} className="text-red-500 fill-red-500" /></div>
                        <h3 className="text-lg font-black text-zinc-900 dark:text-white text-center mb-1">Clubes recomendados</h3>
                        <p className="text-xs text-zinc-400 text-center mb-4">Segue os clubes que queres acompanhar.</p>

                        <div className="relative mb-4">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                            <input type="text" value={clubQuery} onChange={e => setClubQuery(e.target.value)} placeholder="Pesquisar qualquer clube..." className="w-full pl-9 pr-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 rounded-xl text-sm text-zinc-900 dark:text-white placeholder-zinc-400 outline-none transition-all focus:ring-2 focus:ring-dribly-purple/30 focus:border-dribly-purple" />
                            {clubQuery && <button onClick={() => setClubQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600"><X size={14} /></button>}
                        </div>

                        {clubSearchResults.length > 0 ? (
                            <div className="space-y-1.5 mb-5">{clubSearchResults.map(c => renderClubRow(c))}</div>
                        ) : (
                            <>
                                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Sugestões</p>
                                <div className="space-y-1.5 mb-5">{recommendedClubs.map(c => renderClubRow(c))}</div>
                            </>
                        )}

                        <div className="flex items-center justify-center gap-1.5 mb-4">
                            <div className="w-6 h-1.5 rounded-full bg-dribly-purple" />
                            <div className="w-1.5 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                        </div>
                        <button onClick={() => goTo(1)} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full bg-dribly-purple text-white text-sm font-bold hover:bg-dribly-purple/90 active:scale-[0.97] shadow-sm shadow-dribly-purple/20 transition-all">Seguinte <ArrowRight size={15} /></button>
                        <button onClick={finish} className="block mx-auto mt-3 text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">Saltar</button>
                    </>
                ) : (
                    /* ======== Step 1: Follow competitions ======== */
                    <>
                        <button onClick={finish} className="absolute top-4 right-4 p-1.5 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"><X size={16} /></button>
                        <div className="w-12 h-12 mx-auto rounded-full bg-dribly-purple/10 dark:bg-dribly-purple/20 flex items-center justify-center mb-3"><Trophy size={22} className="text-dribly-purple" /></div>
                        <h3 className="text-lg font-black text-zinc-900 dark:text-white text-center mb-1">Segue ligas</h3>
                        <p className="text-xs text-zinc-400 text-center mb-4">Resultados das tuas ligas favoritas.</p>

                        <div className="relative mb-4">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                            <input type="text" value={compQuery} onChange={e => setCompQuery(e.target.value)} placeholder="Pesquisar ligas..." className="w-full pl-9 pr-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 rounded-xl text-sm text-zinc-900 dark:text-white placeholder-zinc-400 outline-none transition-all focus:ring-2 focus:ring-dribly-purple/30 focus:border-dribly-purple" />
                            {compQuery && <button onClick={() => setCompQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600"><X size={14} /></button>}
                        </div>

                        <div className="space-y-1.5 mb-5">
                            {(compSearchResults.length > 0 ? compSearchResults : suggestedComps).map(comp => {
                                const isF = followedCompIds.has(comp.competition_id)
                                return (
                                    <button
                                        key={comp.competition_id}
                                        onClick={() => handleFollowComp(comp.competition_id)}
                                        className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-xs font-medium transition-all active:scale-[0.98] ${
                                            isF ? 'bg-dribly-purple/5 dark:bg-dribly-purple/10 border-dribly-purple/30 text-dribly-purple' : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 hover:border-dribly-purple/20'
                                        }`}
                                    >
                                        {compLogos.get(comp.competition_id) ? (
                                        <img src={compLogos.get(comp.competition_id)} alt="" className="w-5 h-5 object-contain shrink-0" />
                                    ) : (
                                        <Trophy size={14} className={isF ? 'text-dribly-purple' : 'text-zinc-300'} />
                                    )}
                                    <span className="flex-1 text-left truncate">{comp.competition_name}</span>
                                        {isF ? <Heart size={13} className="text-dribly-purple fill-dribly-purple shrink-0" /> : <Heart size={13} className="text-zinc-300 shrink-0" />}
                                    </button>
                                )
                            })}
                        </div>

                        <div className="flex items-center justify-center gap-1.5 mb-4">
                            <div className="w-1.5 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                            <div className="w-6 h-1.5 rounded-full bg-dribly-purple" />
                        </div>
                        <button onClick={finish} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full bg-green-500 text-white text-sm font-bold hover:bg-green-600 transition-all active:scale-[0.97] shadow-sm shadow-green-500/25">Começar <Check size={16} /></button>
                        <button onClick={finish} className="block mx-auto mt-3 text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">Mais tarde</button>
                    </>
                )}
            </div>
        </div>
    )
}
