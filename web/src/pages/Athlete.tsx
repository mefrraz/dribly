import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAthlete } from '../hooks/useAthlete'
import type { AthleteInscricao } from '../hooks/useAthlete'

const FPB = 'https://www.fpb.pt/wp-content/themes/fpbasquetebol/assets/images'
const IMG = {
    pontos: `${FPB}/athlete/points.png`,
    ressaltos: `${FPB}/athlete/rebounds.png`,
    assistencias: `${FPB}/athlete/assists.png`,
    desarmes: `${FPB}/athlete/blocks.png`,
    jogos: `${FPB}/athlete/atleta-jogos.png`,
    media: `${FPB}/athlete/atleta-media.png`,
    pontosEpoca: `${FPB}/athlete/atleta-pontos.png`,
    rebound1: `${FPB}/stats/background-rebounds-1.png`,
    rebound2: `${FPB}/stats/background-rebounds-2.png`,
    rebound3: `${FPB}/stats/background-rebounds-3.png`,
    outrosAssist: `${FPB}/stats/background-assists.png`,
    outrosPerda: `${FPB}/stats/background-perda.png`,
    outrosRoubo: `${FPB}/stats/topPerformers-right.png`,
    outrosDesarme: `${FPB}/stats/background-bloco.png`,
}

/** Stat with FPB image above, value + label below */
function BgStat({ img, value, label, size = 48 }: { img: string; value: string | number | null; label: string; size?: number }) {
    return (
        <div className="flex flex-col items-center gap-2 py-2 px-2">
            <div className="flex items-center justify-center" style={{ width: size, height: size }}>
                <img src={img} alt="" className="max-w-full max-h-full object-contain" />
            </div>
            <div className="text-center">
                <span className="text-lg font-black text-zinc-800 dark:text-zinc-100 tabular-nums">{value ?? '—'}</span>
                <span className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wide mt-0.5">{label}</span>
            </div>
        </div>
    )
}

/** Big number stat */
function BigNum({ value, label, suffix }: { value: string | number | null; label: string; suffix?: string }) {
    return (
        <div className="flex flex-col items-center py-3">
            <span className="text-3xl font-black text-zinc-800 dark:text-zinc-100 tabular-nums">
                {value ?? '—'}{suffix || ''}
            </span>
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">{label}</span>
        </div>
    )
}

