import { useState, useEffect, useRef } from 'react'

interface SplashScreenProps {
    onDone: () => void
}

export default function SplashScreen({ onDone }: SplashScreenProps) {
    const [fadeOut, setFadeOut] = useState(false)
    const [hidden, setHidden] = useState(false)
    const doneRef = useRef(onDone)
    doneRef.current = onDone

    useEffect(() => {
        const t1 = setTimeout(() => setFadeOut(true), 2200)
        const t2 = setTimeout(() => {
            setHidden(true)
            doneRef.current()
        }, 2600)
        return () => { clearTimeout(t1); clearTimeout(t2) }
    }, [])

    if (hidden) return null

    return (
        <div
            className={`fixed inset-0 z-[9999] bg-[#0D0D14] flex items-center justify-center transition-opacity duration-400 ${
                fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
        >
            {/* Animated container: logo pops in center, then slides left */}
            <div className="relative flex items-center gap-4">
                {/* Logo image */}
                <img
                    src="/logo.svg"
                    alt=""
                    className="w-16 h-16 sm:w-20 sm:h-20 object-contain"
                    style={{
                        animation: 'splashLogo 1.6s cubic-bezier(0.34, 1.56, 0.64, 1) both',
                    }}
                />
                {/* Text "Dribly" */}
                <span
                    className="text-3xl sm:text-4xl font-black text-white tracking-tight"
                    style={{
                        animation: 'splashText 1.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s both',
                    }}
                >
                    Dribly<span className="text-[#7C3AED]">.</span>
                </span>
            </div>

            {/* Purple glow behind logo during pop */}
            <div
                className="absolute rounded-full bg-[#7C3AED]/20 blur-3xl"
                style={{
                    width: '200px',
                    height: '200px',
                    animation: 'splashGlow 1s ease-out both',
                }}
            />

            <style>{`
                @keyframes splashLogo {
                    0% {
                        opacity: 0;
                        transform: scale(0) translateX(0);
                    }
                    30% {
                        opacity: 1;
                        transform: scale(1.15) translateX(0);
                    }
                    45% {
                        transform: scale(1) translateX(0);
                    }
                    100% {
                        opacity: 1;
                        transform: scale(1) translateX(0);
                    }
                }
                @keyframes splashText {
                    0% {
                        opacity: 0;
                        transform: translateY(40px);
                    }
                    40% {
                        opacity: 0;
                        transform: translateY(40px);
                    }
                    65% {
                        opacity: 1;
                        transform: translateY(0);
                    }
                    100% {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                @keyframes splashGlow {
                    0% {
                        opacity: 0;
                        transform: scale(0);
                    }
                    50% {
                        opacity: 0.6;
                        transform: scale(1.3);
                    }
                    100% {
                        opacity: 0;
                        transform: scale(2);
                    }
                }
            `}</style>
        </div>
    )
}
