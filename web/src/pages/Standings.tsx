import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { supabase } from '../lib/supabase'

const TUGABASKET_ASSETS = 'https://resultados.tugabasket.com/assets/images/logos'
const ASSOCIATION_LOGOS: Record<number, string> = {
    50: 'fpb.jpg', 1: 'ablisboa.jpg', 2: 'absetubal.jpg', 3: 'abaveiro.jpg',
    4: 'abporto.jpg', 5: 'abbraga.jpg', 6: 'abmadeira.jpg', 7: 'absantarem_novo.jpg',
    8: 'abcoimbra.jpg', 9: 'abalgarve.jpg', 10: 'abviseu.jpg', 11: 'ableiria.jpg',
    12: 'abalentejo.jpg', 13: 'abit.jpg', 14: 'abcastelobranco.jpg', 15: 'abbraganca.jpg',
    16: 'absaomiguel.jpg', 17: 'abviana.jpg', 18: 'abvilareal.jpg', 19: 'abifp.jpg',
    20: 'abguarda.jpg', 22: 'absantamaria.jpg', 24: 'abacores.jpg',
}
function logoUrl(id: number) { const f = ASSOCIATION_LOGOS[id]; return f ? `${TUGABASKET_ASSETS}/${f}` : '' }

interface AssociationMeta { association_id: number; association_name: string }

export default function Standings() {
    const [associations, setAssociations] = useState<AssociationMeta[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        setLoading(true)
        supabase.from('competitions')
            .select('association_id, association_name')
            .eq('season', '2025/2026').order('association_name')
            .then(({ data }) => {
                if (data) {
                    const seen = new Set<number>()
                    const u: AssociationMeta[] = []
                    for (const r of data) {
                        const id = r.association_id as number
                        if (!seen.has(id)) { seen.add(id); u.push({ association_id: id, association_name: r.association_name as string }) }
                    }
                    setAssociations(u)
                }
                setLoading(false)
            })
    }, [])

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-[#09090b] dark:via-zinc-950 dark:to-[#09090b]">
            <div className="max-w-6xl mx-auto px-3 sm:px-5 md:px-8 pt-8 sm:pt-10 pb-16">
                <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight mb-2 text-center">Classificações</h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center mb-8 max-w-md mx-auto">
                    Escolha uma associação para ver as suas competições
                </p>

                {loading ? (
                    <LoadingSpinner message="A carregar associações..." />
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-3.5">
                        {associations.map(a => (
                            <Link key={a.association_id} to={`/classificacoes/${a.association_id}`}
                                className="group bg-white dark:bg-zinc-900/90 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 p-4 sm:p-5 shadow-sm hover:shadow-xl hover:border-zinc-300 dark:hover:border-zinc-600 hover:-translate-y-0.5 transition-all duration-200 flex flex-col items-center gap-3">
                                <div className="w-[72px] h-[72px] sm:w-[80px] sm:h-[80px] rounded-2xl bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-800 dark:to-zinc-800/50 flex items-center justify-center p-3 border border-zinc-100 dark:border-zinc-700/50 shadow-inner group-hover:shadow-md transition-all duration-200">
                                    <img src={logoUrl(a.association_id)} alt={a.association_name}
                                        className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-110"
                                        loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                                </div>
                                <span className="text-[11px] sm:text-xs font-bold text-zinc-600 dark:text-zinc-400 text-center leading-tight group-hover:text-zinc-900 dark:group-hover:text-white transition-colors line-clamp-2">
                                    {a.association_name}
                                </span>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
            <style>{`.line-clamp-2{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}`}</style>
        </div>
    )
}
