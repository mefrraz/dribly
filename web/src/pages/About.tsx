import { Instagram, Github } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { SeoHead } from '../components/SeoHead'

function About() {
    return (
        <div className="max-w-xl mx-auto space-y-5 pb-24 px-3">
            <SeoHead title="Sobre" description="Dribly — Resultados, jogos e classificações do basquetebol português. Grátis e open-source." />
            <PageHeader />

            {/* Intro + Creator combined */}
            <div className="glass-card p-6 ">
                <div className="flex flex-col items-center text-center mb-5">
                    <h1 className="text-2xl font-black text-zinc-900 dark:text-white">Dribly<span className="text-dribly-purple">.</span></h1>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-xs mt-1">
                        A forma mais rápida de acompanhar os resultados de todos os clubes de basquetebol em Portugal.
                    </p>
                </div>
                <div className="border-t border-zinc-100 dark:border-white/10 pt-5">
                    <p className="text-xs text-zinc-500 mb-3 font-medium">Criado por <strong className="text-zinc-800 dark:text-zinc-200">André Ferraz</strong> — atleta do FC Gaia.</p>
                    <div className="flex gap-2">
                        <a href="https://www.instagram.com/_7frraz_" target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-white/10 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-white/20 transition-colors">
                            <Instagram size={14} />
                            @_7frraz_
                        </a>
                        <a href="https://www.reddit.com/user/frraz_me" target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-white/10 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-white/20 transition-colors">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm4.67 10.67a1.67 1.67 0 0 1-2.83 1.17 8.23 8.23 0 0 1-4.48 1.44l.77-3.6 3.1.66a1.67 1.67 0 0 1 3.44.33zm-8.34 3a.83.83 0 0 1 0-1.66.83.83 0 0 1 0 1.66zm5 4a4.1 4.1 0 0 1-2.82-1.02.33.33 0 0 1 .46-.47 3.66 3.66 0 0 0 4.72 0 .33.33 0 0 1 .46.47A4.1 4.1 0 0 1 13.33 19.67z"/></svg>
                            Reddit
                        </a>
                        <a href="https://github.com/mefrraz/dribly" target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-white/10 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-white/20 transition-colors">
                            <Github size={14} />
                            GitHub
                        </a>
                    </div>
                </div>
            </div>

            {/* Tech + Source combined */}
            <div className="glass-card p-6 ">
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Os dados são obtidos diretamente do site oficial da <strong>Federação Portuguesa de Basquetebol (FPB)</strong> e dos Resultados Tugabasket.
                    Inclui jogos, resultados e classificações de todos os clubes registados na FPB.
                </p>
                <div className="flex flex-wrap gap-2 mt-4">
                    {['React', 'TypeScript', 'Vite', 'Tailwind CSS', 'Supabase', 'Vercel', 'PWA'].map(tech => (
                        <span key={tech} className="px-2.5 py-1 text-[10px] font-bold bg-zinc-100 dark:bg-white/10 text-zinc-700 dark:text-zinc-300 rounded-full">{tech}</span>
                    ))}
                </div>
                <a href="https://github.com/mefrraz/dribly" target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-dribly-purple hover:underline mt-4">
                    <Github size={12} />
                    Código fonte no GitHub
                </a>
            </div>
        </div>
    )
}

export default About
