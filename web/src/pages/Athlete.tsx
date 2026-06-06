import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAthlete } from '../hooks/useAthlete'
import type { AthleteInscricao, ShootingStats } from '../hooks/useAthlete'

/** SVG donut chart: colored arc + value in center */
function Donut({ pct, size = 64, stroke = 6, color = '#7C3AED', label, detail }: {
    pct: number; size?: number; stroke?: number; color?: string; label: string; detail?: string
}) {
    const r = (size - stroke) / 2
    const c = size / 2
    const circ = 2 * Math.PI * r
    const offset = circ - (pct / 100) * circ
    return (
        <div className="flex flex-col items-center gap-1">
            <svg width={size} height={size} className="shrink-0">
                <circle cx={c} cy={c} r={r} fill="none" stroke="currentColor"
                    className="text-zinc-200 dark:text-zinc-700" strokeWidth={stroke} />
                <circle cx={c} cy={c} r={r} fill="none" stroke={color}
                    strokeWidth={stroke} strokeDasharray={circ} strokeDashoffset={offset}
                    strokeLinecap="round" transform={`rotate(-90 ${c} ${c})`}
                    className="transition-all duration-700" />
                <text x={c} y={c} textAnchor="middle" dominantBaseline="central"
                    className="fill-zinc-700 dark:fill-zinc-200 text-[10px] font-black"
                    style={{ fontSize: size < 60 ? 10 : 13 }}>{pct}%</text>
            </svg>
            <span className="text-[9px] font-bold text-zinc-500 dark:text-zinc-400 text-center leading-tight">{label}</span>
            {detail && <span className="text-[8px] text-zinc-400">{detail}</span>}
        </div>
    )
}

/** Big stat pill with donut-style ring */
function StatPill({ value, label, color = '#7C3AED' }: { value: number | null; label: string; color?: string }) {
    return (
        <div className="relative flex flex-col items-center justify-center p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 group">
            <div className="absolute inset-0 rounded-2xl opacity-5 group-hover:opacity-10 transition-opacity"
                style={{ backgroundColor: color }} />
            <span className="text-2xl font-black tabular-nums" style={{ color }}>{value ?? '—'}</span>
            <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mt-0.5">{label}</span>
        </div>
    )
}

/** Small stat with circle ring */
function StatCircle({ value, label, color = '#7C3AED', max = 100 }: {
    value: number | null; label: string; color?: string; max?: number
}) {
    const pct = value !== null && max > 0 ? Math.min((value / max) * 100, 100) : 0
    const size = 56
    const stroke = 5
    const r = (size - stroke) / 2
    const c = size / 2
    const circ = 2 * Math.PI * r
    const offset = circ - (pct / 100) * circ
    return (
        <div className="flex flex-col items-center gap-1">
            <svg width={size} height={size} className="shrink-0">
                <circle cx={c} cy={c} r={r} fill="none" stroke="currentColor"
                    className="text-zinc-200 dark:text-zinc-700" strokeWidth={stroke} />
                <circle cx={c} cy={c} r={r} fill="none" stroke={color}
                    strokeWidth={stroke} strokeDasharray={circ} strokeDashoffset={offset}
                    strokeLinecap="round" transform={`rotate(-90 ${c} ${c})`}
                    className="transition-all duration-700" />
                <text x={c} y={c - 1} textAnchor="middle" dominantBaseline="central"
                    className="fill-zinc-800 dark:fill-zinc-100 text-[11px] font-black">{value ?? '—'}</text>
            </svg>
            <span className="text-[8px] font-bold text-zinc-400 uppercase text-center leading-tight">{label}</span>
        </div>
    )
}

function ShootingDonut({ label, stats, color = '#7C3AED' }: { label: string; stats: ShootingStats | null; color?: string }) {
    if (!stats) return null
    return (
        <Donut
            pct={stats.percentagem}
            size={72}
            stroke={7}
            color={color}
            label={label}
            detail={`${stats.feitos}/${stats.tentados}`}
        />
    )
}

