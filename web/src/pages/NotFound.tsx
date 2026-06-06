import { Link } from 'react-router-dom'
import { Home, Search, BarChart2 } from 'lucide-react'

export default function NotFound() {
    return (
        <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center">
            <div className="mb-6">
                <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-dribly-purple/20 to-dribly-blue/20 flex items-center justify-center">
                    <span className="text-5xl font-black text-dribly-purple opacity-60">?</span>
                </div>
            </div>
            <h1 className="text-4xl font-black text-zinc-900 dark:text-white mb-2">404</h1>
            <p className="text-zinc-500 dark:text-zinc-400 mb-8 max-w-sm">
                Página não encontrada. O caminho que procuras não existe ou foi removido.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
                <Link to="/"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-dribly-purple text-white text-sm font-bold hover:bg-dribly-purple/90 transition-all active:scale-[0.97] shadow-sm shadow-dribly-purple/20">
                    <Home size={16} />
                    Início
                </Link>
                <Link to="/pesquisa"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all active:scale-[0.97]">
                    <Search size={16} />
                    Pesquisar
                </Link>
                <Link to="/classificacoes"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all active:scale-[0.97]">
                    <BarChart2 size={16} />
                    Classificações
                </Link>
            </div>
        </div>
    )
}
