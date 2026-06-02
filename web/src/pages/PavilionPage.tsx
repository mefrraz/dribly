/**
 * Pavilion detail page on Dribly.
 * Route: /pavilhao/:recintoId
 *
 * Tabs:
 *   Geral    — pavilion info (name, address, map preview)
 *   Agenda   — upcoming games at this pavilion
 *   Resultados — past results at this pavilion
 */
import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Loader2, MapPin, CalendarDays, Trophy, Info } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Pavilion } from '../lib/mapData'
import { GameCard } from '../components/GameCard'
import type { Match } from '../components/types'

type Tab = 'geral' | 'agenda' | 'resultados'

export default function PavilionPage() {
    const { recintoId } = useParams<{ recintoId: string }>()
    const [pavilion, setPavilion] = useState<Pavilion | null>(null)
    const [games, setGames] = useState<Match[]>([])
    const [loading, setLoading] = useState(true)
    const [tab, setTab] = useState<Tab>('geral')

    useEffect(() => {
        if (!recintoId) return
        setLoading(true)

        const loadData = async () => {
            const pavRes = await supabase.from('pavilions').select('*').eq('recinto_id', parseInt(recintoId)).single()

            if (!pavRes.data) {
                setLoading(false)
                return
            }

            const pav = pavRes.data as Pavilion
            setPavilion(pav)

            // Search games by pavilion name (stripped of common prefixes)
            const searchName = pav.nome
                .replace(/^Pavilhão\s+/i, '')
                .replace(/^Pav\.\s*/i, '')
                .replace(/^Mun\.\s*/i, '')
                .trim()
                .substring(0, 40)

            const gamesRes = await supabase.from('games_2025_2026').select('*')
                .ilike('local', `%${searchName}%`)
                .order('data', { ascending: false })
                .limit(50)

            if (gamesRes.data) {
                setGames(gamesRes.data.map((g: any) => ({
                    ...g,
                    id: g.id || g.slug,
                    status: g.status as Match['status'],
                })) as Match[])
            }
            setLoading(false)
        }

        loadData().catch(() => setLoading(false))
    }, [recintoId])

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 size={28} className="animate-spin text-dribly-purple" />
            </div>
        )
    }

    if (!pavilion) {
        return (
            <div className="max-w-xl mx-auto px-4 py-16 text-center">
                <p className="text-zinc-500">Pavilhão não encontrado.</p>
                <Link to="/mapa" className="text-dribly-purple text-sm mt-2 inline-block">← Voltar ao mapa</Link>
            </div>
        )
    }

    const upcoming = games.filter((g) => g.status === 'AGENDADO' || (g.data >= new Date().toISOString().split('T')[0]))
    const results = games.filter((g) => g.status === 'FINALIZADO')
    const address = [pavilion.rua, pavilion.codigo_postal, pavilion.cidade].filter(Boolean).join(', ')

    const tabs: { value: Tab; label: string; icon: any }[] = [
        { value: 'geral', label: 'Geral', icon: Info },
        { value: 'agenda', label: 'Agenda', icon: CalendarDays },
        { value: 'resultados', label: 'Resultados', icon: Trophy },
    ]

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-[#09090b] dark:via-zinc-950 dark:to-[#09090b]">
            <div className="max-w-4xl mx-auto px-4 pt-6 pb-24">
                {/* Back */}
                <Link to="/mapa" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 mb-4 group">
                    <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                    Mapa
                </Link>

                {/* Header */}
                <div className="flex items-start gap-4 mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-dribly-purple/10 flex items-center justify-center shrink-0">
                        <MapPin size={24} className="text-dribly-purple" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-zinc-900 dark:text-white">
                            {pavilion.nome}
                        </h1>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{address}</p>
                        {pavilion.distrito && (
                            <span className="inline-block mt-1.5 px-2 py-0.5 rounded-md bg-dribly-purple/10 text-[10px] font-bold text-dribly-purple">
                                {pavilion.distrito}
                            </span>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1.5 mb-6 overflow-x-auto">
                    {tabs.map((t) => {
                        const active = tab === t.value
                        const Icon = t.icon
                        return (
                            <button
                                key={t.value}
                                onClick={() => setTab(t.value)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                    active
                                        ? 'bg-dribly-purple text-white'
                                        : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/5'
                                }`}
                            >
                                <Icon size={14} />
                                {t.label}
                            </button>
                        )
                    })}
                </div>

                {/* Tab content */}
                {tab === 'geral' && (
                    <div className="space-y-4">
                        <div className="bg-white dark:bg-zinc-900/60 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 p-5">
                            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4">Informação</h3>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <p className="text-[10px] text-zinc-400 uppercase">Morada</p>
                                    <p className="font-medium text-zinc-900 dark:text-white mt-0.5">{pavilion.rua || '—'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-zinc-400 uppercase">Código Postal</p>
                                    <p className="font-medium text-zinc-900 dark:text-white mt-0.5">{pavilion.codigo_postal || '—'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-zinc-400 uppercase">Cidade</p>
                                    <p className="font-medium text-zinc-900 dark:text-white mt-0.5">{pavilion.cidade || '—'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-zinc-400 uppercase">Distrito</p>
                                    <p className="font-medium text-zinc-900 dark:text-white mt-0.5">{pavilion.distrito || '—'}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-zinc-100 dark:border-white/5">
                                <div className="text-center">
                                    <p className="text-lg font-black text-dribly-purple">{upcoming.length}</p>
                                    <p className="text-[10px] text-zinc-400">Jogos futuros</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-lg font-black text-dribly-purple">{results.length}</p>
                                    <p className="text-[10px] text-zinc-400">Resultados</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-lg font-black text-dribly-purple">{games.length}</p>
                                    <p className="text-[10px] text-zinc-400">Total jogos</p>
                                </div>
                            </div>
                            {pavilion.fpb_url && (
                                <a
                                    href={pavilion.fpb_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 mt-4 text-xs text-dribly-purple hover:underline"
                                >
                                    Ver na FPB →
                                </a>
                            )}
                        </div>
                    </div>
                )}

                {tab === 'agenda' && (
                    <div className="space-y-2">
                        {upcoming.length === 0 ? (
                            <p className="text-sm text-zinc-400 text-center py-8">Sem jogos agendados.</p>
                        ) : (
                            upcoming.map((g, i) => <GameCard key={g.slug || i} match={g} mode="agenda" />)
                        )}
                    </div>
                )}

                {tab === 'resultados' && (
                    <div className="space-y-2">
                        {results.length === 0 ? (
                            <p className="text-sm text-zinc-400 text-center py-8">Sem resultados disponíveis.</p>
                        ) : (
                            results.slice(0, 30).map((g, i) => <GameCard key={g.slug || i} match={g} mode="results" />)
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
