import { useState, useRef, useEffect, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Search, Building2, Trophy } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { SeoHead } from '../components/SeoHead'
import { supabase } from '../lib/supabase'
import { useClub, type Club, displayName } from '../lib/ClubContext'
import { associationLogoUrl } from '../lib/associationLogos'
import { normalize, buildSearchText } from '../lib/clubSearch'

interface CompetitionResult {
    competition_id: number
    competition_name: string
    association_id: number
    association_name: string
}

function SearchPage() {
    const [searchParams] = useSearchParams()
    const initialQuery = searchParams.get('q') || ''
    const [query, setQuery] = useState(initialQuery)
    const [clubResults, setClubResults] = useState<Club[]>([])
    const [compResults, setCompResults] = useState<CompetitionResult[]>([])
    const [allComps, setAllComps] = useState<CompetitionResult[]>([])
    const [compLogoMap, setCompLogoMap] = useState<Map<number, string>>(new Map())
    const [compNameMap, setCompNameMap] = useState<Map<number, string>>(new Map())
    const inputRef = useRef<HTMLInputElement>(null)
    const navigate = useNavigate()
    const { clubs, loadClubs } = useClub()

    const normalizedClubs = useMemo(() =>
        clubs.map(c => ({ ...c, _n: buildSearchText(c) })),
    [clubs])

    useEffect(() => { loadClubs() }, [loadClubs])
    useEffect(() => { inputRef.current?.focus() }, [])

    useEffect(() => {
        supabase.from('competitions').select('competition_id, competition_name, association_id, association_name')
            .eq('season', '2025/2026').then(({ data }) => {
                if (data) {
                    const seen: Record<number, CompetitionResult> = {}
                    ;(data as CompetitionResult[]).forEach(r => {
                        if (!seen[r.competition_id]) seen[r.competition_id] = r
                    })
                    setAllComps(Object.values(seen))
                    // If initial query, trigger search
                    if (initialQuery) {
                        const q = normalize(initialQuery)
                        setClubResults(normalizedClubs.filter(c => c._n.includes(q)))
                        setCompResults(Object.values(seen).filter(c => normalize(c.competition_name).includes(q)))
                    }
                }
            })
        // Fetch competition logos
        supabase.from('competitions_meta').select('id, name, logo_url').then(({ data }) => {
            if (data) {
                const m = new Map<number, string>()
                ;(data as { id: number; name: string; logo_url: string | null }[]).forEach(r => { if (r.logo_url) m.set(r.id, r.logo_url) })
                setCompLogoMap(m)
                const nm = new Map<number, string>()
                ;(data as { id: number; name: string }[]).forEach(r => { nm.set(r.id, r.name) })
                setCompNameMap(nm)
            }
        }, () => {})
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        if (!query.trim()) {
            setClubResults([])
            setCompResults([])
            return
        }
        const q = normalize(query)
        setClubResults(normalizedClubs.filter(c => c._n.includes(q)).sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999)))
        if (allComps.length > 0) {
            setCompResults(allComps.filter(c => normalize(c.competition_name).includes(q)))
        }
    }, [query, normalizedClubs, allComps])

    const totalResults = clubResults.length + compResults.length

    return (
        <div className="max-w-2xl mx-auto px-4 pb-24">
            <SeoHead title="Pesquisa" description="Encontra clubes e competições de basquetebol em Portugal." />
            <PageHeader backTo="/" title="Pesquisar" />

            <div className="relative mb-8">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Search size={20} className="text-zinc-400" />
                </div>
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Pesquisar clubes e competições..."
                    className="w-full pl-12 pr-4 py-4 glass-card text-sm text-zinc-900 dark:text-white placeholder-zinc-400 outline-none shadow-lg transition-all"
                />
            </div>

            {query.trim() && (
                <div className="space-y-6">
                    {totalResults === 0 && (
                        <p className="text-sm text-zinc-500 text-center py-12">
                            Nenhum resultado encontrado para "{query}"
                        </p>
                    )}

                    {clubResults.length > 0 && (
                        <div className="">
                            <div className="flex items-center gap-2 mb-3">
                                <Building2 size={14} className="text-dribly-purple" />
                                <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Clubes ({clubResults.length})</h2>
                            </div>
                            <div className="space-y-2">
                                {clubResults.map(club => (
                                    <button
                                        key={club.slug}
                                        onClick={() => navigate('/clube/' + club.slug + '/home')}
                                        className="w-full text-left glass-card p-4 flex items-center gap-3 hover:border-dribly-purple/20 group transition-colors"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                                            {club.logo_url ? (
                                                <img src={club.logo_url} alt="" className="w-7 h-7 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                                            ) : null}
                                            <span className={club.logo_url ? 'hidden' : 'text-sm font-bold text-zinc-500'}>{displayName(club).charAt(0).toUpperCase()}</span>
                                        </div>
                                        <span className="text-sm font-bold text-zinc-900 dark:text-white group-hover:text-dribly-purple transition-colors truncate">{displayName(club)}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {compResults.length > 0 && (
                        <div className="">
                            <div className="flex items-center gap-2 mb-3">
                                <Trophy size={14} className="text-dribly-purple" />
                                <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Competições ({compResults.length})</h2>
                            </div>
                            <div className="space-y-2">
                                {compResults.map(comp => (
                                    <button
                                        key={comp.competition_id}
                                        onClick={() => navigate('/competicao/' + comp.competition_id)}
                                        className="w-full text-left glass-card p-4 flex items-center gap-3 hover:border-dribly-purple/20 group transition-colors"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                                            {compLogoMap.get(comp.competition_id) ? (
                                                <img src={compLogoMap.get(comp.competition_id)} alt="" className="w-6 h-6 object-contain" />
                                            ) : associationLogoUrl(comp.association_id) ? (
                                                <img src={associationLogoUrl(comp.association_id)!} alt="" className="w-6 h-6 object-contain" />
                                            ) : (
                                                <Trophy size={18} className="text-zinc-400" />
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <span className="text-sm font-bold text-zinc-900 dark:text-white group-hover:text-[var(--club-color)] transition-colors truncate block">{compNameMap.get(comp.competition_id) || comp.competition_name}</span>
                                            <span className="text-[10px] text-zinc-400">{comp.association_name}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

export default SearchPage
