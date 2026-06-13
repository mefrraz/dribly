import { Instagram, Github, Heart } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { SeoHead } from '../components/SeoHead'

// Official Reddit brand SVG (from simple-icons)
const RedditIcon = ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547.8-3.747c.007-.06.091-.101.154-.067.654.374 1.38.64 2.146.744.064.009.104.1.065.152a3.3 3.3 0 0 1-.74.88c-.05.04-.15.01-.18-.04-.013-.02-.02-.04-.02-.06l-.4-1.43-1.12 4.8zm-5.07.303c1.93.008 3.49.287 4.82.83a5.5 5.5 0 0 1 2.11 1.63c.47.598.74 1.323.74 2.133 0 .717-.2 1.382-.6 1.94-.39.558-.94.98-1.6 1.25.2 2.09-1.18 4.26-4.76 4.26-2.95 0-4.44-1.56-4.87-3.18a.06.06 0 0 1 .04-.08c.5-.1 2.27-.52 2.65-.63a.05.05 0 0 1 .07.03c.16.69.7 1.86 2.14 1.86 1.3 0 2.08-.78 2.3-1.63a3.3 3.3 0 0 1-1.91-.67.08.08 0 0 1-.02-.11c.28-.4.68-1.26.86-1.8a.04.04 0 0 1 .04-.03c1.53-.09 2.74-.35 3.7-.71.3-.14.54-.35.69-.62.15-.27.2-.54.2-.81 0-.6-.2-1.09-.59-1.47-.4-.38-.95-.64-1.59-.78a7.2 7.2 0 0 0-3.82.08c-.64.2-1.1.46-1.32.61-.02.02-.06.02-.08 0-.22-.15-.68-.41-1.32-.6a7.2 7.2 0 0 0-1.93-.24zm-3.58.41c-.2.5-.46.97-.78 1.1-.27.13-.6.06-1-.18-.4-.24-.85-.37-1.23-.25-.4.13-.59.53-.48 1.02.05.24.24.42.39.54.04.02.05.1 0 .13-.57-.22-.96-.6-.96-1.1 0-.83.58-1.38 1.42-1.48.61-.08 1.27.18 1.79.37.06.02.08.04.08.08 0 .04-.02.07-.06.09a4.6 4.6 0 0 0-.46.28c-.05.02-.1 0-.12-.03a3.6 3.6 0 0 1-.4-.34c-.01-.02-.03-.03-.04-.03zm11.71.68c.4-.4.96-.3 1.3 0 .03.03.07.04.1.01a5 5 0 0 0 .5-.72c.03-.06.01-.12-.05-.15-.88-.42-1.9-.6-2.83-.44-.1.02-.13.12-.09.2a3.8 3.8 0 0 1 .36 1.03c.02.07.1.1.16.06z"/>
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
                <div className="flex items-start gap-2 mb-4">
                    <Heart size={15} className="text-dribly-purple shrink-0 mt-0.5" />
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                        Os dados são obtidos diretamente do site oficial da <strong>Federação Portuguesa de Basquetebol (FPB)</strong>.
                        Inclui jogos, resultados e classificações de todos os clubes registados.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {['React', 'TypeScript', 'Vite', 'Tailwind CSS', 'Supabase', 'Clerk', 'Capacitor', 'Vercel', 'PWA'].map(tech => (
                        <span key={tech} className="px-2.5 py-1 text-[10px] font-bold bg-zinc-100 dark:bg-white/10 text-zinc-700 dark:text-zinc-300 rounded-full">{tech}</span>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default About
