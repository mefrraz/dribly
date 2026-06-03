import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { fetchFPBGames } from '../lib/fpbApi'
import { Match } from '../components/types'

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
    } catch { /* localStorage unavailable */ }
    return []
}

function saveLocalCache(season: string, clube: number, games: Match[]) {
    try {
        localStorage.setItem(LS_KEY(season, clube), JSON.stringify(games))
        localStorage.setItem(LS_TS(season, clube), Date.now().toString())
    } catch { /* localStorage full or unavailable */ }
}

function getTableName(season: string): string {
  return `games_${season.replace('/', '_')}`
}

function slugify(s: string): string {
  return s.toLowerCase().trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

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

export function useGames(season = '2025/2026', clube = 119, clubName = '') {
  const localCache = loadLocalCache(season, clube)
  const [games, setGames] = useState<Match[]>(localCache)
  const [loading, setLoading] = useState(localCache.length === 0)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  const tableName = getTableName(season)

  /** Public refresh — fetches FPB, updates state, persists to Supabase */
  const refresh = useCallback(async () => {
    try {
      setError(null)
      const fresh = await fetchFPBGames(season, clube)
      if (fresh.length === 0) return
      const mapped = mapFPBData(fresh, season)
      setGames(mapped)
      setLastUpdated(new Date())

      // Deduplicate by slug, then upsert to Supabase (fire-and-forget)
      const seen = new Map<string, boolean>()
      const unique = mapped.filter(g => {
        if (seen.has(g.slug)) return false
        seen.set(g.slug, true)
        return true
      })
      supabase.from(tableName).upsert(
        unique.map(g => ({ ...g, updated_at: new Date().toISOString() })),
        { onConflict: 'slug' }
      ).then(({ error: upsertError }) => {
        if (upsertError) console.warn('Supabase upsert failed:', upsertError.message)
      })
    } catch (err) {
      console.error('Failed to fetch games from FPB:', err)
      setError(err instanceof Error ? err.message : 'Erro ao carregar jogos')
    }
  }, [season, clube, tableName])

  // Persist to localStorage
  useEffect(() => {
    if (games.length > 0) saveLocalCache(season, clube, games)
  }, [games, season, clube])

  // Silent refresh when tab becomes visible
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (!lastUpdated || lastUpdated < new Date(Date.now() - CACHE_MINUTES * 60000)) {
        refresh()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refresh, lastUpdated])

  // Initial load — parallel FPB + Supabase, single setGames
  useEffect(() => {
    let cancelled = false

    const loadData = async () => {
      if (loadLocalCache(season, clube).length === 0) {
        setLoading(true)
      }
      setError(null)

      try {
        const [fpbData, { data: cached }] = await Promise.all([
          fetchFPBGames(season, clube).catch(() => [] as any[]),
          supabase.from(tableName)
            .select('*')
            .or(`equipa_casa.ilike.%${clubName}%,equipa_fora.ilike.%${clubName}%`)
            .order('data', { ascending: true })
        ])

        if (cancelled) return

        // Merge: FPB data wins, Supabase fills gaps
        const fpbMapped = mapFPBData(fpbData, season)
        const fpbSlugs = new Set(fpbMapped.map(g => g.slug))
        const merged = [...fpbMapped]
        if (cached) {
          for (const g of (cached as Match[])) {
            if (!fpbSlugs.has(g.slug)) merged.push(g)
          }
        }

        setGames(merged)
        setLastUpdated(new Date())
      } catch (err) {
        console.error('Failed to load games:', err)
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadData()
    return () => { cancelled = true }
  }, [season, clube, tableName, clubName])

  return { games, loading, lastUpdated, error, refresh }
}
