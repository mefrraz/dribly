import { useState, useEffect } from 'react'

const SPLASH_SHOWN_KEY = 'dribly_splash_shown'

interface SplashScreenProps {
    onDone: () => void
}

export default function SplashScreen({ onDone }: SplashScreenProps) {
    const [fadeOut, setFadeOut] = useState(false)

    useEffect(() => {
        // Skip if already shown this session
        if (sessionStorage.getItem(SPLASH_SHOWN_KEY)) {
            onDone()
            return
        }

        // Start fade-out after 2.5s
        const t1 = setTimeout(() => setFadeOut(true), 2500)
        // Remove after fade completes (500ms)
        const t2 = setTimeout(() => {
            sessionStorage.setItem(SPLASH_SHOWN_KEY, '1')
            onDone()
        }, 3000)

        return () => { clearTimeout(t1); clearTimeout(t2) }
    }, [onDone])

    return (
        <div
            className={`fixed inset-0 z-[9999] bg-zinc-50 dark:bg-[#0D0D14] flex items-center justify-center transition-opacity duration-500 ${
                fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
        >
            <svg
                viewBox="0 0 400 400"
                className="w-64 h-64 sm:w-80 sm:h-80"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                {/* --- Curved trajectory lines (2D bezier animations) --- */}

                {/* Line 1: top-left arc — drawn with stroke-dasharray */}
                <path
                    d="M 60 120 C 100 30, 160 40, 200 80 C 240 120, 230 170, 200 200"
                    stroke="#7C3AED"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    fill="none"
                    className="splash-line"
                    style={{
                        strokeDasharray: 300,
                        strokeDashoffset: 300,
                        animation: 'drawLine 1.5s ease-in-out 0.1s forwards',
                        opacity: 0.6,
                    }}
                />

                {/* Line 2: sweeping right-side curve */}
                <path
                    d="M 340 100 C 300 30, 230 70, 220 130 C 210 190, 270 180, 300 140"
                    stroke="#8B5CF6"
                    strokeWidth="2"
                    strokeLinecap="round"
                    fill="none"
                    className="splash-line"
                    style={{
                        strokeDasharray: 280,
                        strokeDashoffset: 280,
                        animation: 'drawLine 1.4s ease-in-out 0.3s forwards',
                        opacity: 0.45,
                    }}
                />

                {/* Line 3: bottom sweeping curve */}
                <path
                    d="M 80 280 C 100 230, 180 250, 220 270 C 260 290, 310 260, 350 300"
                    stroke="#A78BFA"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    fill="none"
                    className="splash-line"
                    style={{
                        strokeDasharray: 350,
                        strokeDashoffset: 350,
                        animation: 'drawLine 1.6s ease-in-out 0.5s forwards',
                        opacity: 0.35,
                    }}
                />

                {/* Line 4: basketball bounce trajectory */}
                <path
                    d="M 50 300 C 80 200, 130 350, 180 250 C 230 150, 280 380, 320 280 C 350 200, 370 240, 380 220"
                    stroke="#7C3AED"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    fill="none"
                    className="splash-line"
                    style={{
                        strokeDasharray: 500,
                        strokeDashoffset: 500,
                        animation: 'drawLine 2s ease-in-out 0.7s forwards',
                        opacity: 0.25,
                    }}
                />

                {/* --- Logo: Dribly "D" — scale-in animation --- */}
                <g
                    className="splash-logo"
                    style={{
                        animation: 'scaleIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both',
                    }}
                >
                    {/* Real Dribly logo — revealed with expanding circle */}
                <foreignObject x="100" y="100" width="200" height="200">
                    <img
                        src="/logo.svg"
                        alt="Dribly"
                        className="w-full h-full object-contain"
                        style={{
                            clipPath: 'circle(50% at 50% 50%)',
                            animation: 'revealLogo 1s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s both',
                        }}
                    />
                </foreignObject>
                </g>
            </svg>

            {/* Keyframes injected once */}
            <style>{`
                @keyframes drawLine {
                    to { stroke-dashoffset: 0; }
                }
                @keyframes revealLogo {
                    from {
                        clip-path: circle(0% at 50% 50%);
                        opacity: 0;
                    }
                    to {
                        clip-path: circle(50% at 50% 50%);
                        opacity: 1;
                    }
                }
            `}</style>
        </div>
    )
}
