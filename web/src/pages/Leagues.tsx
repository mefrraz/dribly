import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Heart, Search } from 'lucide-react'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { SeoHead } from '../components/SeoHead'
import { useFollows } from '../hooks/useFollows'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'

interface CompMeta {
    id: number; name: string; abrev: string; gradient_from: string; gradient_to: string; logo_url: string | null
}

const MASC_IDS = new Set([10902, 10903, 10904, 10905, 10909, 10910, 10912, 10914, 10915, 10917, 10919, 10921, 10922, 10955, 10957, 10958, 10974, 10976, 11078, 11160, 11162, 11164, 11166, 11168, 11170, 11172, 11174, 11176, 11383])
const FEM_IDS = new Set([10906, 10907, 10908, 10911, 10913, 10916, 10918, 10920, 10923, 10956, 10959, 10975, 11079, 11159, 11161, 11163, 11165, 11167, 11169, 11171, 11173, 11175, 11416])

export default function Leagues() {
    const { user } = useAuth()
    const { isFollowing, toggleFollow } = useFollows()
    const [comps, setComps] = useState<CompMeta[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

    useEffect(() => {
        supabase.from('competitions_meta').select('*').order('id').then(({ data }) => {
            if (data) setComps(data as CompMeta[])
            setLoading(false)
        })
    }, [])

    const q = search.toLowerCase().trim()
    const filtered = q ? comps.filter(c => c.name.toLowerCase().includes(q) || c.abrev.toLowerCase().includes(q)) : comps
    const masc = filtered.filter(c => MASC_IDS.has(c.id))
    const fem = filtered.filter(c => FEM_IDS.has(c.id))
    const outros = filtered.filter(c => !MASC_IDS.has(c.id) && !FEM_IDS.has(c.id))

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-[#09090b] dark:via-zinc-950 dark:to-[#09090b]">
            <SeoHead title="Ligas" description="Todas as competições da Federação Portuguesa de Basquetebol — masculinas e femininas." />
            <div className="max-w-4xl mx-auto px-3 sm:px-5 pt-6 sm:pt-8 pb-16">
                <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight mb-2 text-center">Ligas</h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center mb-6 max-w-md mx-auto">
                    Todas as competições da Federação Portuguesa de Basquetebol
                </p>

                <div className="relative mb-6">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Pesquisar competição..." autoComplete="off"
                        className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl text-xs font-medium text-zinc-900 dark:text-white placeholder-zinc-400 outline-none transition-all focus:ring-2 focus:ring-dribly-purple/30 focus:border-dribly-purple" />
                </div>

                {loading ? (
                    <LoadingSpinner />
                ) : (
                    <div className="space-y-8">
                        {masc.length > 0 && (
                            <Section title="Masculino" comps={masc} user={user} isFollowing={isFollowing} toggleFollow={toggleFollow} />
                        )}
                        {fem.length > 0 && (
                            <Section title="Feminino" comps={fem} user={user} isFollowing={isFollowing} toggleFollow={toggleFollow} />
                        )}
                        {outros.length > 0 && (
                            <Section title="Outras" comps={outros} user={user} isFollowing={isFollowing} toggleFollow={toggleFollow} />
                        )}
                        {filtered.length === 0 && !loading && (
                            <p className="text-center text-sm text-zinc-400 py-12">Nenhuma competição encontrada.</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

function Section({ title, comps, user, isFollowing, toggleFollow }: {
    title: string
    comps: CompMeta[]
    user: ReturnType<typeof useAuth>['user']
    isFollowing: ReturnType<typeof useFollows>['isFollowing']
    toggleFollow: ReturnType<typeof useFollows>['toggleFollow']
}) {
    return (
        <div>
            <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">{title} <span className="text-zinc-300 font-medium">{comps.length}</span></h2>
            <div className="space-y-2">
                {comps.map(c => (
                    <LeagueRow key={c.id} comp={c}
                        isFollowed={!!user && isFollowing('competition', c.id)}
                        showFollow={!!user}
                        onToggleFollow={() => toggleFollow('competition', c.id)} />
                ))}
            </div>
        </div>
    )
}

function LeagueRow({ comp, isFollowed, showFollow, onToggleFollow }: { comp: CompMeta; isFollowed: boolean; showFollow: boolean; onToggleFollow: () => void }) {
    return (
        <div className="group flex items-center gap-3 bg-white dark:bg-zinc-900/90 border border-zinc-200/60 dark:border-zinc-800/60 rounded-2xl p-4 hover:border-dribly-purple/40 dark:hover:border-dribly-purple/40 hover:shadow-md transition-all duration-200">
            <Link to={`/competicao/${comp.id}`} className="flex-1 min-w-0 flex items-center gap-3">
                {comp.logo_url ? (
                    <img src={comp.logo_url} alt="" className="w-12 h-12 rounded-2xl object-contain bg-white dark:bg-zinc-800 shrink-0 shadow-sm border border-zinc-100 dark:border-zinc-700" loading="lazy" />
                ) : (
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${comp.gradient_from} ${comp.gradient_to} flex items-center justify-center shrink-0 shadow-sm`}>
                        <span className="text-[9px] font-black text-white tracking-tight">{comp.abrev}</span>
                    </div>
                )}
                <div className="min-w-0">
                    <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 group-hover:text-dribly-purple dark:group-hover:text-dribly-purple transition-colors leading-tight line-clamp-1">{comp.name}</h3>
                </div>
                <svg className="w-4 h-4 shrink-0 text-zinc-300 group-hover:text-dribly-purple transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
            </Link>
            {showFollow && (
                <button onClick={(e) => { e.stopPropagation(); onToggleFollow() }}
                    className={`p-2 rounded-full transition-all active:scale-[0.9] ${isFollowed ? 'text-dribly-purple bg-dribly-purple/10 hover:bg-dribly-purple/20' : 'text-zinc-400 hover:text-dribly-purple hover:bg-dribly-purple/5'}`}>
                    <Heart size={16} strokeWidth={isFollowed ? 2.5 : 2} fill={isFollowed ? 'currentColor' : 'none'} />
                </button>
            )}
        </div>
    )
}
