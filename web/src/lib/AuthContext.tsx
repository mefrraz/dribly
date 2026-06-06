import { useEffect, useState, type ReactNode } from 'react'
import { useUser, useAuth as useClerkAuth, useClerk } from '@clerk/clerk-react'
import { setClerkTokenProvider } from './supabase'

// Re-export useAuth from the dedicated module so AuthContext.tsx only exports components,
// keeping Fast Refresh working. All existing imports from './AuthContext' still resolve.
// eslint-disable-next-line react-refresh/only-export-components
export { useAuth } from './useAuth'
export type { NormalizedUser, AuthContextType } from './useAuth'

/** Syncs Clerk session to Supabase token provider for RLS */
function TokenProviderSetup() {
    const { isLoaded, isSignedIn } = useUser()
    const { getToken } = useClerkAuth()
    const clerk = useClerk()
    const [oauthChecked, setOauthChecked] = useState(false)

    // Handle OAuth redirect
    useEffect(() => {
        if (isLoaded && !isSignedIn && !oauthChecked) {
            clerk
                .handleRedirectCallback({} as Record<string, never>)
                .then(() => {
                    setOauthChecked(true)
                })
                .catch(() => {
                    setOauthChecked(true)
                })
        }
    }, [isLoaded, isSignedIn, clerk, oauthChecked])

    // Sync Clerk session to Supabase token provider
    useEffect(() => {
        if (isLoaded) {
            if (isSignedIn) {
                setClerkTokenProvider(() => getToken({ template: 'supabase' }))
            } else {
                setClerkTokenProvider(null)
            }
        }
    }, [isLoaded, isSignedIn, getToken])

    return null
}

export function AuthProvider({ children }: { children: ReactNode }) {
    return (
        <>
            <TokenProviderSetup />
            {children}
        </>
    )
}
