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
        const t2 = setTimeout(() => {
            setHidden(true)
            doneRef.current()
        }, 3000)
        return () => { clearTimeout(t1); clearTimeout(t2) }
    }, [])

    if (hidden) return null

    return (
        <div
            className={`fixed inset-0 z-[9999] bg-[#0D0D14] flex items-center justify-center transition-opacity duration-400 ${
                fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
        >
            {/* Container — animates position from center to final spot */}
            <div
                className="flex items-center gap-2.5"
                style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%) scale(1.5)',
                    animation: 'splashV7Wrap 2.2s cubic-bezier(0.4, 0, 0.2, 1) both',
                }}
            >
                {/* Logo — z-10 so it's on top of text */}
                <img
                    src="/logo.svg"
                    alt=""
                    className="w-10 h-10 sm:w-12 sm:h-12 object-contain relative z-10"
                    style={{
                        animation: 'splashV7Logo 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both',
                    }}
                />
                {/* Text — behind logo (z-0), slides out to right */}
                <span
                    className="text-2xl sm:text-3xl font-black text-white tracking-tight whitespace-nowrap relative z-0"
                    style={{
                        animation: 'splashV7Text 2.2s cubic-bezier(0.4, 0, 0.2, 1) both',
                    }}
                >
                    Dribly<span className="text-[#7C3AED]">.</span>
                </span>
            </div>

            {/* Purple pulse on pop */}
            <div
                className="absolute rounded-full bg-[#7C3AED]/15 blur-3xl"
                style={{
                    width: '180px',
                    height: '180px',
                    animation: 'splashV7Pulse 0.8s ease-out both',
                }}
            />

            <style>{`
                @keyframes splashV7Wrap {
                    0% {
                        left: 50%;
                        top: 50%;
                        transform: translate(-50%, -50%) scale(1.5);
                    }
                    35% {
                        left: 50%;
                        top: 50%;
                        transform: translate(-50%, -50%) scale(1.5);
                    }
                    50% {
                        left: 50%;
                        top: 50%;
                        transform: translate(-50%, -50%) scale(1.2);
                    }
                    100% {
                        left: calc(50% - 60px);
                        top: 50%;
                        transform: translate(0, -50%) scale(1);
                    }
                }
                @keyframes splashV7Logo {
                    0% {
                        opacity: 0;
                        transform: scale(0);
                    }
                    100% {
                        opacity: 1;
                        transform: scale(1);
                    }
                }
                @keyframes splashV7Text {
                    0% {
                        opacity: 0;
                        transform: translateX(-60px);
                        filter: blur(6px);
                    }
                    40% {
                        opacity: 0;
                        transform: translateX(-60px);
                        filter: blur(6px);
                    }
                    55% {
                        opacity: 0.4;
                        transform: translateX(-30px);
                        filter: blur(2px);
                    }
                    75% {
                        opacity: 1;
                        transform: translateX(0);
                        filter: blur(0);
                    }
                    100% {
                        opacity: 1;
                        transform: translateX(0);
                        filter: blur(0);
                    }
                }
                @keyframes splashV7Pulse {
                    0% {
                        opacity: 0;
                        transform: scale(0.3);
                    }
                    50% {
                        opacity: 0.6;
                    }
                    100% {
                        opacity: 0;
                        transform: scale(1.8);
                    }
                }
            `}</style>
        </div>
    )
}
