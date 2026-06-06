/** Toast state — global pub/sub so any module can trigger toasts without React context. */

export interface ToastItem {
    id: number
    message: string
    type: 'success' | 'error'
}

let toastId = 0
let listeners: ((toast: ToastItem) => void)[] = []

export const toast = {
    success: (message: string) => {
        const t: ToastItem = { id: ++toastId, message, type: 'success' }
        listeners.forEach(fn => fn(t))
    },
    error: (message: string) => {
        const t: ToastItem = { id: ++toastId, message, type: 'error' }
        listeners.forEach(fn => fn(t))
    },
}

/** Subscribe to toast events. Returns an unsubscribe function. */
export function subscribeToasts(fn: (toast: ToastItem) => void): () => void {
    listeners.push(fn)
    return () => { listeners = listeners.filter(l => l !== fn) }
}
