import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
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
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['logo.png', 'index.html'],
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
            },
            workbox: {
                // Force SW to take control immediately (avoids stale bundles)
                skipWaiting: true,
                clientsClaim: true,
                // Cache Supabase API responses for offline access
                runtimeCaching: [
                    {
                        // Always fetch fresh HTML (never serve stale)
                        urlPattern: ({ request }) => request.destination === 'document',
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'html-cache',
                            expiration: { maxEntries: 5, maxAgeSeconds: 60 },
                            cacheableResponse: { statuses: [0, 200] }
                        }
                    },
                    {
                        // Cache FPB proxy responses (stale-while-revalidate)
                        urlPattern: /\/api\/fpb/i,
                        handler: 'StaleWhileRevalidate',
                        options: {
                            cacheName: 'fpb-api-cache',
                            expiration: {
                                maxEntries: 50,
                                maxAgeSeconds: 60 * 15 // 15 minutes
                            },
                            cacheableResponse: {
                                statuses: [0, 200]
                            }
                        }
                    },
                    {
                        // Cache Supabase REST API calls
                        urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'supabase-api-cache',
                            expiration: {
                                maxEntries: 100,
                                maxAgeSeconds: 60 * 60 * 2 // 2 hours
                            },
                            cacheableResponse: {
                                statuses: [0, 200]
                            }
                        }
                    },
                    {
                        // Cache Google Fonts
                        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'google-fonts-cache',
                            expiration: {
                                maxEntries: 10,
                                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
                            }
                        }
                    }
                ]
            }
        })
    ],
})
