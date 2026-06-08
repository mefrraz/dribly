/**
 * Clerk Webhook — Vercel Edge Function
 * Endpoint: POST /api/clerk-webhook
 *
 * When a user is deleted in Clerk, this cleans up their data in Supabase.
 * Requires: CLERK_WEBHOOK_SECRET in Vercel env vars.
 */

import { createClient } from '@supabase/supabase-js'

export const config = { runtime: 'edge' }

export default async function handler(req: Request) {
    if (req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 })
    }

    // Verify Clerk webhook signature
    const whSecret = process.env.CLERK_WEBHOOK_SECRET
    if (!whSecret) {
        return new Response('Webhook not configured', { status: 500 })
    }

    const payload = await req.text()
    const headers = Object.fromEntries(req.headers.entries())

    // Verify via shared secret in header (x-webhook-secret)
    const authHeader = headers['x-webhook-secret'] || headers['authorization'] || ''
    if (!authHeader.includes(whSecret)) {
        return new Response('Unauthorized', { status: 401 })
    }

    // For now, accept and parse the payload directly
    let evt: Record<string, unknown>
    try {
        evt = JSON.parse(payload)
    } catch {
        return new Response('Invalid JSON', { status: 400 })
    }

    const eventType = evt.type as string
    if (eventType !== 'user.deleted') {
        return new Response(`Ignored event: ${eventType}`, { status: 200 })
    }

    const userId = (evt.data as Record<string, unknown>)?.id as string | undefined
    if (!userId) {
        return new Response('Missing user id', { status: 400 })
    }

    const supabaseUrl = process.env.SUPABASE_URL || ''
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

    if (!supabaseUrl || !supabaseKey) {
        return new Response('Supabase not configured', { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Delete all follows for this user
    const { error } = await supabase
        .from('user_follows')
        .delete()
        .eq('user_id', userId)

    if (error) {
        console.error('Failed to delete user follows:', error.message)
        return new Response('Cleanup failed: ' + error.message, { status: 500 })
    }

    return new Response(`Cleaned up follows for user ${userId}`, { status: 200 })
}
