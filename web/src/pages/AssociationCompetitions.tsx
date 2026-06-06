import { useState, useEffect, useMemo } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { Loader2, Trophy, Users, Calendar, ArrowLeft, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { associationLogoUrl } from '../lib/associationLogos'

function normalize(s: string): string {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function detectGender(n: string): 'M' | 'F' | 'O' {
    const u = n.toUpperCase()
    if (u.includes('FEMININ')) return 'F'
    if (u.includes('MASCULIN')) return 'M'
    if (u.includes('FEM') && !u.includes('MASC')) return 'F'
    if (u.includes('MASC')) return 'M'
    return 'O'
}

interface CompetitionMeta {
    competition_id: number; competition_name: string
    club_count: number; gender: 'M' | 'F' | 'O'
    logo_url: string | null
    abrev: string | null
    gradient_from: string
    gradient_to: string
    inLigas: boolean
}

export default function AssociationCompetitions() {
    const { associationId } = useParams<{ associationId: string }>()
    const navigate = useNavigate()
    const id = parseInt(associationId || '0')

    const [name, setName] = useState('')
    const [comps, setComps] = useState<CompetitionMeta[]>([])
    const [loading, setLoading] = useState(true)
    const [totalTeams, setTotalTeams] = useState(0)
    const [activeTab, setActiveTab] = useState<'M' | 'F' | 'O'>('M')
    const [searchQuery, setSearchQuery] = useState('')

    useEffect(() => {
        if (!id) return
        setLoading(true)
        loadData()
    }, [id])

    async function loadData() {
        const [compRes, metaRes] = await Promise.all([
            supabase.from('competitions')
                .select('competition_id, competition_name, association_name, club_names')
                .eq('season', '2025/2026').eq('association_id', id).order('competition_name'),
            supabase.from('competitions_meta').select('id, logo_url, abrev, gradient_from, gradient_to'),
        ])
        const data = compRes.data
        const metaData = metaRes.data as { id: number; logo_url: string | null; abrev: string | null; gradient_from: string; gradient_to: string }[] | null
        const metaMap = new Map<number, { logo_url: string | null; abrev: string | null; gradient_from: string; gradient_to: string }>()
        if (metaData) metaData.forEach(m => metaMap.set(m.id, m))

        if (data) {
            setName(data[0]?.association_name as string || '')
            const all = new Set<string>()
            const list: CompetitionMeta[] = data.map(r => {
                const names = Array.isArray(r.club_names) ? r.club_names as string[] : []
                names.forEach(n => all.add(n))
                const meta = metaMap.get(r.competition_id as number)
                return {
                    competition_id: r.competition_id as number,
                    competition_name: r.competition_name as string,
                    club_count: names.length,
                    gender: detectGender(r.competition_name as string),
                    logo_url: meta?.logo_url || null,
                    abrev: meta?.abrev || null,
                    gradient_from: meta?.gradient_from || 'from-dribly-purple',
                    gradient_to: meta?.gradient_to || 'to-purple-700',
                    inLigas: meta !== undefined,
                }
            })
            // Sort: competitions in Ligas first, then by name
            list.sort((a, b) => {
                if (a.inLigas !== b.inLigas) return a.inLigas ? -1 : 1
                return a.competition_name.localeCompare(b.competition_name)
            })
            setComps(list)
            setTotalTeams(all.size)
            if (list.some(c => c.gender === 'M')) setActiveTab('M')
            else if (list.some(c => c.gender === 'F')) setActiveTab('F')
            else setActiveTab('O')
        }
        setLoading(false)
    }

    const masculine = useMemo(() => comps.filter(c => c.gender === 'M'), [comps])
    const feminine = useMemo(() => comps.filter(c => c.gender === 'F'), [comps])
    const other = useMemo(() => comps.filter(c => c.gender === 'O'), [comps])

    const activeList = activeTab === 'M' ? masculine : activeTab === 'F' ? feminine : other
    const q = normalize(searchQuery)
    const filtered = q ? activeList.filter(c => normalize(c.competition_name).includes(q)) : activeList

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-[#09090b] dark:via-zinc-950 dark:to-[#09090b]">
            <div className="max-w-4xl mx-auto px-3 sm:px-5 pt-6 sm:pt-8 pb-16">
                <Link to="/classificacoes"
                    className="inline-flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors mb-6 group">
                    <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                    Associações
                </Link>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-4">
                        <Loader2 className="animate-spin text-dribly-purple" size={32} />
                    </div>
                ) : (
                    <>
                        <div className="bg-white dark:bg-zinc-900/90 rounded-3xl border border-zinc-200/60 dark:border-zinc-800/60 p-5 sm:p-6 shadow-sm mb-6 flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
                            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-800 dark:to-zinc-800/50 flex items-center justify-center p-3 shrink-0 border border-zinc-100 dark:border-zinc-700/50 shadow-inner">
                                <img src={associationLogoUrl(id) || ''} alt={name} className="w-full h-full object-contain"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                            </div>
                            <div className="flex-1 text-center sm:text-left min-w-0">
                                <h2 className="text-lg sm:text-xl font-black text-zinc-900 dark:text-white">{name}</h2>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">Época 2025/2026</p>
                                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 sm:gap-5 mt-3">
                                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                                        <Trophy size={13} className="text-dribly-purple" /> {comps.length} competições
                                    </span>
                                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                                        <Users size={13} className="text-emerald-500" /> {totalTeams} equipas
                                    </span>
                                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                                        <Calendar size={13} className="text-blue-500" /> {masculine.length} masc · {feminine.length} fem
                                    </span>
                                </div>
                            </div>
                        </div>

                        {(masculine.length > 0 || feminine.length > 0 || other.length > 0) && (
                            <>
                                <div className="flex gap-1.5 mb-4 bg-white dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800/60 rounded-2xl p-1.5 shadow-sm overflow-x-auto">
                                    {[{ label: 'Masculinas', key: 'M' as const, data: masculine },
                                      { label: 'Femininas', key: 'F' as const, data: feminine },
                                      { label: 'Outras', key: 'O' as const, data: other }]
                                      .filter(t => t.data.length > 0)
                                      .map(t => (
                                        <button key={t.key} onClick={() => { setActiveTab(t.key); setSearchQuery('') }}
                                            className={`shrink-0 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 ${
                                                activeTab === t.key ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-md' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                            }`}>
                                            {t.label}<span className="ml-1.5 opacity-50 text-[10px]">{t.data.length}</span>
                                        </button>
                                    ))}
                                </div>

                                {/* Search competitions */}
                                <div className="relative mb-4">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                                    <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                        placeholder="Pesquisar competição..."
                                        className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl text-xs font-medium text-zinc-900 dark:text-white placeholder-zinc-400 outline-none transition-all focus:ring-2 focus:ring-dribly-purple/30 focus:border-dribly-purple" />
                                </div>
                            </>
                        )}

                        {(() => {
                            if (!filtered.length) {
                                return <div className="text-center py-20 bg-white dark:bg-zinc-900/50 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60">
                                    <p className="text-zinc-400 font-medium">{searchQuery ? 'Nenhuma competição encontrada.' : 'Nenhuma competição nesta categoria.'}</p>
                                </div>
                            }
                            return (
                                <div className="space-y-2">
                                    {filtered.map(c => (
                                        <button key={c.competition_id}
                                            onClick={() => navigate(`/classificacoes/${id}/${c.competition_id}`)}
                                            className="w-full text-left bg-white dark:bg-zinc-900/90 hover:bg-zinc-50 dark:hover:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 hover:border-dribly-purple/30 dark:hover:border-dribly-purple/30 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-all duration-200 group flex items-center justify-between gap-4">
                                            <div className="min-w-0 flex items-center gap-3">
                                                <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 overflow-hidden shadow-sm border border-zinc-100 dark:border-zinc-700/50">
                                                    {c.logo_url ? (
                                                        <img src={c.logo_url} alt="" className="w-10 h-10 object-contain" />
                                                    ) : c.abrev ? (
                                                        <div className={`w-14 h-14 bg-gradient-to-br ${c.gradient_from} ${c.gradient_to} flex items-center justify-center`}>
                                                            <span className="text-[11px] font-black text-white">{c.abrev}</span>
                                                        </div>
                                                    ) : (
                                                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-800 dark:to-zinc-800/50 flex items-center justify-center">
                                                            <Trophy size={22} className="text-dribly-purple" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <h4 className="text-sm sm:text-base font-bold text-zinc-800 dark:text-zinc-200 group-hover:text-dribly-purple dark:group-hover:text-dribly-purple transition-colors leading-snug">{c.competition_name}</h4>
                                                </div>
                                            </div>
                                            <svg className="w-5 h-5 shrink-0 text-zinc-300 dark:text-zinc-600 group-hover:text-dribly-purple transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                                        </button>
                                    ))}
                                </div>
                            )
                        })()}

                        {comps.length === 0 && (
                            <div className="text-center py-20 bg-white dark:bg-zinc-900/50 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60">
                                <p className="text-zinc-400 font-medium">Nenhuma competição encontrada.</p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
