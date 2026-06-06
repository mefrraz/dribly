import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { fetchFPBGames } from '../lib/fpbApi'
import { Match } from '../components/types'
import { logger } from '../lib/logger'

const CACHE_MINUTES = 15

const LS_KEY = (season: string, clube: number) => `games_cache_${season}_${clube}`
const LS_TS = (season: string, clube: number) => `games_cache_ts_${season}_${clube}`

function loadLocalCache(season: string, clube: number): Match[] {
    try {
        const stored = localStorage.getItem(LS_KEY(season, clube))
        const storedTs = localStorage.getItem(LS_TS(season, clube))
        if (stored && storedTs) {
            const parsed = JSON.parse(stored) as Match[]
            const age = Date.now() - parseInt(storedTs)
            if (parsed.length > 0 && age < CACHE_MINUTES * 60000) {
                return parsed
            }
        }
    } catch { /* ignore */ }
    return []
}

function saveLocalCache(season: string, clube: number, games: Match[]) {
    try {
        localStorage.setItem(LS_KEY(season, clube), JSON.stringify(games))
        localStorage.setItem(LS_TS(season, clube), Date.now().toString())
    } catch { /* ignore */ }
}

function getTableName(season: string): string {
  return `games_${season.replace('/', '_')}`
}

import { slugify } from '../lib/fpbUtils'

function mapFPBData(fresh: any[], season: string): Match[] {
  return fresh.map(g => {
    const slug = `${g.data}-${slugify(g.equipa_casa)}-${slugify(g.equipa_fora)}`
    return {
      ...g,
      id: g.id || '',
      data: g.data,
      hora: g.hora || '',
      equipa_casa: g.equipa_casa || '',
      equipa_fora: g.equipa_fora || '',
      resultado_casa: g.resultado_casa,
      resultado_fora: g.resultado_fora,
      escalao: g.escalao || '',
      competicao: g.competicao || '',
      local: g.local || null,
      logotipo_casa: g.logotipo_casa || null,
      logotipo_fora: g.logotipo_fora || null,
      status: g.status,
      epoca: season,
      slug,
    }
  })
}

export function useGames(season = '2025/2026', clube = 119, _clubName = '') {
  const localCache = loadLocalCache(season, clube)
  const [games, setGames] = useState<Match[]>(localCache)
  const [loading, setLoading] = useState(localCache.length === 0)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  const tableName = getTableName(season)

  /** Background upsert to Supabase — never affects UI */
  const persistToSupabase = useCallback((data: Match[]) => {
    const seen = new Map<string, boolean>()
    const unique = data.filter(g => {
      if (seen.has(g.slug)) return false
      seen.set(g.slug, true)
      return true
    })
    supabase.from(tableName).upsert(
      unique.map(g => ({ ...g, updated_at: new Date().toISOString() })),
      { onConflict: 'slug' }
    ).then(({ error: upsertError }) => {
      if (upsertError) logger.warn('Supabase upsert:', upsertError.message)
    })
  }, [tableName])

  /** Fetch FPB, update state once, persist to Supabase */
  const fetchAndSet = useCallback(async () => {
    const fresh = await fetchFPBGames(season, clube)
    if (fresh.length === 0) return
    const mapped = mapFPBData(fresh, season)

    // Only update if data actually changed
    const currentKey = games.map(g => `${g.slug}|${g.resultado_casa}|${g.resultado_fora}`).sort().join(',')
    const freshKey = mapped.map(g => `${g.slug}|${g.resultado_casa}|${g.resultado_fora}`).sort().join(',')
    if (currentKey === freshKey) return

    setGames(mapped)
    setLastUpdated(new Date())
    persistToSupabase(mapped)
  }, [season, clube, games, persistToSupabase])

  /** Manual refresh — visible loading */
  const refresh = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const fresh = await fetchFPBGames(season, clube)
      if (fresh.length === 0) {
        setLoading(false)
        return
      }
      const mapped = mapFPBData(fresh, season)
      setGames(mapped)
      setLastUpdated(new Date())
      persistToSupabase(mapped)
    } catch (err) {
      logger.error('FPB refresh failed:', err)
      setError(err instanceof Error ? err.message : 'Erro ao carregar jogos')
    } finally {
      setLoading(false)
    }
  }, [season, clube, persistToSupabase])

  // Persist to localStorage
  useEffect(() => {
    if (games.length > 0) saveLocalCache(season, clube, games)
  }, [games, season, clube])

  // Silent refresh on tab focus
  useEffect(() => {
    if (!lastUpdated) return
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (lastUpdated < new Date(Date.now() - CACHE_MINUTES * 60000)) {
        fetchAndSet()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [lastUpdated, fetchAndSet])

  // Initial load: localStorage → FPB (single render, no Supabase in display path)
  useEffect(() => {
    let cancelled = false

    const loadData = async () => {
      if (localCache.length === 0) {
        setLoading(true)
      }
      setError(null)

      try {
        await fetchAndSet()
      } catch (err) {
        logger.error('Failed to load games:', err)
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadData()
    return () => { cancelled = true }
  }, []) // only on mount

  return { games, loading, lastUpdated, error, refresh }
}
