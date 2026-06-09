import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Heart, Search } from 'lucide-react'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { SeoHead } from '../components/SeoHead'
import { useFollows } from '../hooks/useFollows'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'

interface Competition {
    competition_id: number
    competition_name: string
    association_name: string
}

const MASC_IDS = new Set([10902, 10903, 10904, 10905, 10909, 10910, 10912, 10914, 10915, 10917, 10919, 10921, 10922, 10955, 10957, 10958, 10974, 10976, 11078, 11160, 11162, 11164, 11166, 11168, 11170, 11172, 11174, 11176, 11383])
const FEM_IDS = new Set([10906, 10907, 10908, 10911, 10913, 10916, 10918, 10920, 10923, 10956, 10959, 10975, 11079, 11159, 11161, 11163, 11165, 11167, 11169, 11171, 11173, 11175, 11416])

export default function Leagues() {
    const { user } = useAuth()
    const { isFollowing, toggleFollow } = useFollows()
    const [comps, setComps] = useState<Competition[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

    useEffect(() => {
        supabase
            .from('competitions')
            .select('competition_id, competition_name, association_name')
            .eq('season', '2025/2026')
            .order('competition_name')
            .then(({ data }) => {
                if (data) {
                    // Deduplicate by competition_id
                    const seen = new Map<number, Competition>()
                    for (const c of data as Competition[]) {
                        if (!seen.has(c.competition_id)) seen.set(c.competition_id, c)
                    }
                    setComps(Array.from(seen.values()))
                }
                setLoading(false)
            })
    }, [])

    const q = search.toLowerCase()
    const filtered = q
        ? comps.filter(c => c.competition_name.toLowerCase().includes(q))
        : comps
    const masc = filtered.filter(c => MASC_IDS.has(c.competition_id))
    const fem = filtered.filter(c => FEM_IDS.has(c.competition_id))
    const outros = filtered.filter(c => !MASC_IDS.has(c.competition_id) && !FEM_IDS.has(c.competition_id))

    return (
        <div className="max-w-2xl mx-auto pb-24 px-3">
            <SeoHead title="Ligas" description="Todas as competições da Federação Portuguesa de Basquetebol — masculinas e femininas." />
            <h1 className="text-base font-black text-zinc-900 dark:text-white mb-1">Ligas</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">{comps.length} competições na época 2025/2026</p>

            <div className="relative mb-5">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Pesquisar competição..."
                    className="w-full pl-9 pr-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl text-sm text-zinc-900 dark:text-white placeholder-zinc-400 outline-none transition-all focus:ring-2 focus:ring-dribly-purple/30" />
            </div>

            {loading ? (
                <LoadingSpinner />
            ) : filtered.length === 0 ? (
                <p className="text-xs text-zinc-400 text-center py-12">Nenhuma competição encontrada.</p>
            ) : (
                <div className="space-y-6">
                    {masc.length > 0 && (
                        <Section title="Masculino" comps={masc} user={user} isFollowing={isFollowing} toggleFollow={toggleFollow} />
                    )}
                    {fem.length > 0 && (
                        <Section title="Feminino" comps={fem} user={user} isFollowing={isFollowing} toggleFollow={toggleFollow} />
                    )}
                    {outros.length > 0 && (
                        <Section title="Outras" comps={outros} user={user} isFollowing={isFollowing} toggleFollow={toggleFollow} />
                    )}
                </div>
            )}
        </div>
    )
}

function Section({ title, comps, user, isFollowing, toggleFollow }: {
    title: string
    comps: Competition[]
    user: ReturnType<typeof useAuth>['user']
    isFollowing: ReturnType<typeof useFollows>['isFollowing']
    toggleFollow: ReturnType<typeof useFollows>['toggleFollow']
}) {
    return (
        <div>
            <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">
                {title} <span className="text-zinc-300 font-medium">{comps.length}</span>
            </h2>
            <div className="space-y-1.5">
                {comps.map(c => (
                    <div key={c.competition_id} className="flex items-center gap-3 bg-white dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-3 hover:border-dribly-purple/30 transition-colors">
                        <Link to={`/competicao/${c.competition_id}`} className="flex-1 min-w-0">
                            <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 truncate">{c.competition_name}</h3>
                            <p className="text-[10px] text-zinc-400 truncate">{c.association_name}</p>
                        </Link>
                        {user && (
                            <button onClick={() => toggleFollow('competition', c.competition_id)}
                                className={`p-1.5 rounded-full transition-all active:scale-[0.9] ${isFollowing('competition', c.competition_id) ? 'text-dribly-purple bg-dribly-purple/10' : 'text-zinc-400 hover:text-dribly-purple'}`}>
                                <Heart size={15} strokeWidth={2} fill={isFollowing('competition', c.competition_id) ? 'currentColor' : 'none'} />
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}
