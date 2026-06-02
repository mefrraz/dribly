import { useState, useEffect, useCallback } from 'react'

interface Toast {
    id: number
    message: string
    type: 'success' | 'error'
}

let toastId = 0
let listeners: ((toast: Toast) => void)[] = []

export const toast = {
    success: (message: string) => {
        const t = { id: ++toastId, message, type: 'success' as const }
        listeners.forEach(fn => fn(t))
    },
    error: (message: string) => {
        const t = { id: ++toastId, message, type: 'error' as const }
        listeners.forEach(fn => fn(t))
    }
}

export function ToastContainer() {
    const [toasts, setToasts] = useState<Toast[]>([])

    useEffect(() => {
        listeners.push((t) => {
            setToasts(prev => [...prev, t])
            setTimeout(() => {
                setToasts(prev => prev.filter(x => x.id !== t.id))
            }, 3000)
        })
        return () => { listeners = [] }
    }, [])

    const removeToast = useCallback((id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }, [])

    return (
        <div className="fixed bottom-24 right-4 z-[60] flex flex-col gap-2 items-end max-w-[90vw]">
            {toasts.map(t => (
                <div
                    key={t.id}
                    onClick={() => removeToast(t.id)}
                    className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border text-sm font-bold cursor-pointer transform transition-all duration-300 animate-in slide-in-from-right-5 ${
                        t.type === 'success'
                            ? 'bg-white dark:bg-zinc-900 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
                            : 'bg-white dark:bg-zinc-900 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
                    }`}
                >
                    {t.type === 'success' ? (
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    ) : (
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                    )}
                    {t.message}
                </div>
            ))}
        </div>
    )
}