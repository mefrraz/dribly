import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { ArrowLeft, Calendar, Trophy, TrendingUp, Info, User } from 'lucide-react'
import { useAthlete } from '../hooks/useAthlete'
import type { AthleteInscricao } from '../hooks/useAthlete'

function StatCard({ label, value, icon: Icon, color = 'text-zinc-600 dark:text-zinc-300' }: {
    label: string; value: string | number | null; icon: React.ComponentType<any>; color?: string
}) {
    return (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-center">
            <Icon size={16} className={`mx-auto mb-1 ${color}`} />
            <p className={`text-lg font-black ${color}`}>{value ?? '—'}</p>
            <p className="text-[9px] text-zinc-400 uppercase tracking-wide">{label}</p>
        </div>
    )
}

function ShootingBar({ label, stats }: { label: string; stats: { feitos: number; tentados: number; percentagem: number } | null }) {
    if (!stats) return null
    const pct = stats.percentagem
    const color = pct >= 50 ? 'bg-green-500' : pct >= 35 ? 'bg-amber-500' : 'bg-red-500'
    return (
        <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
            <span className="text-[10px] font-bold text-zinc-500 w-20 shrink-0">{label}</span>
            <div className="flex-1 h-3 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
            <span className="text-xs font-mono font-bold text-zinc-600 dark:text-zinc-300 w-16 text-right">
                {stats.feitos}/{stats.tentados}
            </span>
            <span className="text-xs font-bold w-10 text-right" style={{ color: pct >= 50 ? '#16a34a' : pct >= 35 ? '#d97706' : '#dc2626' }}>
                {pct}%
            </span>
        </div>
    )
}

