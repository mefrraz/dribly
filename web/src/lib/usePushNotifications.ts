import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import { useAuth } from './AuthContext'
import { logger } from './logger'

export type NotificationPermissionState = 'prompt' | 'granted' | 'denied' | 'unsupported'

export interface PushSubscriptionInfo {
    id: number
    endpoint: string
    created_at: string
}

/**
 * Hook for managing Web Push notification subscriptions.
 *
 * - Checks browser support and permission state
 * - Subscribes/unsubscribes via PushManager
 * - Persists subscription to Supabase `push_subscriptions` table
 * - Loads existing subscriptions from Supabase on mount (when logged in)
 */
export function usePushNotifications() {
    const { user } = useAuth()
    const [permission, setPermission] = useState<NotificationPermissionState>(() => {
        if (typeof Notification === 'undefined') return 'unsupported'
        return Notification.permission as NotificationPermissionState
    })
    const [subscriptions, setSubscriptions] = useState<PushSubscriptionInfo[]>([])
    const [subscribing, setSubscribing] = useState(false)
    const [loaded, setLoaded] = useState(false)

    // ── Load existing subscriptions from Supabase ──
    const loadSubscriptions = useCallback(async () => {
        if (!user) {
            setSubscriptions([])
            setLoaded(true)
            return
        }
        try {
            const { data } = await supabase
                .from('push_subscriptions')
                .select('id, endpoint, created_at')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
            setSubscriptions((data as PushSubscriptionInfo[]) || [])
        } catch (err) {
            logger.warn('Failed to load push subscriptions:', err)
            setSubscriptions([])
        }
        setLoaded(true)
    }, [user])

    useEffect(() => {
        loadSubscriptions()
    }, [loadSubscriptions])

    // ── Listen for permission changes ──
    useEffect(() => {
        if (typeof navigator === 'undefined' || !('permissions' in navigator)) return
        const checkPermission = () => {
            if (typeof Notification === 'undefined') return
            setPermission(Notification.permission as NotificationPermissionState)
        }
        // Poll every 10s — simpler than the Permissions API which is inconsistent
        const interval = setInterval(checkPermission, 10000)
        return () => clearInterval(interval)
    }, [])

    // ── Subscribe to push notifications (works with or without account) ──
    const subscribe = useCallback(async (): Promise<boolean> => {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            logger.warn('Push notifications not supported')
            return false
        }

        setSubscribing(true)
        try {
            // 1. Request permission
            const result = await Notification.requestPermission()
            setPermission(result as NotificationPermissionState)
            if (result !== 'granted') {
                logger.warn('Notification permission denied')
                return false
            }

            // 2. Get SW registration
            const reg = await navigator.serviceWorker.ready
            if (!reg.pushManager) {
                logger.warn('PushManager not available')
                return false
            }

            // 3. Check existing subscription
            let pushSub = await reg.pushManager.getSubscription()
            if (pushSub) {
                // Already subscribed — check if already in Supabase
                const exists = subscriptions.find(s => s.endpoint === pushSub!.endpoint)
                if (exists) return true // Already in DB, nothing to do
            } else {
                // 4. Subscribe
                const vapidPublicKey = (
                    typeof __VAPID_PUBLIC_KEY__ !== 'undefined'
                        ? __VAPID_PUBLIC_KEY__
                        : ''
                )
                if (!vapidPublicKey) {
                    logger.error('VAPID public key not configured')
                    return false
                }
                pushSub = await reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlB64ToUint8Array(vapidPublicKey),
                })
            }

            // 5. Save to Supabase (user_id nullable — works for anonymous too)
            const subJson = pushSub.toJSON()
            const { error } = await supabase
                .from('push_subscriptions')
                .upsert(
                    {
                        user_id: user?.id || null,
                        endpoint: subJson.endpoint!,
                        p256dh: subJson.keys!.p256dh,
                        auth: subJson.keys!.auth,
                        updated_at: new Date().toISOString(),
                    },
                    { onConflict: 'endpoint' }
                )
            if (error) throw error

            await loadSubscriptions()
            return true
        } catch (err) {
            logger.error('Push subscribe failed:', err)
            return false
        } finally {
            setSubscribing(false)
        }
    }, [user, subscriptions, loadSubscriptions])

    // ── Unsubscribe from push notifications ──
    const unsubscribe = useCallback(async (subscriptionId?: number): Promise<boolean> => {
        try {
            // 1. Remove from PushManager
            if ('serviceWorker' in navigator) {
                const reg = await navigator.serviceWorker.ready
                const pushSub = await reg.pushManager.getSubscription()
                if (pushSub) await pushSub.unsubscribe()
            }

            // 2. Remove from Supabase
            if (subscriptionId) {
                await supabase.from('push_subscriptions').delete().eq('id', subscriptionId)
            } else if (user) {
                await supabase.from('push_subscriptions').delete().eq('user_id', user.id)
            }

            await loadSubscriptions()
            return true
        } catch (err) {
            logger.error('Push unsubscribe failed:', err)
            return false
        }
    }, [user, loadSubscriptions])

    return {
        permission,
        subscriptions,
        subscribing,
        loaded,
        subscribe,
        unsubscribe,
        refresh: loadSubscriptions,
    }
}

// ── Utility: base64url → Uint8Array (for applicationServerKey) ──
function urlB64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; i++) {
        outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray as Uint8Array<ArrayBuffer>
}
