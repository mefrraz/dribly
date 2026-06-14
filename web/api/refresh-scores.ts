/**
 * Refresh game scores from FPB → Supabase
 *
 * POST /api/refresh-scores
 * Body: { gameIds?: string[], date?: string }
 *
 * Uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS.
 * Rate-limited: max 10 games per call.
 */

import { createClient } from '@supabase/supabase-js'

export const config = { runtime: 'nodejs' }

export default async function handler(req: Request): Promise<Response> {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
    }

    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const supabaseUrl = process.env.SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    if (!supabaseUrl || !supabaseKey) {
        return new Response(JSON.stringify({ error: 'Missing Supabase env vars' }), { status: 500 })
    }
    const supabase = createClient(supabaseUrl, supabaseKey)

    try {
        const body = await req.json().catch(() => ({}))
        const { gameIds, date } = body as { gameIds?: string[]; date?: string }

        let ids: string[] = []

        if (gameIds && gameIds.length > 0) {
            ids = gameIds.slice(0, 10)
        } else if (date) {
            // Auto-discover games without scores for this date
            const { data } = await supabase
                .from('games_2025_2026')
                .select('id')
                .eq('data', date)
                .is('resultado_casa', null)
                .limit(10)
            ids = (data || []).map((g: { id: string }) => String(g.id))
        } else {
            // Default: today
            const today = new Date().toISOString().split('T')[0]
            const { data } = await supabase
                .from('games_2025_2026')
                .select('id')
                .eq('data', today)
                .is('resultado_casa', null)
                .limit(10)
            ids = (data || []).map((g: { id: string }) => String(g.id))
        }

        if (ids.length === 0) {
            return Response.json({ message: 'No games to refresh', refreshed: 0 })
        }

        // Fetch each game from FPB via our proxy
        let refreshed = 0
        for (const id of ids) {
            try {
                const fpbRes = await fetch(`https://www.fpb.pt/ficha-de-jogo/?internalID=${id}`, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Dribly/1.0)' },
                })
                if (!fpbRes.ok) continue
                const html = await fpbRes.text()

                // Parse scores from FPB page
                const scoreMatch = html.match(/<span class="resultado[^"]*">\s*(\d+)\s*-\s*(\d+)\s*<\/span>/i)
                if (!scoreMatch) continue

                const resultado_casa = parseInt(scoreMatch[1])
                const resultado_fora = parseInt(scoreMatch[2])

                await supabase
                    .from('games_2025_2026')
                    .update({
                        resultado_casa,
                        resultado_fora,
                        status: 'FINALIZADO',
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', id)

                refreshed++
            } catch {
                // skip failed
            }
        }

        return Response.json({ message: `Refreshed ${refreshed}/${ids.length} games`, refreshed })
    } catch (err) {
        return new Response(JSON.stringify({ error: 'Internal error', details: String(err) }), { status: 500 })
    }
}
