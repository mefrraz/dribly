import { PageHeader } from '../components/PageHeader'
import { SeoHead } from '../components/SeoHead'

function Privacy() {
    return (
        <div className="max-w-xl mx-auto space-y-5 pb-24 px-3">
            <SeoHead title="Política de Privacidade" description="Como a Dribly recolhe e protege os teus dados pessoais." />
            <PageHeader title="Voltar" />

            <div className="glass-card p-6 space-y-5">
                <h1 className="text-xl font-black text-zinc-900 dark:text-white">Política de Privacidade</h1>
                <p className="text-xs text-zinc-400">Última atualização: Junho 2026</p>

                <div className="space-y-4 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    <section>
                        <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-200 mb-2">1. Que dados recolhemos</h2>
                        <p>
                            A Dribly recolhe apenas os dados estritamente necessários para o funcionamento da aplicação:
                        </p>
                        <ul className="list-disc list-inside mt-2 space-y-1 text-zinc-500 dark:text-zinc-400">
                            <li><strong>Email e nome</strong> — fornecidos por ti ao criar conta (via Clerk).</li>
                            <li><strong>Clubes e ligas que segues</strong> — para personalizar a tua página de Seguidos.</li>
                            <li><strong>Dados de navegação anónimos</strong> — páginas visitadas, tempo de sessão (via Vercel Analytics).</li>
                            <li><strong>Localização aproximada</strong> — apenas quando usas o botão "Localizar-me" no mapa. Não é guardada.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-200 mb-2">2. Como usamos os teus dados</h2>
                        <ul className="list-disc list-inside space-y-1 text-zinc-500 dark:text-zinc-400">
                            <li>Para autenticar a tua conta e manter a sessão ativa.</li>
                            <li>Para mostrar os clubes e ligas que decidiste seguir.</li>
                            <li>Para perceber que funcionalidades são mais usadas e melhorar a app.</li>
                        </ul>
                        <p className="mt-2">Nunca vendemos, partilhamos ou usamos os teus dados para publicidade.</p>
                    </section>

                    <section>
                        <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-200 mb-2">3. Onde ficam os teus dados</h2>
                        <ul className="list-disc list-inside space-y-1 text-zinc-500 dark:text-zinc-400">
                            <li><strong>Autenticação:</strong> Clerk, Inc. (EUA) — certificado SOC 2, em conformidade com o RGPD.</li>
                            <li><strong>Base de dados:</strong> Supabase (UE — servidores em Frankfurt).</li>
                            <li><strong>Analytics:</strong> Vercel Inc. — dados anónimos e agregados.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-200 mb-2">4. Os teus direitos (RGPD)</h2>
                        <p>Tens direito a:</p>
                        <ul className="list-disc list-inside mt-1 space-y-1 text-zinc-500 dark:text-zinc-400">
                            <li><strong>Aceder</strong> aos teus dados — disponíveis no teu perfil.</li>
                            <li><strong>Retificar</strong> — podes editar nome e bio no perfil.</li>
                            <li><strong>Apagar</strong> — podes apagar a tua conta a qualquer momento (Perfil → Apagar Conta).</li>
                            <li><strong>Portabilidade</strong> — solicita por email e exportamos os teus dados.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-200 mb-2">5. Cookies e armazenamento local</h2>
                        <p>
                            A Dribly não usa cookies de rastreamento. Usamos <strong>localStorage</strong> para guardar:
                        </p>
                        <ul className="list-disc list-inside mt-1 space-y-1 text-zinc-500 dark:text-zinc-400">
                            <li>A tua preferência de tema (claro/escuro).</li>
                            <li>Cache de dados para acesso offline (PWA).</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-200 mb-2">6. Contacto</h2>
                        <p>
                            Para qualquer dúvida sobre privacidade ou para exercer os teus direitos:<br />
                            📧 <a href="mailto:me.frraz@gmail.com" className="text-dribly-purple hover:underline">me.frraz@gmail.com</a>
                        </p>
                    </section>
                </div>
            </div>

            <div className="glass-card p-6">
                <p className="text-xs text-zinc-400 text-center">
                    Este documento pode ser atualizado. Aconselhamos a consulta regular.
                </p>
            </div>
        </div>
    )
}

export default Privacy