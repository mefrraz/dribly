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

function mapFPBData(fresh: Record<string, unknown>[], season: string): Match[] {
  return fresh.map(g => {
    const data = String(g.data || '')
    const casa = String(g.equipa_casa || '')
    const fora = String(g.equipa_fora || '')
    const slug = `${data}-${slugify(casa)}-${slugify(fora)}`
    return {
      id: String(g.id || ''),
      slug,
      data,
      hora: String(g.hora || ''),
      equipa_casa: casa,
      equipa_fora: fora,
      resultado_casa: (g.resultado_casa ?? null) as number | null,
      resultado_fora: (g.resultado_fora ?? null) as number | null,
      escalao: String(g.escalao || ''),
      competicao: String(g.competicao || ''),
      local: (g.local as string) || null,
      logotipo_casa: (g.logotipo_casa as string) || null,
      logotipo_fora: (g.logotipo_fora as string) || null,
      status: g.status as Match['status'],
      epoca: season,
    }
  })
}

/**
 * Dedup games by game identity (same date + home + competition).
 * When duplicates exist, prefer the version with a proper FPB id
 * (which comes from the resultados page and has both teams correct)
 * over self-match entries from the calendario page (id='').
 */
function dedupGames(games: Match[]): Match[] {
  const groups = new Map<string, Match[]>()
  for (const g of games) {
    const key = `${g.data.slice(0, 10)}|${g.equipa_casa}|${g.competicao}`
    const arr = groups.get(key) || []
    arr.push(g)
    groups.set(key, arr)
  }

  const result: Match[] = []
  for (const [, group] of groups) {
    if (group.length === 1) {
      result.push(group[0])
    } else {
      // Prefer: has proper id > has diferentes teams > keep first
      const withId = group.filter(g => g.id && g.id !== '')
      const withDiffTeams = group.filter(g => g.equipa_casa !== g.equipa_fora)
      const chosen = withId.length > 0
        ? withId[0]
        : withDiffTeams.length > 0
          ? withDiffTeams[0]
          : group[0]
      result.push(chosen)
    }
  }
  return result
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
    const deduped = dedupGames(data)
    supabase.from(tableName).upsert(
      deduped.map(g => ({ ...g, updated_at: new Date().toISOString() })),
      { onConflict: 'slug' }
    ).then(({ error: upsertError }) => {
      if (upsertError) logger.warn('Supabase upsert:', upsertError.message)
    })
  }, [tableName])

  /** Fetch FPB, update state once, persist to Supabase */
  const fetchAndSet = useCallback(async () => {
    const fresh = await fetchFPBGames(season, clube)
    if (fresh.length === 0) return
    const mapped = dedupGames(mapFPBData(fresh, season))

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
      const mapped = dedupGames(mapFPBData(fresh, season))
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // only on mount

  return { games, loading, lastUpdated, error, refresh }
}
