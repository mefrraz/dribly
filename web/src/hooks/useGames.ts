import { useState, useEffect, useCallback } from 'react'
import { fetchFPBGames } from '../lib/fpbApi'
import { Match } from '../components/types'
import { logger } from '../lib/logger'
import { slugify } from '../lib/fpbUtils'

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

export function useGames(season = '2025/2026', clube = 119, _clubName = '') {
  const localCache = loadLocalCache(season, clube)
  const [games, setGames] = useState<Match[]>(localCache)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchAndSet = useCallback(async () => {
    try {
      const fresh = await fetchFPBGames(season, clube)
      const mapped = mapFPBData(fresh, season)
      const currentKey = games.map(g => `${g.slug}|${g.resultado_casa}|${g.resultado_fora}`).sort().join(',')
      const freshKey = mapped.map(g => `${g.slug}|${g.resultado_casa}|${g.resultado_fora}`).sort().join(',')
      if (currentKey === freshKey) return
      setGames(mapped)
      setLastUpdated(new Date())
    } catch (err) {
      logger.error('FPB fetch failed:', err)
    }
  }, [season, clube, games])

  const refresh = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const fresh = await fetchFPBGames(season, clube)
      const mapped = mapFPBData(fresh, season)
      setGames(mapped)
      setLastUpdated(new Date())
    } catch (err) {
      logger.error('FPB refresh failed:', err)
      setError(err instanceof Error ? err.message : 'Erro ao carregar jogos')
    } finally {
      setLoading(false)
    }
  }, [season, clube])

  // Load games when season or club changes
  useEffect(() => {
    let cancelled = false
    const cache = loadLocalCache(season, clube)
    setGames(cache)
    setError(null)
    setLoading(true)

    const loadData = async () => {
      try {
        const fresh = await fetchFPBGames(season, clube)
        if (cancelled) return
        const mapped = mapFPBData(fresh, season)
        setGames(mapped)
        setLastUpdated(new Date())
      } catch (err) {
        logger.error('Failed to load games:', err)
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadData()
    return () => { cancelled = true }
  }, [season, clube])

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

  return { games, loading, lastUpdated, error, refresh }
}
