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
            <div className="relative" style={{ width: '280px', height: '80px' }}>
                {/* Logo — starts centered, slides left */}
                <img
                    src="/logo.svg"
                    alt=""
                    className="absolute w-16 h-16 sm:w-20 sm:h-20 object-contain"
                    style={{
                        top: '50%',
                        transform: 'translateY(-50%)',
                        left: '50%',
                        marginLeft: '-40px',
                        animation: 'splashV6Logo 2s cubic-bezier(0.4, 0, 0.2, 1) both',
                    }}
                />
                {/* Text — emerges from under the logo as it slides left */}
                <span
                    className="absolute text-3xl sm:text-4xl font-black text-white tracking-tight whitespace-nowrap"
                    style={{
                        top: '50%',
                        transform: 'translateY(-50%)',
                        left: '120px',
                        opacity: 0,
                        animation: 'splashV6Text 2s cubic-bezier(0.4, 0, 0.2, 1) 0.05s both',
                    }}
                >
                    Dribly<span className="text-[#7C3AED]">.</span>
                </span>
            </div>

            {/* Purple pulse behind logo on pop */}
            <div
                className="absolute rounded-full bg-[#7C3AED]/20 blur-3xl"
                style={{
                    width: '200px',
                    height: '200px',
                    animation: 'splashV6Pulse 1s ease-out both',
                }}
            />

            <style>{`
                @keyframes splashV6Logo {
                    0% {
                        opacity: 0;
                        transform: scale(0) translateY(-50%);
                    }
                    15% {
                        opacity: 1;
                        transform: scale(1.12) translateY(-50%);
                    }
                    25% {
                        transform: scale(1) translateY(-50%);
                    }
                    50% {
                        left: 50%;
                        margin-left: -40px;
                        opacity: 1;
                    }
                    85% {
                        left: 0;
                        margin-left: 0;
                        opacity: 1;
                    }
                    100% {
                        left: 0;
                        margin-left: 0;
                        opacity: 1;
                    }
                }
                @keyframes splashV6Text {
                    0% {
                        opacity: 0;
                        transform: translateY(-50%) translateX(-30px);
                        filter: blur(4px);
                    }
                    45% {
                        opacity: 0;
                        transform: translateY(-50%) translateX(-30px);
                        filter: blur(4px);
                    }
                    55% {
                        opacity: 0.3;
                        transform: translateY(-50%) translateX(-15px);
                        filter: blur(0);
                    }
                    85% {
                        opacity: 1;
                        transform: translateY(-50%) translateX(0);
                        filter: blur(0);
                    }
                    100% {
                        opacity: 1;
                        transform: translateY(-50%) translateX(0);
                    }
                }
                @keyframes splashV6Pulse {
                    0% {
                        opacity: 0;
                        transform: scale(0.3);
                    }
                    30% {
                        opacity: 0.5;
                    }
                    70% {
                        opacity: 0;
                        transform: scale(1.6);
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
