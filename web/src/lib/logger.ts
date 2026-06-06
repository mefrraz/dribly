/**
 * Logger that only outputs in development.
 * Replace console.log/warn/error with these.
 */
const isDev = import.meta.env.DEV

export const logger = {
    log: (...args: unknown[]) => { if (isDev) console.log(...args) },
    warn: (...args: unknown[]) => { if (isDev) console.warn(...args) },
    error: (...args: unknown[]) => { if (isDev) console.error(...args) },
}
