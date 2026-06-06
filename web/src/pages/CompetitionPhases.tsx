import { useState, useEffect, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Search, ExternalLink } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { supabase } from '../lib/supabase'
import { useStandings } from '../hooks/useStandings'
import { StandingsTable } from '../components/StandingsTable'
import { Standing } from '../components/types'

function normalize(s: string): string {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

export default function CompetitionPhases() {
    const { associationId, competitionId } = useParams<{ associationId: string; competitionId: string }>()
    const assocId = parseInt(associationId || '0')
    const compId = parseInt(competitionId || '0')
    const season = '2025/2026'

    const [compName, setCompName] = useState('')
    const [assocName, setAssocName] = useState('')
    const [clubSearch, setClubSearch] = useState('')

    const { standings, loading, error } = useStandings(season, compId || null)

    useEffect(() => {
        if (!compId) return
        supabase.from('competitions')
            .select('competition_name, association_name')
            .eq('competition_id', compId).eq('season', season).single()
            .then(({ data }) => {
                if (data) {
                    setCompName(data.competition_name as string)
                    setAssocName(data.association_name as string)
                }
            })
    }, [compId])

    const getStatus = (teams: Standing[]): 'active' | 'finished' => {
        if (!teams.length) return 'finished'
        const hasFinishedData = teams.some(t => t.is_finished !== undefined)
        if (hasFinishedData) {
            return teams.every(t => t.is_finished === true) ? 'finished' : 'active'
        }
        if (teams.length >= 2 && teams.every(t => t.jogos > 0)) {
            const maxGames = Math.max(...teams.map(t => t.jogos))
            const minGames = Math.min(...teams.map(t => t.jogos))
            const expected = (teams.length - 1) * 2
            if (minGames >= expected * 0.9 && maxGames - minGames <= 2) return 'finished'
        }
        return 'active'
    }

    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
    const groups = useMemo(() => [...new Set(standings.map(s => s.grupo))].sort((a, b) => b.localeCompare(a)), [standings])
    const toggleGroup = (g: string) => setOpenGroups(p => ({ ...p, [g]: !p[g] }))
    const isOpen = (g: string) => openGroups[g] ?? false

    // Club search
    const q = normalize(clubSearch)
    const filteredStandings = q.length > 0
        ? standings.filter(s => normalize(s.equipa).includes(q))
        : standings

    const filteredGroups = useMemo(() => {
        if (q.length === 0) return groups
        const matching = new Set(filteredStandings.map(s => s.grupo))
        return groups.filter(g => matching.has(g))
    }, [q, groups, filteredStandings])

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-[#09090b] dark:via-zinc-950 dark:to-[#09090b]">
            <div className="max-w-4xl mx-auto px-3 sm:px-5 pt-6 sm:pt-8 pb-16">
                <PageHeader backTo={`/classificacoes/${assocId}`} title={assocName || 'Competições'} />

                <div className="mb-6">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight line-clamp-2">
                                {compName || 'Competição'}
                            </h1>
                            {assocName && (
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium mt-1">
                                    {assocName} · {season}
                                </p>
                            )}
                        </div>
                        <Link
                            to={`/competicao/${compId}`}
                            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-dribly-purple text-white text-xs font-bold hover:bg-dribly-purple-dim transition-colors active:scale-[0.97] shadow-sm shadow-dribly-purple/20"
                        >
                            <ExternalLink size={13} />
                            <span className="hidden sm:inline">Página da</span> Competição
                        </Link>
                    </div>
                </div>

                {loading ? (
                    <LoadingSpinner message="A atualizar classificações..." />
                ) : error ? (
                    <div className="text-center py-20 bg-white dark:bg-zinc-900/50 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60">
                        <p className="text-zinc-500 font-medium">{error}</p>
                    </div>
                ) : groups.length === 0 ? (
                    <div className="text-center py-20 bg-white dark:bg-zinc-900/50 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60">
                        <p className="text-zinc-400 font-medium">Sem classificações disponíveis.</p>
                    </div>
                ) : (
                    <>
                        {/* Club search */}
                        <div className="relative mb-5">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                            <input type="text" value={clubSearch} onChange={e => setClubSearch(e.target.value)}
                                placeholder="Pesquisar clube nesta competição..."
                                className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl text-xs font-medium text-zinc-900 dark:text-white placeholder-zinc-400 outline-none transition-all focus:ring-2 focus:ring-dribly-purple/30 focus:border-dribly-purple" />
                        </div>

                        <div className="space-y-3 mb-10">
                            {filteredGroups.map(g => {
                                const t = (q.length > 0 ? filteredStandings : standings).filter(s => s.grupo === g)
                                return <StandingsTable key={g} grupo={g} teams={t} isOpen={isOpen(g) || q.length > 0} onToggle={() => toggleGroup(g)} status={getStatus(t)} />
                            })}
                        </div>
                        <div className="text-center border-t border-zinc-200 dark:border-zinc-800 pt-6">
                            <div className="inline-flex flex-wrap gap-4 text-[10px] font-medium text-zinc-400 justify-center">
                                <span><span className="font-bold text-zinc-500 dark:text-zinc-300">Pts</span> · Pontos</span>
                                <span><span className="font-bold text-zinc-500 dark:text-zinc-300">J</span> · Jogos</span>
                                <span><span className="font-bold text-zinc-500 dark:text-zinc-300">V</span> · Vitórias</span>
                                <span><span className="font-bold text-zinc-500 dark:text-zinc-300">D</span> · Derrotas</span>
                            </div>
                        </div>
                    </>
                )}
            </div>
            <style>{`.duration-600{transition-duration:600ms}.line-clamp-2{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}`}</style>
        </div>
    )
}