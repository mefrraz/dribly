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
        const t1 = setTimeout(() => setPhase('slide'), 800)
        const t2 = setTimeout(() => setPhase('done'), 1800)
        const t3 = setTimeout(() => setFadeOut(true), 2300)
        const t4 = setTimeout(() => { setHidden(true); doneRef.current() }, 2700)
        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4) }
    }, [])

    if (hidden) return null

    const sliding = phase === 'slide' || phase === 'done'

    return (
        <div
            className={`fixed inset-0 z-[9999] bg-[#0D0D14] transition-opacity duration-400 ${
                fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
        >
            {/* Phase 1: Logo centered absolutely */}
            {phase === 'pop' && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="relative">
                        <img
                            src="/logo.svg"
                            alt=""
                            className="w-16 h-16 object-contain"
                            style={{ animation: 'logoPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both' }}
                        />
                        <div
                            className="absolute -inset-8 rounded-full bg-[#7C3AED]/15 blur-3xl"
                            style={{ animation: 'glowPop 0.6s ease-out both' }}
                        />
                    </div>
                </div>
            )}

            {/* Phase 2+3: Logo + text in flex row, logo slides left, text slides right */}
            {sliding && (
                <div
                    className="absolute flex items-center gap-2.5"
                    style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
                >
                    {/* Logo — slides LEFT */}
                    <div
                        className="relative shrink-0 z-10"
                        style={{
                            animation: 'logoSlide 1s cubic-bezier(0.4, 0, 0.2, 1) both',
                        }}
                    >
                        <img src="/logo.svg" alt="" className="w-16 h-16 object-contain" />
                    </div>

                    {/* Text — slides RIGHT from behind logo */}
                    <span
                        className="text-3xl font-black text-white tracking-tight whitespace-nowrap relative z-0"
                        style={{ animation: 'textSlideIn 1s cubic-bezier(0.4, 0, 0.2, 1) both' }}
                    >
                        Dribly<span className="text-[#7C3AED]">.</span>
                    </span>
                </div>
            )}

            <style>{`
                @keyframes logoPop {
                    0% { opacity: 0; transform: scale(0); }
                    100% { opacity: 1; transform: scale(1); }
                }
                @keyframes logoSlide {
                    0% { transform: translateX(20px); }
                    100% { transform: translateX(-30px); }
                }
                @keyframes textSlideIn {
                    0% { opacity: 0; transform: translateX(-60px); }
                    20% { opacity: 0; }
                    60% { opacity: 1; }
                    100% { opacity: 1; transform: translateX(0); }
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
