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
        const t1 = setTimeout(() => setFadeOut(true), 2600)
        const t2 = setTimeout(() => { setHidden(true); doneRef.current() }, 3000)
        return () => { clearTimeout(t1); clearTimeout(t2) }
    }, [])

    if (hidden) return null

    return (
        <div
            className={`fixed inset-0 z-[9999] bg-[#0D0D14] transition-opacity duration-400 ${
                fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
        >
            {/* Single DOM element — CSS handles all 3 phases */}
            <div
                className="flex items-center gap-2.5 absolute"
                style={{
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%) scale(1.6)',
                    animation: 'splashMoveAll 2.4s cubic-bezier(0.4, 0, 0.2, 1) both',
                }}
            >
                {/* Logo — same size always, scaled by parent */}
                <img
                    src="/logo.svg"
                    alt=""
                    className="w-10 h-10 sm:w-12 sm:h-12 object-contain relative z-10"
                    style={{
                        animation: 'splashLogoPop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both',
                    }}
                />
                {/* Text — emerges from behind */}
                <span
                    className="text-2xl sm:text-3xl font-black text-white tracking-tight whitespace-nowrap relative z-0"
                    style={{
                        animation: 'splashTextReveal 2.4s cubic-bezier(0.4, 0, 0.2, 1) both',
                    }}
                >
                    Dribly<span className="text-[#7C3AED]">.</span>
                </span>
            </div>

            {/* Purple glow */}
            <div
                className="absolute rounded-full bg-[#7C3AED]/15 blur-3xl"
                style={{
                    width: '180px',
                    height: '180px',
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    animation: 'splashGlowOut 0.8s ease-out both',
                }}
            />

            <style>{`
                @keyframes splashMoveAll {
                    0% {
                        left: 50%;
                        top: 50%;
                        transform: translate(-50%, -50%) scale(1.6);
                    }
                    25% {
                        left: 50%;
                        top: 50%;
                        transform: translate(-50%, -50%) scale(1.6);
                    }
                    40% {
                        left: 50%;
                        top: 50%;
                        transform: translate(-50%, -50%) scale(1.3);
                    }
                    70% {
                        transform: translate(0, -50%) scale(1);
                    }
                    100% {
                        left: calc(50% - 75px);
                        top: 50%;
                        transform: translate(0, -50%) scale(1);
                    }
                }
                @keyframes splashLogoPop {
                    0% { opacity: 0; transform: scale(0); }
                    100% { opacity: 1; transform: scale(1); }
                }
                @keyframes splashTextReveal {
                    0% { opacity: 0; transform: translateX(-60px); filter: blur(6px); }
                    28% { opacity: 0; transform: translateX(-60px); filter: blur(6px); }
                    45% { opacity: 0.3; transform: translateX(-25px); filter: blur(2px); }
                    65% { opacity: 1; transform: translateX(0); filter: blur(0); }
                    100% { opacity: 1; transform: translateX(0); filter: blur(0); }
                }
                @keyframes splashGlowOut {
                    0% { opacity: 0; transform: translate(-50%, -50%) scale(0.3); }
                    50% { opacity: 0.5; }
                    100% { opacity: 0; transform: translate(-50%, -50%) scale(1.8); }
                }
            `}</style>
        </div>
    )
}
