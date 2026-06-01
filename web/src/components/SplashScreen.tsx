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
        // Phase timing
        const t1 = setTimeout(() => setPhase('slide'), 800)
        const t2 = setTimeout(() => setPhase('done'), 2000)
        const t3 = setTimeout(() => setFadeOut(true), 2600)
        const t4 = setTimeout(() => { setHidden(true); doneRef.current() }, 3000)
        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4) }
    }, [])

    if (hidden) return null

    const isDone = phase === 'done'

    return (
        <div
            className={`fixed inset-0 z-[9999] bg-[#0D0D14] transition-opacity duration-400 ${
                fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
        >
            {/* Phase 1: Logo centered — pop animation */}
            {phase === 'pop' && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <img
                        src="/logo.svg"
                        alt=""
                        className="w-16 h-16 sm:w-20 sm:h-20 object-contain"
                        style={{
                            animation: 'logoPop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both',
                        }}
                    />
                    {/* Glow pulse */}
                    <div
                        className="absolute rounded-full bg-[#7C3AED]/15 blur-3xl"
                        style={{
                            width: '180px',
                            height: '180px',
                            animation: 'glowPulse 0.7s ease-out both',
                        }}
                    />
                    <style>{`
                        @keyframes logoPop {
                            0% { opacity: 0; transform: scale(0.1); }
                            100% { opacity: 1; transform: scale(1); }
                        }
                        @keyframes glowPulse {
                            0% { opacity: 0; transform: scale(0.3); }
                            50% { opacity: 0.5; }
                            100% { opacity: 0; transform: scale(1.8); }
                        }
                    `}</style>
                </div>
            )}

            {/* Phase 2+3: Logo slides left, text emerges from behind */}
            {(phase === 'slide' || isDone) && (
                <div
                    className={`absolute flex items-center gap-2.5 ${isDone ? 'opacity-100' : ''}`}
                    style={isDone
                        ? { left: 'calc(50% - 75px)', top: '50%', transform: 'translateY(-50%)' }
                        : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)', animation: 'wrapSlide 1.2s cubic-bezier(0.4, 0, 0.2, 1) both' }
                    }
                >
                    {/* Logo — on top (z-10) */}
                    <img
                        src="/logo.svg"
                        alt=""
                        className="w-10 h-10 sm:w-12 sm:h-12 object-contain relative z-10"
                    />
                    {/* Text — behind logo (z-0), emerges from under */}
                    <span
                        className="text-2xl sm:text-3xl font-black text-white tracking-tight whitespace-nowrap relative z-0"
                        style={isDone
                            ? { opacity: 1, transform: 'translateX(0)', filter: 'blur(0)' }
                            : { opacity: 0, transform: 'translateX(-50px)', filter: 'blur(4px)', animation: 'textEmerge 1.2s cubic-bezier(0.4, 0, 0.2, 1) both' }
                        }
                    >
                        Dribly<span className="text-[#7C3AED]">.</span>
                    </span>
                </div>
            )}

            <style>{`
                @keyframes wrapSlide {
                    0% { left: 50%; top: 50%; transform: translate(-50%, -50%) scale(1.4); }
                    100% { left: calc(50% - 75px); top: 50%; transform: translate(0, -50%) scale(1); }
                }
                @keyframes textEmerge {
                    0% { opacity: 0; transform: translateX(-50px); filter: blur(4px); }
                    30% { opacity: 0; }
                    60% { opacity: 0.5; transform: translateX(-15px); filter: blur(1px); }
                    100% { opacity: 1; transform: translateX(0); filter: blur(0); }
                }
            `}</style>
        </div>
    )
}
