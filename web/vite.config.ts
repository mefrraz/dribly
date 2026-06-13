import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
    // Inject build-time constants — available in SW and app code
    define: {
        __GIT_HASH__: JSON.stringify(
            process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'dev'
        ),
        __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
        __VAPID_PUBLIC_KEY__: JSON.stringify(
            process.env.VITE_VAPID_PUBLIC_KEY || ''
        ),
    },
    server: {
        proxy: {
            '/api/fpb': {
                target: 'https://www.fpb.pt',
                changeOrigin: true,
                rewrite: (path) => {
                    // Map /api/fpb?page=calendario&clube=169&epoca=2025/2026
                    // to /calendario/clube_169/?epoca=2025/2026&escalao=Sénior&genero=masculino
                    const qIndex = path.indexOf('?')
                    const qs = qIndex >= 0 ? path.slice(qIndex) : ''
                    const params = new URLSearchParams(qs)
                    const page = params.get('page') || 'calendario'

                    if (page === 'atleta') {
                        const id = params.get('id') || ''
                        return `/atletas/${id}/`
                    }

                    const clube = params.get('clube') || '119'
                    const epoca = params.get('epoca') || '2025/2026'
                    return `/${page}/clube_${clube}/?epoca=${epoca}&escalao=S%C3%A9nior&genero=masculino`
                }
            }
        }
    },
    plugins: [
        react(),
        {
            name: 'html-version',
            transformIndexHtml(html) {
                const hash = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'dev'
                return html.replace('</head>', `    <meta name="version" content="${hash}">\n  </head>`)
            }
        },
        VitePWA({
            // Custom SW (sw.ts) — injectManifest strategy
            strategies: 'injectManifest',
            srcDir: 'src',
            filename: 'sw.ts',
            registerType: 'autoUpdate',
            injectManifest: {
                // Exclude index.html from precache — HTML is served via
                // NetworkFirst in the custom SW so it's never stale.
                globIgnores: ['**/index.html'],
            },
            includeAssets: ['logo.png'],
            manifest: {
                name: 'Dribly',
                short_name: 'Dribly',
                description: 'Resultados e agenda de todos os clubes de basquetebol em Portugal',
                theme_color: '#7C3AED',
                background_color: '#000000',
                display: 'standalone',
                scope: '/',
                start_url: '/',
                orientation: 'portrait',
                icons: [
                    {
                        src: 'logo.svg',
                        sizes: 'any',
                        type: 'image/svg+xml',
                        purpose: 'any'
                    },
                    {
                        src: 'logo.png',
                        sizes: '192x192',
                        type: 'image/png',
                        purpose: 'any'
                    },
                    {
                        src: 'logo.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'maskable'
                    }
                ]
            }
        })
    ],
}))
