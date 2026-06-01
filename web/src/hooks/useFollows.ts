import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

export interface Follow {
    id: number
    user_id: string
    entity_type: 'club' | 'competition'
    entity_id: number
}

export function useFollows() {
    const { user } = useAuth()
    const [follows, setFollows] = useState<Follow[]>([])
    const [loading, setLoading] = useState(false)

    const loadFollows = useCallback(async () => {
        if (!user) {
            setFollows([])
            return
        }
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('user_follows')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
            if (error) throw error
            setFollows((data as Follow[]) || [])
        } catch {
            // Table may not exist yet — fail silently
            setFollows([])
        }
        setLoading(false)
    }, [user])

    useEffect(() => {
        loadFollows()
    }, [loadFollows])

    const isFollowing = useCallback(
        (entityType: 'club' | 'competition', entityId: number): boolean => {
            return follows.some(f => f.entity_type === entityType && f.entity_id === entityId)
        },
        [follows]
    )

    const toggleFollow = useCallback(async (entityType: 'club' | 'competition', entityId: number) => {
        if (!user) return false
        const following = follows.find(f => f.entity_type === entityType && f.entity_id === entityId)
        if (following) {
            // Unfollow
            const { error } = await supabase
                .from('user_follows')
                .delete()
                .eq('id', following.id)
                .eq('user_id', user.id)
            if (!error) {
                setFollows(prev => prev.filter(f => f.id !== following.id))
                return true
            }
        } else {
            // Follow
            const { data, error } = await supabase
                .from('user_follows')
                .upsert({ user_id: user.id, entity_type: entityType, entity_id: entityId }, { onConflict: 'user_id, entity_type, entity_id' })
                .select()
                .single()
            if (!error && data) {
                setFollows(prev => [...prev, data as Follow])
                return true
            }
        }
        return false
    }, [user, follows])

    const followedClubIds = follows.filter(f => f.entity_type === 'club').map(f => f.entity_id)
    const followedCompIds = follows.filter(f => f.entity_type === 'competition').map(f => f.entity_id)

    return { follows, loading, isFollowing, toggleFollow, followedClubIds, followedCompIds, refresh: loadFollows }
}
