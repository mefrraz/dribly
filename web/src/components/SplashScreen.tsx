import { useState, useEffect, useRef } from 'react'

interface SplashScreenProps {
    onDone: () => void
}

export default function SplashScreen({ onDone }: SplashScreenProps) {
    const [phase, setPhase] = useState<'pop' | 'slide' | 'text' | 'done'>('pop')
    const [fadeOut, setFadeOut] = useState(false)
    const [hidden, setHidden] = useState(false)
    const doneRef = useRef(onDone)
    doneRef.current = onDone

    useEffect(() => {
        const t1 = setTimeout(() => setPhase('slide'), 700)
        const t2 = setTimeout(() => setPhase('text'), 1500)
        const t3 = setTimeout(() => setPhase('done'), 2200)
        const t4 = setTimeout(() => setFadeOut(true), 2700)
        const t5 = setTimeout(() => { setHidden(true); doneRef.current() }, 3100)
        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(t5) }
    }, [])

    if (hidden) return null

    return (
        <div
            className={`fixed inset-0 z-[9999] bg-[#0D0D14] transition-opacity duration-400 ${
                fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
        >
            {/* Everything in one flex row — CSS classes drive the animation */}
            <div
                className={`absolute top-1/2 -translate-y-1/2 flex items-center gap-2.5 transition-all duration-1000 ease-out
                    ${phase === 'pop' ? 'left-1/2 -translate-x-1/2' : ''}
                    ${phase !== 'pop' ? 'left-[calc(50%-75px)] translate-x-0' : ''}
                `}
            >
                {/* Logo */}
                <div className="relative">
                    <img
                        src="/logo.svg"
                        alt=""
                        className={`w-16 h-16 object-contain relative z-10 transition-all duration-500
                            ${phase === 'pop' ? 'opacity-0 scale-0 animate-[logoPop_0.5s_cubic-bezier(0.34,1.56,0.64,1)_forwards]' : 'opacity-100 scale-100'}
                        `}
                    />
                    {/* Glow */}
                    {phase === 'pop' && (
                        <div
                            className="absolute -inset-8 rounded-full bg-[#7C3AED]/15 blur-3xl animate-[glowPop_0.6s_ease-out_both]"
                        />
                    )}
                </div>

                {/* Text */}
                <span
                    className={`text-3xl font-black text-white tracking-tight whitespace-nowrap relative z-0 transition-all duration-500
                        ${phase === 'text' || phase === 'done' ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-5'}
                    `}
                >
                    Dribly<span className="text-[#7C3AED]">.</span>
                </span>
            </div>

            <style>{`
                @keyframes logoPop {
                    0% { opacity: 0; transform: scale(0); }
                    100% { opacity: 1; transform: scale(1); }
                }
                @keyframes glowPop {
                    0% { opacity: 0; transform: scale(0.3); }
                    50% { opacity: 0.5; }
                    100% { opacity: 0; transform: scale(1.6); }
                }
            `}</style>
        </div>
    )
}
