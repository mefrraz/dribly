import { useState, useMemo, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, TrendingUp, Loader2, HelpCircle, X } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { SeoHead } from '../components/SeoHead'
import { supabase } from '../lib/supabase'
import { normalize } from '../lib/clubSearch'

interface RankedClub {
    id: number
    name: string
    slug: string
    search_name: string
    logo_url: string | null
    priority: number | null
    elo: number
}

const SEASONS = [
    '2025/2026', '2024/2025', '2023/2024', '2022/2023', '2021/2022', '2020/2021',
    '2019/2020', '2018/2019', '2017/2018', '2016/2017', '2015/2016', '2014/2015',
    '2013/2014', '2012/2013', '2011/2012', '2010/2011', '2009/2010', '2008/2009',
    '2007/2008', '2006/2007', '2005/2006', '2004/2005', '2003/2004',
]

function displayName(club: { name: string; short_name?: string | null }): string {
    return club.short_name || club.name
}

function Ranking() {
    const [query, setQuery] = useState('')
    const [loading, setLoading] = useState(true)
    const [showHelp, setShowHelp] = useState(false)
    const [season, setSeason] = useState(SEASONS[0])
    const [nivel, setNivel] = useState<number>(1)
    const [clubs, setClubs] = useState<RankedClub[]>([])
    const [highlight, setHighlight] = useState<string | null>(null)
    const [searchParams] = useSearchParams()
    const highlightRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        setLoading(true)
        Promise.all([
            supabase.from('clubs').select('id, name, slug, search_name, logo_url, priority').order('name'),
            supabase.from('club_elo_history').select('club_id, elo_rating').eq('season', season),
        ]).then(([{ data: allClubs }, { data: eloData }]) => {
            if (allClubs) {
                const eloMap = new Map<number, number>()
                if (eloData) {
                    for (const row of eloData as { club_id: number; elo_rating: number }[]) {
                        eloMap.set(row.club_id, row.elo_rating)
                    }
                }
                const ranked = (allClubs as RankedClub[]).map(c => ({
                    ...c,
                    elo: Math.round(eloMap.get(c.id) ?? 1500),
                })).sort((a, b) => b.elo - a.elo)
                setClubs(ranked)

                // Auto-select level from ?destaque= param
                const slug = searchParams.get('destaque')
                if (slug) {
                    const club = ranked.find(c => c.slug === slug)
                    if (club && club.priority) {
                        setNivel(club.priority)
                    }
                }
            }
            setLoading(false)
        })
    }, [season, searchParams])

    // Highlight club from ?destaque= param
    useEffect(() => {
        const slug = searchParams.get('destaque')
        if (slug && clubs.length > 0 && !loading) {
            setHighlight(slug)
            setTimeout(() => {
                highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                setTimeout(() => setHighlight(null), 2000)
            }, 300)
        }
    }, [clubs, loading, searchParams])

    const filtered = useMemo(() => {
        let result = clubs
        if (nivel > 0) {
            result = result.filter(c => c.priority === nivel)
        }
        if (query.trim()) {
            const q = normalize(query)
            result = result.filter(c =>
                normalize(c.name).includes(q) ||
                normalize(c.search_name || '').includes(q)
            )
        }
        return result
    }, [clubs, query, nivel])

    if (loading) {
        return (
            <div className="max-w-xl mx-auto pb-24 px-3 flex items-center justify-center min-h-[50vh]">
                <Loader2 size={24} className="animate-spin text-dribly-purple" />
            </div>
        )
    }

    return (
        <div className="max-w-xl mx-auto pb-24 px-3">
            <SeoHead title="Ranking Nacional" description="Ranking ELO de todos os clubes de basquetebol português por época." />
            <PageHeader title="Voltar" />

            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-base font-black text-zinc-900 dark:text-white">Ranking Nacional</h1>
                    <p className="text-[11px] text-zinc-400">{clubs.length} clubes em {season}</p>
                </div>
                <button
                    onClick={() => setShowHelp(true)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                >
                    <HelpCircle size={13} />
                    Como funciona
                </button>
            </div>

            {/* Season + Nível selectors */}
            <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Época</span>
                    <select
                        value={season}
                        onChange={e => setSeason(e.target.value)}
                        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 outline-none focus:ring-2 focus:ring-dribly-purple/30"
                    >
                        {SEASONS.map(s => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Nível</span>
                    <select
                        value={nivel}
                        onChange={e => setNivel(parseInt(e.target.value))}
                        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 outline-none focus:ring-2 focus:ring-dribly-purple/30"
                    >
                        <option value="0">Todos</option>
                        <option value="1">1 - Liga Betclic</option>
                        <option value="2">2 - Proliga / 1ª Div</option>
                        <option value="3">3 - 1ª / 2ª Div</option>
                        <option value="4">4 - 2ª Divisão</option>
                        <option value="5">5 - Distrital / Regional</option>
                    </select>
                </div>
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
                        filtered.map((club, i) => (
                            <div
                                key={club.id}
                                ref={club.slug === highlight ? highlightRef : undefined}
                            >
                                <Link
                                to={`/clube/${club.slug}/home`}
                                className={`flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-white/[0.03] transition-colors group ${club.slug === highlight ? 'bg-dribly-purple/10 dark:bg-dribly-purple/20 ring-1 ring-dribly-purple/30' : ''}`}
                            >
                                <span className="w-6 text-xs font-bold text-zinc-400 dark:text-zinc-500 text-right shrink-0">
                                    {i + 1}
                                </span>

                                <div className="w-8 h-8 shrink-0 rounded-full bg-zinc-100 dark:bg-white/10 flex items-center justify-center overflow-hidden">
                                    {club.logo_url ? (
                                        <img src={club.logo_url} alt="" className="w-5 h-5 object-contain" loading="lazy" decoding="async" />
                                    ) : (
                                        <span className="text-[10px] font-bold text-zinc-500">
                                            {club.name.charAt(0)}
                                        </span>
                                    )}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <span className="text-sm font-bold text-zinc-900 dark:text-white truncate block">
                                        {displayName(club)}
                                    </span>
                                </div>

                                <span className="text-sm font-mono font-bold text-dribly-purple shrink-0 ml-2">
                                    {club.elo}
                                </span>
                            </Link>
                            </div>
                        ))
                    )}
                </div>

            <p className="text-[10px] text-zinc-400 text-center mt-4 flex items-center justify-center gap-1">
                <TrendingUp size={11} />
                Atualizado diariamente · {clubs.length} clubes
            </p>

            {/* Help modal */}
            {showHelp && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={() => setShowHelp(false)}>
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                    <div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-white/10 p-5 max-w-sm w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setShowHelp(false)} className="absolute top-3 right-3 p-1 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                            <X size={16} />
                        </button>
                        <h3 className="text-sm font-black text-zinc-900 dark:text-white mb-3">Como funciona o ranking</h3>
                        <div className="space-y-3 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                            <p>Baseado no sistema <strong>ELO Rating</strong>, usado no xadrez profissional desde 1960. Não mede "qual o maior clube" — mede <strong>desempenho dentro das competições disputadas</strong> nessa época.</p>

                            <div>
                                <p className="font-bold text-zinc-700 dark:text-zinc-300 mb-1">Regras básicas:</p>
                                <ul className="list-disc list-inside space-y-0.5">
                                    <li>Todos começam com 1.500 pts por época</li>
                                    <li>Vencer um adversário com rating <strong>superior</strong> ao teu → ganhas muitos pontos</li>
                                    <li>Vencer um adversário com rating <strong>inferior</strong> → ganhas poucos pontos</li>
                                    <li>Perder com um adversário de rating inferior → perdes muitos pontos</li>
                                </ul>
                            </div>

                            <div>
                                <p className="font-bold text-zinc-700 dark:text-zinc-300 mb-1">Níveis dos clubes:</p>
                                <p className="mb-1">Baseado nos <strong>jogos disputados em competições nacionais</strong> da época 2025/2026:</p>
                                <div className="space-y-1 mt-1.5">
                                    <div className="flex items-center gap-2"><span className="text-dribly-purple font-bold">-</span><span><strong>Nível 1</strong> - Liga Betclic</span></div>
                                    <div className="flex items-center gap-2"><span className="text-blue-500 font-bold">-</span><span><strong>Nível 2</strong> - Proliga / 1ª Divisão</span></div>
                                    <div className="flex items-center gap-2"><span className="text-green-500 font-bold">-</span><span><strong>Nível 3</strong> - 1ª / 2ª Divisão</span></div>
                                    <div className="flex items-center gap-2"><span className="text-amber-500 font-bold">-</span><span><strong>Nível 4</strong> - 2ª Divisão / Sub-23</span></div>
                                    <div className="flex items-center gap-2"><span className="text-zinc-400 font-bold">-</span><span><strong>Nível 5</strong> - Distrital / Regional</span></div>
                                </div>
                            </div>

                            <p className="text-zinc-400">Cada época é independente — o rating recomeça nos 1.500 pts. {clubs.filter(c => c.elo !== 1500).length} clubes com jogos registados na época {season}.</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Ranking
