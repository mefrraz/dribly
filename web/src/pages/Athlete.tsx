import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAthlete } from '../hooks/useAthlete'
import type { AthleteInscricao, ShootingStats } from '../hooks/useAthlete'

// FPB background images for stat cards
const FPB = 'https://www.fpb.pt/wp-content/themes/fpbasquetebol/assets/images'
const BG = {
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

/** Card with FPB background image */
function ImgCard({ bg, value, label }: {
    bg: string; value: string | number | null; label: string
}) {
    return (
        <div className="relative rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <div className="absolute inset-0 opacity-[0.06] dark:opacity-[0.10] bg-center bg-cover"
                style={{ backgroundImage: `url(${bg})` }} />
            <div className="relative flex flex-col items-center justify-center p-4">
                <span className="text-2xl font-black tabular-nums text-zinc-800 dark:text-zinc-100">{value ?? '—'}</span>
                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mt-0.5">{label}</span>
            </div>
        </div>
    )
}

/** Shooting stat with FPB background + bar */
function ShootingCard({ bg, label, stats, color }: {
    bg: string; label: string; stats: ShootingStats | null; color: string
}) {
    if (!stats) return null
    const pct = stats.percentagem
    const barColor = pct >= 50 ? 'bg-green-500' : pct >= 35 ? 'bg-amber-500' : 'bg-red-500'
    return (
        <div className="relative rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
            <div className="absolute inset-0 opacity-[0.05] dark:opacity-[0.08] bg-center bg-cover"
                style={{ backgroundImage: `url(${bg})` }} />
            <div className="relative space-y-2">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-zinc-500">{label}</span>
                    <span className="text-[10px] font-mono font-bold text-zinc-400">{stats.feitos}/{stats.tentados}</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex-1 h-2.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                        <div className={`h-full ${barColor} rounded-full transition-all duration-500`}
                            style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                    <span className="text-sm font-black tabular-nums w-10 text-right"
                        style={{ color }}>{pct}%</span>
                </div>
            </div>
        </div>
    )
}

/** Big stat for jogos/min/pontos — no circle, just bold value + label + subtle bg */
function BigStat({ bg, value, label, suffix }: {
    bg: string; value: string | number | null; label: string; suffix?: string
}) {
    return (
        <div className="relative rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <div className="absolute inset-0 opacity-[0.05] dark:opacity-[0.10] bg-center bg-cover"
                style={{ backgroundImage: `url(${bg})` }} />
            <div className="relative flex flex-col items-center justify-center p-5">
                <span className="text-3xl font-black tabular-nums text-zinc-800 dark:text-zinc-100">
                    {value ?? '—'}{suffix || ''}
                </span>
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mt-1">{label}</span>
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
                <span className="text-[10px] font-bold tracking-widest uppercase text-zinc-400">ATLETA</span>
                <div className="w-10" />
            </div>

            {/* Header card */}
            <div className="max-w-xl mx-auto px-3">
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
                    <div className="flex gap-4 p-4">
                        {/* Info */}
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <h1 className="text-xl font-black text-zinc-900 dark:text-white truncate leading-tight">
                                {data.nome}
                            </h1>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
                                {data.numero && (
                                    <span className="text-sm font-bold text-zinc-500">#{data.numero}</span>
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
            </div>

            {/* Quick stats with FPB background images */}
            <div className="px-3">
                <div className="grid grid-cols-4 gap-2">
                    <ImgCard bg={BG.pontos} value={data.pontos} label="Pontos" />
                    <ImgCard bg={BG.ressaltos} value={data.ressaltos} label="Ressaltos" />
                    <ImgCard bg={BG.assistencias} value={data.assistencias} label="Assist." />
                    <ImgCard bg={BG.desarmes} value={data.desarmes} label="Desarmes" />
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
                    <div className="space-y-4">
                        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                            Época {data.epoca.epoca}
                        </h3>

                        {/* Jogos / Min / Pontos — big stats with FPB images */}
                        <div className="grid grid-cols-3 gap-2">
                            <BigStat bg={BG.jogos} value={data.epoca.jogos} label="Jogos" />
                            <BigStat bg={BG.media} value={data.epoca.mediaMinutos} label="Min/jogo" suffix="'" />
                            <BigStat bg={BG.pontosEpoca} value={data.epoca.pontos} label="Pontos" />
                        </div>

                        {/* Shooting — bars with FPB backgrounds */}
                        <div>
                            <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Lançamentos</h4>
                            <div className="space-y-2">
                                <ShootingCard bg={BG.shooting1} label="Lançamentos de campo" stats={data.epoca.lancamentosCampo} color={data.epoca.lancamentosCampo ? pctColor(data.epoca.lancamentosCampo.percentagem) : '#7C3AED'} />
                                <ShootingCard bg={BG.shooting2} label="2 Pontos" stats={data.epoca.lancamentos2} color={data.epoca.lancamentos2 ? pctColor(data.epoca.lancamentos2.percentagem) : '#7C3AED'} />
                                <ShootingCard bg={BG.shooting3} label="3 Pontos" stats={data.epoca.lancamentos3} color={data.epoca.lancamentos3 ? pctColor(data.epoca.lancamentos3.percentagem) : '#7C3AED'} />
                                <ShootingCard bg={BG.shooting4} label="Lances Livres" stats={data.epoca.lancesLivres} color={data.epoca.lancesLivres ? pctColor(data.epoca.lancesLivres.percentagem) : '#7C3AED'} />
                            </div>
                        </div>

                        {/* Rebounds — with FPB backgrounds */}
                        <div>
                            <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Ressaltos</h4>
                            <div className="grid grid-cols-3 gap-2">
                                <ImgCard bg={BG.rebound3} value={data.epoca.ressaltosTotal} label="Total" />
                                <ImgCard bg={BG.rebound1} value={data.epoca.ressaltosOfensivos} label="Ofensivos" />
                                <ImgCard bg={BG.rebound2} value={data.epoca.ressaltosDefensivos} label="Defensivos" />
                            </div>
                        </div>

                        {/* Outros — with FPB backgrounds */}
                        <div>
                            <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Outros</h4>
                            <div className="grid grid-cols-4 gap-2">
                                <ImgCard bg={BG.outrosAssist} value={data.epoca.assistencias} label="Assist." />
                                <ImgCard bg={BG.outrosPerda} value={data.epoca.perdasBola} label="Perdas" />
                                <ImgCard bg={BG.outrosRoubo} value={data.epoca.roubosBola} label="Roubos" />
                                <ImgCard bg={BG.outrosDesarme} value={data.epoca.desarmes} label="Desarmes" />
                            </div>
                        </div>
                    </div>
                )}

                {/* Carreira */}
                {tab === 'carreira' && data.carreira && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-2">
                            <BigStat bg={BG.jogos} value={data.carreira.jogos} label="Jogos" />
                            <BigStat bg={BG.media} value={data.carreira.tacasPortugal} label="Taças Portugal" />
                        </div>

                        <div>
                            <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Lançamentos</h4>
                            <div className="space-y-2">
                                <ShootingCard bg={BG.shooting1} label="Lançamentos de campo" stats={data.carreira.lancamentosCampo} color={data.carreira.lancamentosCampo ? pctColor(data.carreira.lancamentosCampo.percentagem) : '#7C3AED'} />
                                <ShootingCard bg={BG.shooting2} label="2 Pontos" stats={data.carreira.lancamentos2} color={data.carreira.lancamentos2 ? pctColor(data.carreira.lancamentos2.percentagem) : '#7C3AED'} />
                                <ShootingCard bg={BG.shooting3} label="3 Pontos" stats={data.carreira.lancamentos3} color={data.carreira.lancamentos3 ? pctColor(data.carreira.lancamentos3.percentagem) : '#7C3AED'} />
                                <ShootingCard bg={BG.shooting4} label="Lances Livres" stats={data.carreira.lancesLivres} color={data.carreira.lancesLivres ? pctColor(data.carreira.lancesLivres.percentagem) : '#7C3AED'} />
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
