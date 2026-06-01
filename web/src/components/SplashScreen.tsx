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
        const t1 = setTimeout(() => setFadeOut(true), 2000)
        const t2 = setTimeout(() => {
            setHidden(true)
            doneRef.current()
        }, 2500)
        return () => { clearTimeout(t1); clearTimeout(t2) }
    }, [])

    if (hidden) return null

    return (
        <div
            className={`fixed inset-0 z-[9999] bg-[#0D0D14] flex items-center justify-center transition-opacity duration-500 ${
                fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
        >
            <div className="relative w-56 h-56 sm:w-72 sm:h-72">
                {/* Sweeping line — draws an arc across the logo area */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 400 400" fill="none">
                    <path
                        d="M 20 300 C 60 140, 160 60, 320 120 C 380 140, 390 220, 370 300"
                        stroke="#7C3AED"
                        strokeWidth="2"
                        strokeLinecap="round"
                        style={{
                            strokeDasharray: 600,
                            strokeDashoffset: 600,
                            animation: 'drawArc 1.5s ease-in-out 0.1s forwards',
                            opacity: 0.5,
                        }}
                    />
                    <path
                        d="M 30 320 C 80 180, 200 100, 300 160 C 360 200, 370 280, 340 340"
                        stroke="#A78BFA"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        style={{
                            strokeDasharray: 500,
                            strokeDashoffset: 500,
                            animation: 'drawArc 1.8s ease-in-out 0.4s forwards',
                            opacity: 0.3,
                        }}
                    />
                </svg>

                {/* Logo — reveal with scale + fade */}
                <img
                    src="/logo.svg"
                    alt="Dribly"
                    className="w-full h-full object-contain"
                    style={{
                        animation: 'logoIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both',
                    }}
                />
            </div>

            <style>{`
                @keyframes drawArc {
                    to { stroke-dashoffset: 0; }
                }
                @keyframes logoIn {
                    from {
                        opacity: 0;
                        transform: scale(0.7);
                        filter: blur(8px);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1);
                        filter: blur(0);
                    }
                }
            `}</style>
        </div>
    )
}