export default function AthletePage() {
    const { id } = useParams<{ id: string }>()
    const { data, loading, error } = useAthlete(id || '')
    const [tab, setTab] = useState<'epoca' | 'carreira' | 'inscricoes' | 'biografia'>('epoca')

    if (loading) {
        return (
            <div className="max-w-xl mx-auto space-y-5 pb-20 px-3 pt-8">
                <div className="animate-pulse space-y-4">
                    <div className="h-48 bg-zinc-200 dark:bg-zinc-800 rounded-2xl" />
                    <div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded-xl w-2/3" />
                    <div className="grid grid-cols-4 gap-2">
                        {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />)}
                    </div>
                </div>
            </div>
        )
    }

    if (error || !data) {
        return (
            <div className="max-w-xl mx-auto pb-20 px-3 pt-8 text-center">
                <p className="text-zinc-500">{error || 'Atleta não encontrado.'}</p>
            </div>
        )
    }

    const tabs = [
        { key: 'epoca' as const, label: 'Época', icon: Calendar, show: data.epoca !== null },
        { key: 'carreira' as const, label: 'Carreira', icon: TrendingUp, show: data.carreira !== null },
        { key: 'inscricoes' as const, label: 'Inscrições', icon: Info, show: data.inscricoes.length > 0 },
        { key: 'biografia' as const, label: 'Biografia', icon: User, show: data.biografia !== null },
    ].filter(t => t.show)

    return (
        <div className="max-w-6xl mx-auto space-y-4 pb-24">
            {/* Top bar */}
            <div className="flex items-center justify-between pt-3 px-3">
                <button onClick={() => window.history.back()} className="p-2 -ml-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
                    <ArrowLeft size={22} />
                </button>
                <span className="text-[10px] font-bold tracking-widest uppercase text-zinc-500">ATLETA</span>
                <div className="w-10" />
            </div>

            {/* Header card */}
            <div className="max-w-xl mx-auto px-3">
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
                    {data.foto && (
                        <div className="relative h-56 bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                            <img src={data.foto} alt="" className="absolute inset-0 w-full h-full object-cover object-top" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                            <div className="absolute bottom-4 left-4 right-4">
                                <div className="flex items-end gap-3">
                                    {data.numero && (
                                        <span className="text-4xl font-black text-white/90 leading-none">{data.numero}</span>
                                    )}
                                    <div>
                                        <h1 className="text-xl font-black text-white truncate">{data.nome}</h1>
                                        <p className="text-xs text-white/70">{data.posicao}{data.clube ? ` · ${data.clube}` : ''}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    {!data.foto && (
                        <div className="p-6">
                            <div className="flex items-center gap-3">
                                {data.numero && (
                                    <span className="text-3xl font-black text-[var(--club-color)]">{data.numero}</span>
                                )}
                                <div>
                                    <h1 className="text-xl font-black text-zinc-900 dark:text-white truncate">{data.nome}</h1>
                                    <p className="text-xs text-zinc-500">{data.posicao}{data.clube ? ` · ${data.clube}` : ''}</p>
                                </div>
                            </div>
                            {data.nacionalidade && (
                                <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                                    {data.bandeiraUrl && <img src={data.bandeiraUrl} alt="" className="w-5 h-3 object-cover rounded-sm" />}
                                    <span className="text-xs text-zinc-500">{data.nacionalidade}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Quick stats */}
            <div className="px-3">
                <div className="grid grid-cols-4 gap-2">
                    <StatCard label="Pontos" value={data.pontos} icon={Trophy} color="text-amber-500" />
                    <StatCard label="Ressaltos" value={data.ressaltos} icon={TrendingUp} color="text-blue-500" />
                    <StatCard label="Assistências" value={data.assistencias} icon={Info} color="text-green-500" />
                    <StatCard label="Desarmes" value={data.desarmes} icon={Calendar} color="text-red-500" />
                </div>
            </div>

            {/* Tab bar */}
            <div className="px-3 mt-2">
                <div className="flex gap-1.5 overflow-x-auto">
                    {tabs.map(t => (
                        <button key={t.key} onClick={() => setTab(t.key)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                tab === t.key ? 'bg-dribly-purple text-white' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/5'
                            }`}>
                            <t.icon size={14} />
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab content */}
            <div className="px-3">
                {/* Época */}
                {tab === 'epoca' && data.epoca && (
                    <div className="space-y-4">
                        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Época {data.epoca.epoca}</h3>

                        <div className="grid grid-cols-3 gap-2">
                            <StatCard label="Jogos" value={data.epoca.jogos} icon={Calendar} />
                            <StatCard label="Min/Jogo" value={data.epoca.mediaMinutos} icon={TrendingUp} />
                            <StatCard label="Pontos" value={data.epoca.pontos} icon={Trophy} color="text-amber-500" />
                        </div>

                        <div className="space-y-2">
                            <ShootingBar label="Lançamentos" stats={data.epoca.lancamentosCampo} />
                            <ShootingBar label="2 Pontos" stats={data.epoca.lancamentos2} />
                            <ShootingBar label="3 Pontos" stats={data.epoca.lancamentos3} />
                            <ShootingBar label="L. Livres" stats={data.epoca.lancesLivres} />
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                            <StatCard label="R. Total" value={data.epoca.ressaltosTotal} icon={TrendingUp} color="text-blue-500" />
                            <StatCard label="R. Ofen." value={data.epoca.ressaltosOfensivos} icon={TrendingUp} color="text-blue-400" />
                            <StatCard label="R. Defen." value={data.epoca.ressaltosDefensivos} icon={TrendingUp} color="text-blue-600" />
                        </div>

                        <div className="grid grid-cols-4 gap-2">
                            <StatCard label="Assist." value={data.epoca.assistencias} icon={Info} color="text-green-500" />
                            <StatCard label="Perdas" value={data.epoca.perdasBola} icon={Info} color="text-red-500" />
                            <StatCard label="Roubos" value={data.epoca.roubosBola} icon={Info} color="text-amber-500" />
                            <StatCard label="Desarmes" value={data.epoca.desarmes} icon={Calendar} color="text-purple-500" />
                        </div>
                    </div>
                )}

                {/* Carreira */}
                {tab === 'carreira' && data.carreira && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-2">
                            <StatCard label="Jogos" value={data.carreira.jogos} icon={Calendar} />
                            <StatCard label="Taças Portugal" value={data.carreira.tacasPortugal} icon={Trophy} color="text-amber-500" />
                        </div>

                        <div className="space-y-2">
                            <ShootingBar label="Lançamentos" stats={data.carreira.lancamentosCampo} />
                            <ShootingBar label="2 Pontos" stats={data.carreira.lancamentos2} />
                            <ShootingBar label="3 Pontos" stats={data.carreira.lancamentos3} />
                            <ShootingBar label="L. Livres" stats={data.carreira.lancesLivres} />
                        </div>
                    </div>
                )}

                {/* Inscrições */}
                {tab === 'inscricoes' && data.inscricoes.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                                    <th className="text-left py-2 px-3 font-bold text-zinc-400 uppercase">Época</th>
                                    <th className="text-left py-2 px-3 font-bold text-zinc-400 uppercase">Associação</th>
                                    <th className="text-left py-2 px-3 font-bold text-zinc-400 uppercase">Clube</th>
                                    <th className="text-left py-2 px-3 font-bold text-zinc-400 uppercase">Escalão</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.inscricoes.map((reg: AthleteInscricao, i: number) => (
                                    <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800/50">
                                        <td className="py-2 px-3 font-bold text-zinc-700 dark:text-zinc-300">{reg.epoca}</td>
                                        <td className="py-2 px-3 text-zinc-500">{reg.associacao}</td>
                                        <td className="py-2 px-3 text-zinc-500">{reg.clube}</td>
                                        <td className="py-2 px-3 text-zinc-500">{reg.escalao}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Biografia */}
                {tab === 'biografia' && data.biografia && (
                    <div className="space-y-2">
                        {data.biografia.nrLicenca && (
                            <div className="flex justify-between p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                                <span className="text-xs text-zinc-500">Nr. Licença</span>
                                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{data.biografia.nrLicenca}</span>
                            </div>
                        )}
                        {data.biografia.dataNascimento && (
                            <div className="flex justify-between p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                                <span className="text-xs text-zinc-500">Data de Nascimento</span>
                                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{data.biografia.dataNascimento}</span>
                            </div>
                        )}
                        {data.biografia.nacionalidade && (
                            <div className="flex justify-between p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                                <span className="text-xs text-zinc-500">Nacionalidade</span>
                                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{data.biografia.nacionalidade}</span>
                            </div>
                        )}
                        {data.biografia.posicao && (
                            <div className="flex justify-between p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                                <span className="text-xs text-zinc-500">Posição</span>
                                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{data.biografia.posicao}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