export default function AthletePage() {
    const { id } = useParams<{ id: string }>()
    const { data, loading, error } = useAthlete(id || '')
    const [tab, setTab] = useState<'epoca' | 'carreira' | 'inscricoes'>('epoca')

    if (loading) {
        return (
            <div className="max-w-xl mx-auto space-y-5 pb-20 px-3 pt-8">
                <div className="animate-pulse space-y-4">
                    <div className="flex gap-3">
                        <div className="flex-1 h-32 bg-zinc-200 dark:bg-zinc-800 rounded-2xl" />
                        <div className="w-28 h-32 bg-zinc-200 dark:bg-zinc-800 rounded-2xl" />
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                        {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-zinc-200 dark:bg-zinc-800 rounded-2xl" />)}
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
        { key: 'epoca' as const, label: 'Época', show: data.epoca !== null },
        { key: 'carreira' as const, label: 'Carreira', show: data.carreira !== null },
        { key: 'inscricoes' as const, label: 'Inscrições', show: data.inscricoes.length > 0 },
    ].filter(t => t.show)

    const pctColor = (pct: number) => pct >= 50 ? '#16a34a' : pct >= 35 ? '#d97706' : '#dc2626'

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

            {/* Header: info left, photo right */}
            <div className="max-w-xl mx-auto px-3">
                <div className="flex gap-4">
                    {/* Info */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <h1 className="text-2xl font-black text-zinc-900 dark:text-white truncate leading-tight">
                            {data.nome}
                        </h1>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1.5">
                            {data.numero && (
                                <span className="text-sm font-black text-[var(--club-color)]">#{data.numero}</span>
                            )}
                            {data.posicao && (
                                <span className="text-xs font-bold text-zinc-500">{data.posicao}</span>
                            )}
                            {data.clube && (
                                <span className="text-xs text-zinc-400">· {data.clube}</span>
                            )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5">
                            {data.bandeiraUrl && (
                                <img src={data.bandeiraUrl} alt="" className="w-4 h-3 object-cover rounded-sm" />
                            )}
                            {data.nacionalidade && (
                                <span className="text-[10px] font-medium text-zinc-400">{data.nacionalidade}</span>
                            )}
                        </div>
                        {/* Biography inline */}
                        {data.biografia && (
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                                {data.biografia.dataNascimento && (
                                    <span className="text-[10px] text-zinc-400">
                                        <span className="font-bold text-zinc-500">Nasc:</span> {data.biografia.dataNascimento}
                                    </span>
                                )}
                                {data.biografia.nrLicenca && (
                                    <span className="text-[10px] text-zinc-400">
                                        <span className="font-bold text-zinc-500">Lic:</span> {data.biografia.nrLicenca}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                    {/* Photo */}
                    {data.foto && (
                        <div className="w-28 h-32 shrink-0 rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                            <img src={data.foto} alt="" className="w-full h-full object-cover object-top" />
                        </div>
                    )}
                </div>
            </div>

            {/* Quick stats — stat pills */}
            <div className="px-3">
                <div className="grid grid-cols-4 gap-2">
                    <StatPill value={data.pontos} label="Pontos" color="#f59e0b" />
                    <StatPill value={data.ressaltos} label="Ressaltos" color="#3b82f6" />
                    <StatPill value={data.assistencias} label="Assist." color="#22c55e" />
                    <StatPill value={data.desarmes} label="Desarmes" color="#ef4444" />
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
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab content */}
            <div className="px-3">
                {/* Época */}
                {tab === 'epoca' && data.epoca && (
                    <div className="space-y-5">
                        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                            Época {data.epoca.epoca}
                        </h3>

                        {/* Top 3 circles */}
                        <div className="flex justify-center gap-6">
                            <StatCircle value={data.epoca.jogos} label="Jogos" color="#7C3AED" max={40} />
                            <StatCircle value={data.epoca.mediaMinutos} label="Min/jogo" color="#06b6d4" max={40} />
                            <StatCircle value={data.epoca.pontos} label="Pontos" color="#f59e0b" max={data.epoca.pontos ? data.epoca.pontos + 20 : 100} />
                        </div>

                        {/* Shooting donuts */}
                        <div>
                            <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-3">Lançamentos</h4>
                            <div className="flex justify-center gap-4 flex-wrap">
                                <ShootingDonut label="Campo" stats={data.epoca.lancamentosCampo} color={data.epoca.lancamentosCampo ? pctColor(data.epoca.lancamentosCampo.percentagem) : '#7C3AED'} />
                                <ShootingDonut label="2 Pontos" stats={data.epoca.lancamentos2} color={data.epoca.lancamentos2 ? pctColor(data.epoca.lancamentos2.percentagem) : '#7C3AED'} />
                                <ShootingDonut label="3 Pontos" stats={data.epoca.lancamentos3} color={data.epoca.lancamentos3 ? pctColor(data.epoca.lancamentos3.percentagem) : '#7C3AED'} />
                                <ShootingDonut label="L.Livres" stats={data.epoca.lancesLivres} color={data.epoca.lancesLivres ? pctColor(data.epoca.lancesLivres.percentagem) : '#7C3AED'} />
                            </div>
                        </div>

                        {/* Rebounds */}
                        <div className="flex justify-center gap-6">
                            <StatCircle value={data.epoca.ressaltosTotal} label="R.Total" color="#3b82f6" max={data.epoca.ressaltosTotal ? data.epoca.ressaltosTotal + 10 : 50} />
                            <StatCircle value={data.epoca.ressaltosOfensivos} label="R.Ofen" color="#60a5fa" max={data.epoca.ressaltosOfensivos ? data.epoca.ressaltosOfensivos + 5 : 20} />
                            <StatCircle value={data.epoca.ressaltosDefensivos} label="R.Defen" color="#1d4ed8" max={data.epoca.ressaltosDefensivos ? data.epoca.ressaltosDefensivos + 10 : 50} />
                        </div>

                        {/* Other stats */}
                        <div className="grid grid-cols-4 gap-2">
                            <StatPill value={data.epoca.assistencias} label="Assist." color="#22c55e" />
                            <StatPill value={data.epoca.perdasBola} label="Perdas" color="#ef4444" />
                            <StatPill value={data.epoca.roubosBola} label="Roubos" color="#f59e0b" />
                            <StatPill value={data.epoca.desarmes} label="Desarmes" color="#a855f7" />
                        </div>
                    </div>
                )}

                {/* Carreira */}
                {tab === 'carreira' && data.carreira && (
                    <div className="space-y-5">
                        <div className="flex justify-center gap-6">
                            <StatCircle value={data.carreira.jogos} label="Jogos" color="#7C3AED" max={data.carreira.jogos ? data.carreira.jogos + 20 : 100} />
                            <StatCircle value={data.carreira.tacasPortugal} label="Taças" color="#f59e0b" max={data.carreira.tacasPortugal ? data.carreira.tacasPortugal + 5 : 20} />
                        </div>

                        <div>
                            <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-3">Lançamentos</h4>
                            <div className="flex justify-center gap-4 flex-wrap">
                                <ShootingDonut label="Campo" stats={data.carreira.lancamentosCampo} color={data.carreira.lancamentosCampo ? pctColor(data.carreira.lancamentosCampo.percentagem) : '#7C3AED'} />
                                <ShootingDonut label="2 Pontos" stats={data.carreira.lancamentos2} color={data.carreira.lancamentos2 ? pctColor(data.carreira.lancamentos2.percentagem) : '#7C3AED'} />
                                <ShootingDonut label="3 Pontos" stats={data.carreira.lancamentos3} color={data.carreira.lancamentos3 ? pctColor(data.carreira.lancamentos3.percentagem) : '#7C3AED'} />
                                <ShootingDonut label="L.Livres" stats={data.carreira.lancesLivres} color={data.carreira.lancesLivres ? pctColor(data.carreira.lancesLivres.percentagem) : '#7C3AED'} />
                            </div>
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
            </div>
        </div>
    )
}
