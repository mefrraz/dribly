import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { fetchStandingsFromSource } from '../lib/tugabasketApi'
import { Standing } from '../components/types'
import { logger } from '../lib/logger'

const CACHE_MINUTES = 15

function getTableName(season: string): string {
    return `classificacoes_${season.replace('/', '_')}`
}

export function useStandings(season: string, competitionId: number | null) {
    const [standings, setStandings] = useState<Standing[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const tableName = getTableName(season)

    useEffect(() => {
        if (!competitionId) {
            setStandings([])
            setLoading(false)
            setError(null)
            return
        }

        const cid = competitionId
        let cancelled = false

        async function load() {
            setLoading(true)
            setError(null)

            try {
                const { data: cached } = await supabase
                    .from(tableName)
                    .select('*')
                    .filter('competicao', 'not.is', null)
                    .order('competicao', { ascending: true })

                if (cancelled) return

                const relevant = (cached || []).filter((r: Standing) =>
                    r.competicao && typeof r.competicao === 'string'
                )

                if (relevant.length > 0) {
                    const updatedAt = new Date(relevant[0].updated_at || 0)
                    const staleThreshold = new Date(Date.now() - CACHE_MINUTES * 60000)

                    if (updatedAt > staleThreshold) {
                        setStandings(relevant as Standing[])
                        setLoading(false)
                        return
                    }
                }

                const fresh = await fetchStandingsFromSource([{ id: cid, displayName: '' }])
                if (cancelled) return

                const withTimestamp = fresh.map(s => ({
                    ...s,
                    updated_at: new Date().toISOString(),
                }))

                await supabase.from(tableName).upsert(withTimestamp, {
                    onConflict: 'competicao,grupo,equipa',
                })

                setStandings(withTimestamp)
            } catch (err) {
                if (!cancelled) {
                    logger.error('Failed to fetch standings:', err)
                    setError(err instanceof Error ? err.message : 'Erro ao carregar classificações')
                }
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        load()
        return () => { cancelled = true }
    }, [competitionId, season, tableName])

    return { standings, loading, error }
}
