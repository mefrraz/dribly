import { useMemo, useCallback } from 'react'
import { useUser, useClerk } from '@clerk/clerk-react'

export interface NormalizedUser {
    id: string
    email: string
    username: string | null
    firstName: string | null
    lastName: string | null
    imageUrl: string | null
    bio: string | null
}

export interface AuthContextType {
    user: NormalizedUser | null
    loading: boolean
    signOut: () => Promise<void>
}

function normalizeUser(clerkUser: NonNullable<ReturnType<typeof useUser>['user']>): NormalizedUser {
    return {
        id: clerkUser.id,
        email: clerkUser.primaryEmailAddress?.emailAddress || '',
        username: clerkUser.username || null,
        firstName: clerkUser.firstName || null,
        lastName: clerkUser.lastName || null,
        imageUrl: clerkUser.imageUrl || null,
        bio: (clerkUser.unsafeMetadata?.bio as string) || null,
    }
}

export function useAuth(): AuthContextType {
    const { isLoaded, isSignedIn, user: clerkUser } = useUser()
    const clerk = useClerk()

    const normalizedUser = useMemo(() => {
        if (!isSignedIn || !clerkUser) return null
        return normalizeUser(clerkUser)
    }, [isSignedIn, clerkUser])

    return {
        user: normalizedUser,
        loading: !isLoaded,
        signOut: useCallback(() => clerk.signOut(), [clerk]),
    }
}
