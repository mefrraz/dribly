import { Instagram, Github } from 'lucide-react'

declare const __GIT_HASH__: string
import { PageHeader } from '../components/PageHeader'
import { SeoHead } from '../components/SeoHead'

// Bootstrap Icons — bi-reddit
const RedditIcon = ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
        <path d="M6.167 8a.83.83 0 0 0-.83.83c0 .459.372.84.83.831a.831.831 0 0 0 0-1.661m1.843 3.647c.315 0 1.403-.038 1.976-.611a.23.23 0 0 0 0-.306.213.213 0 0 0-.306 0c-.353.363-1.126.487-1.67.487-.545 0-1.308-.124-1.671-.487a.213.213 0 0 0-.306 0 .213.213 0 0 0 0 .306c.564.563 1.652.61 1.977.61zm.992-2.807c0 .458.373.83.831.83s.83-.381.83-.83a.831.831 0 0 0-1.66 0z"/>
        <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0m-3.828-1.165c-.315 0-.602.124-.812.325-.801-.573-1.9-.945-3.121-.993l.534-2.501 1.738.372a.83.83 0 1 0 .83-.869.83.83 0 0 0-.744.468l-1.938-.41a.2.2 0 0 0-.153.028.2.2 0 0 0-.086.134l-.592 2.788c-1.24.038-2.358.41-3.17.992-.21-.2-.496-.324-.81-.324a1.163 1.163 0 0 0-.478 2.224q-.03.17-.029.353c0 1.795 2.091 3.256 4.669 3.256s4.668-1.451 4.668-3.256c0-.114-.01-.238-.029-.353.401-.181.688-.592.688-1.069 0-.65-.525-1.165-1.165-1.165"/>
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
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
                    Os dados são obtidos diretamente do site oficial da <strong>Federação Portuguesa de Basquetebol (FPB)</strong>.
                    Inclui jogos, resultados e classificações de todos os clubes registados.
                </p>
                <div className="flex flex-wrap gap-2">
                    {['React', 'TypeScript', 'Vite', 'Tailwind CSS', 'Supabase', 'Clerk', 'Capacitor', 'Vercel', 'PWA'].map(tech => (
                        <span key={tech} className="px-2.5 py-1 text-[10px] font-bold bg-zinc-100 dark:bg-white/10 text-zinc-700 dark:text-zinc-300 rounded-full">{tech}</span>
                    ))}
                </div>
            </div>

            {/* Version */}
            <div className="glass-card p-5 text-center">
                <p className="text-[10px] text-zinc-400 uppercase tracking-wider mb-2">Compilação atual</p>
                <p className="text-sm font-mono font-bold text-zinc-700 dark:text-zinc-200 bg-zinc-50 dark:bg-white/5 rounded-lg px-3 py-1.5 inline-block">
                    {__GIT_HASH__}
                </p>
                <p className="text-[10px] text-zinc-400 mt-2">
                    Este site é atualizado automaticamente a cada alteração no código fonte.
                </p>
            </div>
        </div>
    )
}

export default About
