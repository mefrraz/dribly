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
    shooting1: `${FPB}/stats/background-shooting-1.png`,
    shooting2: `${FPB}/stats/background-shooting-2.png`,
    shooting3: `${FPB}/stats/background-shooting-3.png`,
    shooting4: `${FPB}/stats/background-shooting-4.png`,
    rebound1: `${FPB}/stats/background-rebounds-1.png`,
    rebound2: `${FPB}/stats/background-rebounds-2.png`,
    rebound3: `${FPB}/stats/background-rebounds-3.png`,
    outrosAssist: `${FPB}/stats/background-assists.png`,
    outrosPerda: `${FPB}/stats/background-perda.png`,
    outrosRoubo: `${FPB}/stats/topPerformers-right.png`,
    outrosDesarme: `${FPB}/stats/background-bloco.png`,
}

/** Small stat with FPB icon — no card, just image + value + label */
function MiniStat({ img, value, label }: { img: string; value: string | number | null; label: string }) {
    return (
        <div className="flex flex-col items-center gap-1">
            <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden">
                <img src={img} alt="" className="w-8 h-8 object-contain" />
            </div>
            <span className="text-lg font-black text-zinc-800 dark:text-zinc-100 tabular-nums">{value ?? '—'}</span>
            <span className="text-[9px] font-medium text-zinc-400 uppercase tracking-wide">{label}</span>
        </div>
    )
}

/** Season stat — number + label, clean */
function NumStat({ value, label, suffix }: { value: string | number | null; label: string; suffix?: string }) {
    return (
        <div className="flex flex-col items-center">
            <span className="text-3xl font-black text-zinc-800 dark:text-zinc-100 tabular-nums">
                {value ?? '—'}{suffix || ''}
            </span>
            <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide">{label}</span>
        </div>
    )
}

/** Shooting cell in 2x2 grid — image background + percentage */
function ShootCell({ img, pct, label }: { img: string; pct: number | null; label: string }) {
    const v = pct ?? 0
    const color = v >= 50 ? '#16a34a' : v >= 35 ? '#d97706' : '#dc2626'
    return (
        <div className="relative rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-800/50 min-h-[90px]">
            <div className="absolute inset-0 bg-center bg-cover opacity-40 dark:opacity-30"
                style={{ backgroundImage: `url(${img})` }} />
            <div className="relative h-full flex flex-col items-center justify-center p-3">
                <span className="text-2xl font-black tabular-nums" style={{ color }}>{v}%</span>
                <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 text-center leading-tight mt-0.5">{label}</span>
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
                    <div className="flex justify-center gap-6">
                        {[1, 2, 3, 4].map(i => <div key={i} className="w-14 h-14 bg-zinc-200 dark:bg-zinc-800 rounded-full" />)}
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

    return (
        <div className="max-w-6xl mx-auto space-y-5 pb-24">
            {/* Top bar */}
            <div className="flex items-center justify-between pt-3 px-3">
                <button onClick={() => window.history.back()} className="p-2 -ml-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
                    <ArrowLeft size={22} />
                </button>
                <span className="text-[10px] font-bold tracking-widest uppercase text-zinc-400">ATLETA</span>
                <div className="w-10" />
            </div>

            {/* Header card */}
            <div className="max-w-xl mx-auto px-3">
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
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
                        {data.foto && (
                            <div className="w-28 h-32 shrink-0 rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                                <img src={data.foto} alt="" className="w-full h-full object-cover object-top" />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Quick stats — small icons, no cards */}
            <div className="px-3">
                <div className="flex justify-center gap-6">
                    <MiniStat img={IMG.pontos} value={data.pontos} label="Pontos" />
                    <MiniStat img={IMG.ressaltos} value={data.ressaltos} label="Ressaltos" />
                    <MiniStat img={IMG.assistencias} value={data.assistencias} label="Assist." />
                    <MiniStat img={IMG.desarmes} value={data.desarmes} label="Desarmes" />
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
                    <div className="space-y-6">
                        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider text-center">
                            Época {data.epoca.epoca}
                        </h3>

                        {/* Jogos / Min / Pontos — clean numbers */}
                        <div className="flex justify-center gap-8">
                            <NumStat value={data.epoca.jogos} label="Jogos" />
                            <NumStat value={data.epoca.mediaMinutos} label="Min/jogo" suffix="'" />
                            <NumStat value={data.epoca.pontos} label="Pontos" />
                        </div>

                        {/* Shooting — 2x2 grid with images */}
                        <div>
                            <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Lançamentos</h4>
                            <div className="grid grid-cols-2 gap-2">
                                <ShootCell img={IMG.shooting1} pct={data.epoca.lancamentosCampo?.percentagem ?? null} label="Campo" />
                                <ShootCell img={IMG.shooting2} pct={data.epoca.lancamentos2?.percentagem ?? null} label="2 Pontos" />
                                <ShootCell img={IMG.shooting3} pct={data.epoca.lancamentos3?.percentagem ?? null} label="3 Pontos" />
                                <ShootCell img={IMG.shooting4} pct={data.epoca.lancesLivres?.percentagem ?? null} label="L. Livres" />
                            </div>
                        </div>

                        {/* Rebounds — mini stats */}
                        <div>
                            <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Ressaltos</h4>
                            <div className="flex justify-center gap-6">
                                <MiniStat img={IMG.rebound3} value={data.epoca.ressaltosTotal} label="Total" />
                                <MiniStat img={IMG.rebound1} value={data.epoca.ressaltosOfensivos} label="Ofensivos" />
                                <MiniStat img={IMG.rebound2} value={data.epoca.ressaltosDefensivos} label="Defensivos" />
                            </div>
                        </div>

                        {/* Outros — mini stats */}
                        <div>
                            <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Outros</h4>
                            <div className="flex justify-center gap-6">
                                <MiniStat img={IMG.outrosAssist} value={data.epoca.assistencias} label="Assist." />
                                <MiniStat img={IMG.outrosPerda} value={data.epoca.perdasBola} label="Perdas" />
                                <MiniStat img={IMG.outrosRoubo} value={data.epoca.roubosBola} label="Roubos" />
                                <MiniStat img={IMG.outrosDesarme} value={data.epoca.desarmes} label="Desarmes" />
                            </div>
                        </div>
                    </div>
                )}

                {tab === 'carreira' && data.carreira && (
                    <div className="space-y-6">
                        <div className="flex justify-center gap-8">
                            <NumStat value={data.carreira.jogos} label="Jogos" />
                            <NumStat value={data.carreira.tacasPortugal} label="Taças Portugal" />
                        </div>

                        <div>
                            <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Lançamentos</h4>
                            <div className="grid grid-cols-2 gap-2">
                                <ShootCell img={IMG.shooting1} pct={data.carreira.lancamentosCampo?.percentagem ?? null} label="Campo" />
                                <ShootCell img={IMG.shooting2} pct={data.carreira.lancamentos2?.percentagem ?? null} label="2 Pontos" />
                                <ShootCell img={IMG.shooting3} pct={data.carreira.lancamentos3?.percentagem ?? null} label="3 Pontos" />
                                <ShootCell img={IMG.shooting4} pct={data.carreira.lancesLivres?.percentagem ?? null} label="L. Livres" />
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
