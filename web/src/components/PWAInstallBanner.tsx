import { useState, useEffect } from 'react'
import { Download, Share2, MoreHorizontal } from 'lucide-react'
import { Link } from 'react-router-dom'

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function PWAInstallBanner() {
    const [showBanner, setShowBanner] = useState(false)
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
    const [dismissed, setDismissed] = useState(false)
    const [canNativeInstall, setCanNativeInstall] = useState(false)

    useEffect(() => {
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches
        if (isStandalone) return

        const isDismissed = localStorage.getItem('pwa-banner-dismissed')
        if (isDismissed) return

        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
        if (!isMobile) return

        let promptFired = false

        const handleBeforeInstall = (e: Event) => {
            e.preventDefault()
            promptFired = true
            setCanNativeInstall(true)
            setDeferredPrompt(e as BeforeInstallPromptEvent)
            setShowBanner(true)
        }

        window.addEventListener('beforeinstallprompt', handleBeforeInstall)

        // Show banner after 3s for ALL mobile users (fallback if beforeinstallprompt never fires)
        const timer = setTimeout(() => {
            if (!promptFired) {
                setShowBanner(true)
            }
        }, 3000)

        return () => {
            clearTimeout(timer)
            window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
        }
    }, [])

    useEffect(() => {
        if (showBanner) setDismissed(false)
    }, [showBanner])

    async function handleNativeInstall() {
        if (!deferredPrompt) return
        await deferredPrompt.prompt()
        const result = await deferredPrompt.userChoice
        if (result.outcome === 'accepted') {
            localStorage.setItem('pwa-banner-dismissed', 'true')
            setShowBanner(false)
        }
        setDeferredPrompt(null)
        setCanNativeInstall(false)
    }

    function handleDismiss() {
        setDismissed(true)
        setTimeout(() => {
            localStorage.setItem('pwa-banner-dismissed', 'true')
            setShowBanner(false)
        }, 200)
    }

    if (!showBanner) return null

    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)
    const isAndroid = /Android/i.test(navigator.userAgent)

    function renderInstructions() {
        if (canNativeInstall && !isIOS) {
            return (
                <div className="flex flex-col gap-2.5 items-center">
                    <button onClick={handleNativeInstall}
                        className="w-full sm:w-auto px-6 py-3 bg-dribly-blue text-white text-sm font-bold rounded-xl hover:bg-dribly-blue-dim transition-colors shadow-md shadow-blue-500/20">
                        Instalar App
                    </button>
                    <button onClick={handleDismiss}
                        className="text-sm font-medium text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
                        Agora não
                    </button>
                </div>
            )
        }

        if (isIOS) {
            return (
                <>
                    <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-3.5 text-left flex items-start gap-3 max-w-xs mx-auto">
                        <div className="w-8 h-8 bg-zinc-200 dark:bg-zinc-700 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                            <Share2 size={14} className="text-zinc-500" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Instalar no iPhone</p>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                                No <span className="font-bold">Safari</span>, toca em <span className="font-bold">Partilhar</span> e depois <span className="font-bold">"Adicionar ao Ecrã Principal"</span>
                            </p>
                        </div>
                    </div>
                    <button onClick={handleDismiss}
                        className="mt-2 text-sm font-medium text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
                        Agora não
                    </button>
                </>
            )
        }

        if (isAndroid) {
            return (
                <>
                    <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-3.5 text-left flex items-start gap-3 max-w-xs mx-auto">
                        <div className="w-8 h-8 bg-zinc-200 dark:bg-zinc-700 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                            <MoreHorizontal size={14} className="text-zinc-500" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Instalar no Android</p>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                                No <span className="font-bold">Chrome</span>, toca nos <span className="font-bold">3 pontos (⋮)</span> e escolhe <span className="font-bold">"Adicionar ao ecrã inicial"</span>
                            </p>
                        </div>
                    </div>
                    <button onClick={handleDismiss}
                        className="mt-2 text-sm font-medium text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
                        Agora não
                    </button>
                </>
            )
        }

        return (
            <Link to="/instalar" onClick={handleDismiss}
                className="px-6 py-3 bg-dribly-blue text-white text-sm font-bold rounded-xl hover:bg-dribly-blue-dim transition-colors shadow-md shadow-blue-500/20">
                Ver instruções
            </Link>
        )
    }

    return (
        <>
            <div className={`fixed inset-0 z-50 bg-black/30 backdrop-blur-sm transition-opacity duration-300 ${dismissed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                onClick={handleDismiss} />

            <div className={`fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-zinc-900 rounded-t-3xl shadow-2xl transition-transform duration-300 ${dismissed ? 'translate-y-full' : 'translate-y-0'}`}>
                <div className="w-10 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full mx-auto mt-3" />

                <div className="p-5 sm:p-6 text-center">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-dribly-blue to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20">
                        <Download size={26} className="text-white" />
                    </div>

                    <h3 className="text-lg font-black text-zinc-900 dark:text-white mb-1.5">Instalar Dribly</h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-5 max-w-xs mx-auto leading-relaxed">
                        Adiciona ao ecrã inicial para acesso rápido a jogos, resultados e classificações de basquetebol.
                    </p>

                    <div className="flex flex-col gap-2.5 justify-center">
                        {renderInstructions()}
                    </div>
                </div>

                <div className="h-6 safe-area-bottom" />
            </div>
        </>
    )
}

export default PWAInstallBanner
