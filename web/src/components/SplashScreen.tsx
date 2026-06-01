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
        const t1 = setTimeout(() => setPhase('slide'), 700)
        const t2 = setTimeout(() => setPhase('done'), 1700)
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
            {/* Wrapper — centered on screen */}
            <div
                className="absolute flex items-center gap-2.5"
                style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
            >
                {/* 📦 Logo — moves LEFT */}
                <div
                    className="relative shrink-0"
                    style={{
                        transform: sliding ? 'translateX(-75px)' : 'translateX(0)',
                        transition: 'transform 1s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                >
                    <img
                        src="/logo.svg"
                        alt=""
                        className="w-16 h-16 object-contain relative z-10"
                        style={{
                            animation: phase === 'pop' ? 'logoPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both' : 'none',
                        }}
                    />
                    {phase === 'pop' && (
                        <div
                            className="absolute -inset-8 rounded-full bg-[#7C3AED]/15 blur-3xl"
                            style={{ animation: 'glowPop 0.6s ease-out both' }}
                        />
                    )}
                </div>

                {/* 📝 Text — moves RIGHT (from behind logo) */}
                <span
                    className="text-3xl font-black text-white tracking-tight whitespace-nowrap relative z-0"
                    style={{
                        opacity: sliding ? 1 : 0,
                        transform: sliding ? 'translateX(0)' : 'translateX(-80px)',
                        transition: 'opacity 0.6s ease-out, transform 1s cubic-bezier(0.4, 0, 0.2, 1)',
                        filter: sliding ? 'blur(0)' : 'blur(4px)',
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
                @keyframes glowPop {
                    0% { opacity: 0; transform: scale(0.3); }
                    50% { opacity: 0.5; }
                    100% { opacity: 0; transform: scale(1.6); }
                }
            `}</style>
        </div>
    )
}
