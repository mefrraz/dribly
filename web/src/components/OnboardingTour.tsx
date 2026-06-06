import { useState, useEffect } from 'react'
import { Star, Heart, LogIn, UserPlus, ArrowRight, X, Check } from 'lucide-react'
import { type TourTrigger, markOnboardingDone } from './onboardingState'

// Re-export for backward compatibility
// eslint-disable-next-line react-refresh/only-export-components
export { type TourTrigger, isOnboardingDone, markOnboardingDone, triggerOnboarding } from './onboardingState'

interface TourStep {
    /** Icon component */
    Icon: typeof Star
    title: string
    description: string
    /** Optional accent color class (tailwind text-*) */
    accent?: string
    /** Optional background gradient for the icon circle */
    bgGradient?: string
}

function buildSteps(trigger: TourTrigger): TourStep[] {
    const steps: TourStep[] = []

    if (trigger === 'signup' || trigger === 'login') {
        steps.push({
            Icon: trigger === 'signup' ? UserPlus : LogIn,
            title: trigger === 'signup' ? 'Conta criada!' : 'Bem-vindo de volta!',
            description:
                trigger === 'signup'
                    ? 'Agora com conta podes favoritar e seguir clubes e competições. Vamos ver como funciona.'
                    : 'Com sessão iniciada tens funcionalidades extra. Vamos ver o que podes fazer.',
            accent: 'text-dribly-purple',
            bgGradient: 'from-dribly-purple/20 to-dribly-purple/5',
        })
    }

    steps.push(
        {
            Icon: Star,
            title: 'Favoritar clubes',
            description:
                'Toca na estrela ⭐ na página de um clube para o tornares no teu favorito. Ele fica sempre no topo da navegação.',
            accent: 'text-yellow-500',
            bgGradient: 'from-yellow-500/20 to-yellow-500/5',
        },
        {
            Icon: Heart,
            title: 'Seguir clubes e competições',
            description:
                'Toca no coração ❤️ para seguir vários clubes e vê-los todos reunidos na página Seguidos. Também podes seguir competições.',
            accent: 'text-red-500',
            bgGradient: 'from-red-500/20 to-red-500/5',
        },
        {
            Icon: ArrowRight,
            title: 'Acesso rápido',
            description:
                'A navegação mostra sempre o teu clube favorito para acesso instantâneo. Basta um toque para veres jogos, classificações e mais.',
            accent: 'text-dribly-purple',
            bgGradient: 'from-dribly-purple/20 to-dribly-purple/5',
        },
        {
            Icon: Check,
            title: 'Tudo pronto!',
            description:
                'Já sabes o essencial. Usa a pesquisa para encontrar clubes ou competições e começa a seguir os teus favoritos.',
            accent: 'text-green-500',
            bgGradient: 'from-green-500/20 to-green-500/5',
        },
    )

    return steps
}

interface OnboardingTourProps {
    onComplete: () => void
    trigger?: TourTrigger
}

export function OnboardingTour({ onComplete, trigger = 'manual' }: OnboardingTourProps) {
    const [step, setStep] = useState(0)
    const [visible, setVisible] = useState(false)
    const [exiting, setExiting] = useState(false)
    const steps = buildSteps(trigger)

    useEffect(() => {
        const t = setTimeout(() => setVisible(true), 300)
        return () => clearTimeout(t)
    }, [])

    const goNext = () => {
        if (step >= steps.length - 1) {
            finish()
            return
        }
        setVisible(false)
        setTimeout(() => {
            setStep((s) => s + 1)
            // Small delay then fade in
            setTimeout(() => setVisible(true), 80)
        }, 250)
    }

    const goBack = () => {
        if (step === 0) return
        setVisible(false)
        setTimeout(() => {
            setStep((s) => s - 1)
            setTimeout(() => setVisible(true), 80)
        }, 250)
    }

    const finish = () => {
        setExiting(true)
        setTimeout(() => {
            markOnboardingDone()
            onComplete()
        }, 350)
    }

    const current = steps[step]
    if (!current) return null
    const { Icon, title, description, accent = 'text-dribly-purple', bgGradient = 'from-dribly-purple/20 to-dribly-purple/5' } = current

    const isLast = step === steps.length - 1
    const isFirst = step === 0

    return (
        <div
            className={`fixed inset-0 z-[200] flex items-center justify-center p-4 transition-all duration-400 ${
                exiting ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
            }`}
            role="dialog"
            aria-modal="true"
            aria-label="Tour de introdução"
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            {/* Card */}
            <div
                className={`relative z-10 w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200 dark:border-white/10 p-7 transition-all duration-300 ${
                    visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-6 scale-[0.97]'
                }`}
            >
                {/* Close button */}
                <button
                    onClick={finish}
                    className="absolute top-4 right-4 p-1.5 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
                >
                    <X size={16} />
                </button>

                {/* Icon */}
                <div
                    className={`w-16 h-16 mx-auto rounded-full bg-gradient-to-br ${bgGradient} flex items-center justify-center mb-5`}
                >
                    <Icon size={30} className={accent} />
                </div>

                {/* Text */}
                <h3 className="text-xl font-black text-zinc-900 dark:text-white text-center mb-2">{title}</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center leading-relaxed mb-8">{description}</p>

                {/* Dots */}
                <div className="flex items-center justify-center gap-1.5 mb-5">
                    {steps.map((_, i) => (
                        <div
                            key={i}
                            className={`rounded-full transition-all duration-300 ${
                                i === step
                                    ? 'w-6 h-1.5 bg-dribly-purple'
                                    : 'w-1.5 h-1.5 bg-zinc-200 dark:bg-zinc-700'
                            }`}
                        />
                    ))}
                </div>

                {/* Buttons */}
                <div className="flex items-center gap-3">
                    {!isFirst && (
                        <button
                            onClick={goBack}
                            className="px-4 py-2.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-sm font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all active:scale-[0.97]"
                        >
                            Voltar
                        </button>
                    )}
                    <button
                        onClick={goNext}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full font-bold text-sm transition-all active:scale-[0.97] shadow-sm ${
                            isLast
                                ? 'bg-green-500 text-white hover:bg-green-600 shadow-green-500/25'
                                : 'bg-dribly-purple text-white hover:bg-dribly-purple/90 shadow-dribly-purple/25'
                        }`}
                    >
                        {isLast ? (
                            <>
                                Começar <Check size={16} />
                            </>
                        ) : (
                            <>
                                Seguinte <ArrowRight size={15} />
                            </>
                        )}
                    </button>
                </div>

                {/* Skip */}
                {!isLast && (
                    <button
                        onClick={finish}
                        className="block mx-auto mt-4 text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                    >
                        Saltar tour
                    </button>
                )}
            </div>
        </div>
    )
}
