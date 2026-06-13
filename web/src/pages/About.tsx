import { Instagram, Github, Heart } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { SeoHead } from '../components/SeoHead'

const RedditIcon = ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"/>
        <path d="M7.5 13.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM16.5 13.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/>
        <path d="M9 14.5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M12 15.5v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="12" cy="3" r="1" fill="currentColor"/>
        <path d="M12 4v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M10 9l-2-1M14 9l2-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
)

function About() {
    return (
        <div className="max-w-xl mx-auto space-y-5 pb-24 px-3">
            <SeoHead title="Sobre" description="Dribly — Resultados, jogos e classificações do basquetebol português. Grátis e open-source." />
            <PageHeader />

            {/* Intro */}
            <div className="glass-card p-6 text-center">
                <h1 className="text-2xl font-black text-zinc-900 dark:text-white">Dribly<span className="text-dribly-purple">.</span></h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-xs mx-auto mt-1">
                    A forma mais rápida de acompanhar os resultados de todos os clubes de basquetebol em Portugal.
                </p>
            </div>

            {/* Creator */}
            <div className="glass-card p-6">
                <p className="text-xs text-zinc-500 mb-4 font-medium text-center">
                    Criado por <strong className="text-zinc-800 dark:text-zinc-200">André Ferraz</strong>
                </p>
                <div className="flex justify-center gap-2">
                    <a href="https://www.instagram.com/_7frraz_" target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-white/10 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-white/20 transition-colors">
                        <Instagram size={14} />
                        Instagram
                    </a>
                    <a href="https://www.reddit.com/user/frraz_me" target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-white/10 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-white/20 transition-colors">
                        <RedditIcon size={14} />
                        Reddit
                    </a>
                    <a href="https://github.com/mefrraz/dribly" target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-white/10 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-white/20 transition-colors">
                        <Github size={14} />
                        GitHub
                    </a>
                </div>
            </div>

            {/* Data + Tech */}
            <div className="glass-card p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Heart size={16} className="text-dribly-purple" />
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                        Os dados são obtidos diretamente do site oficial da <strong>Federação Portuguesa de Basquetebol (FPB)</strong>.
                        Inclui jogos, resultados e classificações de todos os clubes registados.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {['React', 'TypeScript', 'Vite', 'Tailwind CSS', 'Supabase', 'Vercel', 'PWA'].map(tech => (
                        <span key={tech} className="px-2.5 py-1 text-[10px] font-bold bg-zinc-100 dark:bg-white/10 text-zinc-700 dark:text-zinc-300 rounded-full">{tech}</span>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default About
