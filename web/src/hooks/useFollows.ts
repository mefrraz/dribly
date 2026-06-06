import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { toast } from '../components/Toast'
import { logger } from '../lib/logger'

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
    const [error, setError] = useState<string | null>(null)

    const loadFollows = useCallback(async () => {
        if (!user) {
            setFollows([])
            setError(null)
            return
        }
        setLoading(true)
        setError(null)
        try {
            const { data, error: dbError } = await supabase
                .from('user_follows')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
            if (dbError) throw dbError
            setFollows((data as Follow[]) || [])
        } catch (err) {
            // Table may not exist yet or network error
            logger.warn('Failed to load follows:', err)
            setError(err instanceof Error ? err.message : 'Erro ao carregar seguidos')
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
        
        const currentlyFollowing = follows.find(f => f.entity_type === entityType && f.entity_id === entityId)
        const previousFollows = [...follows]

        // 1. Optimistic Update: update UI immediately
        if (currentlyFollowing) {
            setFollows(prev => prev.filter(f => f.id !== currentlyFollowing.id))
        } else {
            // Add a temporary follow entry with a negative ID
            const tempId = -Date.now()
            setFollows(prev => [...prev, { id: tempId, user_id: user.id, entity_type: entityType, entity_id: entityId }])
        }

        try {
            // 2. Network Request
            if (currentlyFollowing) {
                const { error } = await supabase
                    .from('user_follows')
                    .delete()
                    .eq('id', currentlyFollowing.id)
                    .eq('user_id', user.id)
                if (error) throw error
            } else {
                const { data, error } = await supabase
                    .from('user_follows')
                    .upsert({ user_id: user.id, entity_type: entityType, entity_id: entityId }, { onConflict: 'user_id, entity_type, entity_id' })
                    .select()
                    .single()
                if (error) throw error
                
                // 3. Replace temp entry with real entry from DB
                if (data) {
                    setFollows(prev => {
                        const withoutTemp = prev.filter(f => f.id < 0)
                        return [...withoutTemp, data as Follow]
                    })
                    toast.success(currentlyFollowing ? 'Clube removido dos seguidos' : 'Clube adicionado aos seguidos')
                }
            }
            return true
        } catch (err) {
            // 4. Rollback on failure
            setFollows(previousFollows)
            logger.error('Follow toggle failed:', err)
            toast.error('Ocorreu um erro. A reverter...')
            return false
        }
    }, [user, follows])

    const followedClubIds = follows.filter(f => f.entity_type === 'club').map(f => f.entity_id)
    const followedCompIds = follows.filter(f => f.entity_type === 'competition').map(f => f.entity_id)

    return { follows, loading, error, isFollowing, toggleFollow, followedClubIds, followedCompIds, refresh: loadFollows }
}
