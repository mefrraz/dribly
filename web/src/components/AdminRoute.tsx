import { useUser } from '@clerk/clerk-react'
import { Navigate, Outlet } from 'react-router-dom'
import { LoadingSpinner } from './LoadingSpinner'

/**
 * Route guard — only renders children if the user has
 * publicMetadata.role === 'admin' in Clerk.
 */
export function AdminRoute() {
    const { isLoaded, isSignedIn, user } = useUser()

    if (!isLoaded) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <LoadingSpinner />
            </div>
        )
    }

    if (!isSignedIn) return <Navigate to="/" replace />

    const role = user?.publicMetadata?.role as string | undefined
    if (role !== 'admin') return <Navigate to="/" replace />

    return <Outlet />
}
