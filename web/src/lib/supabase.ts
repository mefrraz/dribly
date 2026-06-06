import { createClient } from '@supabase/supabase-js'
import { logger } from './logger'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    logger.error("Missing Supabase Variables")
}

// Clerk token provider — set by AuthContext when Clerk is ready
let _getClerkToken: (() => Promise<string | null>) | null = null

export function setClerkTokenProvider(fn: (() => Promise<string | null>) | null) {
    _getClerkToken = fn
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
    accessToken: async () => {
        if (_getClerkToken) {
            try {
                const token = await _getClerkToken()
                if (token) return token
            } catch {
                // Clerk not ready or template missing — fall back to anon
            }
        }
        return null // uses anon key, RLS with auth.uid() returns null
    },
})