/** Clean shooting bar */
function ShootBar({ pct, label }: { pct: number | null; label: string }) {
    const v = pct ?? 0
    const barColor = v >= 50 ? '#16a34a' : v >= 35 ? '#d97706' : '#dc2626'
    return (
        <div className="py-2.5 px-3 flex flex-col gap-2">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">{label}</span>
            <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(v, 100)}%`, backgroundColor: barColor }} />
                </div>
                <span className="text-sm font-black tabular-nums w-10 text-right" style={{ color: barColor }}>{v}%</span>
            </div>
        </div>
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

    const rebTotal = data.epoca
        ? (data.epoca.ressaltosOfensivos ?? 0) + (data.epoca.ressaltosDefensivos ?? 0)
        : null

    return (
        <div className="max-w-6xl mx-auto space-y-5 pb-24">
            {/* Top bar */}
            <div className="flex items-center justify-between pt-3 px-3">
                <button onClick={() => window.history.back()} className="p-2 -ml-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
                    <ArrowLeft size={22} />
                </button>
                <span className="text-[10px] font-bold tracking-widest uppercase text-zinc-400">Atleta</span>
                <div className="w-10" />
            </div>

            {/* Header + Stats — two connected cards */}
            <div className="max-w-xl mx-auto px-3">
                {/* Main header card — top */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-t-2xl shadow-sm overflow-hidden">
                    <div className="flex gap-4 p-4">
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <h1 className="text-xl font-black text-zinc-900 dark:text-white truncate leading-tight">
                                {data.nome}
                            </h1>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
                                {data.numero && <span className="text-sm font-bold text-zinc-500">#{data.numero}</span>}
                                {data.posicao && <span className="text-xs font-bold text-zinc-500">{data.posicao}</span>}
                                {data.clube && <span className="text-xs text-zinc-400">· {data.clube}</span>}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1.5">
                                {data.bandeiraUrl && <img src={data.bandeiraUrl} alt="" className="w-4 h-3 object-cover rounded-sm" />}
                                {data.nacionalidade && <span className="text-[10px] font-medium text-zinc-400">{data.nacionalidade}</span>}
                            </div>
                            {data.biografia && (
                                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                                    {data.biografia.dataNascimento && (
                                        <span className="text-[10px] text-zinc-400">
                                            <span className="font-bold text-zinc-500">Nascimento:</span> {data.biografia.dataNascimento}
                                        </span>
                                    )}
                                    {data.biografia.nrLicenca && (
                                        <span className="text-[10px] text-zinc-400">
                                            <span className="font-bold text-zinc-500">Licença:</span> {data.biografia.nrLicenca}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                        {data.foto && (
                            <div className="w-28 h-32 shrink-0 rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                                <img src={data.foto} alt="" className="w-full h-full object-cover object-top" />
                            </div>
                        )}
                    </div>
                </div>
                {/* Stats card — attached below: Pontos | Época | Assistências */}
                <div className="bg-white dark:bg-zinc-900 border border-t-0 border-zinc-200 dark:border-zinc-800 rounded-b-2xl shadow-sm overflow-hidden">
                    <div className="flex items-center justify-around py-3 px-2">
                        <BgStat img={IMG.pontos} value={data.pontos} label="Pontos" />
                        {data.epoca && (
                            <div className="flex items-center gap-3 px-2">
                                <div className="text-center">
                                    <span className="text-lg font-black text-zinc-800 dark:text-zinc-100 tabular-nums">{data.epoca.jogos ?? '—'}</span>
                                    <span className="block text-[8px] font-bold text-zinc-400 uppercase tracking-wide">Jogos</span>
                                </div>
                                <div className="text-center">
                                    <span className="text-lg font-black text-zinc-800 dark:text-zinc-100 tabular-nums">{data.epoca.mediaMinutos ?? '—'}′</span>
                                    <span className="block text-[8px] font-bold text-zinc-400 uppercase tracking-wide">Min/jogo</span>
                                </div>
                                <div className="text-center">
                                    <span className="text-lg font-black text-zinc-800 dark:text-zinc-100 tabular-nums">{data.epoca.pontos ?? '—'}</span>
                                    <span className="block text-[8px] font-bold text-zinc-400 uppercase tracking-wide">Pontos</span>
                                </div>
                            </div>
                        )}
                        <BgStat img={IMG.assistencias} value={data.assistencias} label="Assistências" />
                    </div>
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
                {tab === 'epoca' && data.epoca && (
                    <div className="space-y-5">
                        {/* Lançamentos — light card */}
                        <div>
                            <h4 className="text-sm font-black text-zinc-800 dark:text-zinc-200 mb-2">Lançamentos</h4>
                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
                                <div className="grid grid-cols-2 divide-x divide-zinc-100 dark:divide-zinc-800">
                                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                        <ShootBar pct={data.epoca.lancamentosCampo?.percentagem ?? null} label="Lançamentos de campo" />
                                        <ShootBar pct={data.epoca.lancamentos3?.percentagem ?? null} label="3 Pontos" />
                                    </div>
                                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                        <ShootBar pct={data.epoca.lancamentos2?.percentagem ?? null} label="2 Pontos" />
                                        <ShootBar pct={data.epoca.lancesLivres?.percentagem ?? null} label="Lances Livres" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Ressaltos & Outros */}
                        <div>
                            <h4 className="text-sm font-black text-zinc-800 dark:text-zinc-200 mb-2">Ressaltos & Outros</h4>
                            <div className="flex justify-around flex-wrap gap-3">
                                <BgStat img={IMG.rebound3} value={rebTotal} label="R. Total" />
                                <BgStat img={IMG.rebound1} value={data.epoca.ressaltosOfensivos} label="R. Ofensivos" />
                                <BgStat img={IMG.rebound2} value={data.epoca.ressaltosDefensivos} label="R. Defensivos" />
                                <BgStat img={IMG.outrosPerda} value={data.epoca.perdasBola} label="Perdas de bola" />
                                <BgStat img={IMG.outrosRoubo} value={data.epoca.roubosBola} label="Roubos de bola" />
                                <BgStat img={IMG.outrosDesarme} value={data.epoca.desarmes} label="Desarmes" />
                            </div>
                        </div>
                    </div>
                )}

                {tab === 'carreira' && data.carreira && (
                    <div className="space-y-5">
                        <div className="flex justify-center gap-8">
                            <BigNum value={data.carreira.jogos} label="Jogos" />
                            <BigNum value={data.carreira.tacasPortugal} label="Taças de Portugal" />
                        </div>

                        <div>
                            <h4 className="text-sm font-black text-zinc-800 dark:text-zinc-200 mb-2">Lançamentos</h4>
                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
                                <div className="grid grid-cols-2 divide-x divide-zinc-100 dark:divide-zinc-800">
                                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                        <ShootBar pct={data.carreira.lancamentosCampo?.percentagem ?? null} label="Lançamentos de campo" />
                                        <ShootBar pct={data.carreira.lancamentos3?.percentagem ?? null} label="3 Pontos" />
                                    </div>
                                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                        <ShootBar pct={data.carreira.lancamentos2?.percentagem ?? null} label="2 Pontos" />
                                        <ShootBar pct={data.carreira.lancesLivres?.percentagem ?? null} label="Lances Livres" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

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
