import { useState, useEffect, useRef } from 'react'

interface SplashScreenProps {
    onDone: () => void
}

export default function SplashScreen({ onDone }: SplashScreenProps) {
    const [phase, setPhase] = useState<'pop' | 'slide' | 'done'>('pop')
    const [fadeOut, setFadeOut] = useState(false)
    const [hidden, setHidden] = useState(false)
    const doneRef = useRef(onDone)
    doneRef.current = onDone

    useEffect(() => {
        const t1 = setTimeout(() => setPhase('slide'), 500)
        const t2 = setTimeout(() => setPhase('done'), 1600)
        const t3 = setTimeout(() => setFadeOut(true), 2800)
        const t4 = setTimeout(() => { setHidden(true); doneRef.current() }, 3500)
        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4) }
    }, [])

    if (hidden) return null

    const popping = phase === 'pop'
    const sliding = phase === 'slide' || phase === 'done'

    return (
        <div
            className={`fixed inset-0 z-[9999] bg-[#0D0D14] transition-opacity duration-700 ${
                fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
        >
            {/* Single DOM — CSS handles both phases */}
            <div
                className="absolute flex items-center gap-1.5"
                style={{
                    left: '50%',
                    top: '50%',
                    transform: popping
                        ? 'translate(-50%, -50%)'
                        : 'translate(-50%, -50%)',
                }}
            >
                {/* Logo container — with persistent glow */}
                <div
                    className="relative shrink-0 z-10"
                    style={{
                        transform: popping ? 'translateX(70px)' : sliding ? 'translateX(-30px)' : 'translateX(70px)',
                        transition: sliding ? 'transform 1s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
                    }}
                >
                    <img src="/logo.svg" alt="" className="w-16 h-16 object-contain relative z-10" style={{ animation: popping ? 'logoPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both' : 'none' }} />
                    {/* Glow — ALWAYS visible during pop, fades during slide */}
                    <div
                        className="absolute -inset-8 rounded-full bg-[#7C3AED]/10 blur-3xl"
                        style={{
                            animation: popping
                                ? 'glowPop 0.5s ease-out both'
                                : sliding
                                    ? 'fadeOut 0.6s ease-out forwards'
                                    : 'none',
                        }}
                    />
                </div>

                {/* Text — hidden during pop, slides in from behind logo */}
                <span
                    className="text-3xl font-black text-white tracking-tight whitespace-nowrap relative z-0"
                    style={{
                        animation: popping
                            ? 'none'
                            : 'textSlideIn 1s cubic-bezier(0.4, 0, 0.2, 1) forwards',
                        opacity: popping ? 0 : undefined,
                    }}
                >
                    Dribly<span className="text-[#7C3AED]">.</span>
                </span>
            </div>

            <style>{`
                @keyframes logoPop {
                    0% { opacity: 0; transform: scale(0); }
                    100% { opacity: 1; transform: scale(1); }
                }
                @keyframes textSlideIn {
                    0% { opacity: 0; transform: translateX(-50px); }
                    30% { opacity: 0; transform: translateX(-50px); }
                    65% { opacity: 1; transform: translateX(0); }
                    100% { opacity: 1; transform: translateX(0); }
                }
                @keyframes glowPop {
                    0% { opacity: 0; transform: scale(0.3); }
                    50% { opacity: 0.6; }
                    100% { opacity: 0.4; transform: scale(1.4); }
                }
                @keyframes fadeOut {
                    0% { opacity: 0.4; }
                    100% { opacity: 0; }
                }
            `}</style>
        </div>
    )
}
