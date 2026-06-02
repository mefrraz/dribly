import { useState, useEffect, useCallback, useRef } from 'react'
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

export function useGames(season = '2025/2026', clube = 119, clubName = '') {
  const localCache = loadLocalCache(season, clube)
  const [games, setGames] = useState<Match[]>(localCache)
  const [loading, setLoading] = useState(localCache.length === 0)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const gamesRef = useRef<Match[]>([])
  const clubNameRef = useRef(clubName)
  clubNameRef.current = clubName

  const tableName = getTableName(season)

  /** Filter games to only those involving the target club */
  const filterByClub = useCallback((games: Match[]): Match[] => {
    if (!clubName) return games
    const upper = clubName.toUpperCase()
    // Use a substring match — team names from FPB can vary slightly
    // Check if either team contains the club name (or vice versa if FPB uses abbreviation)
    return games.filter(g =>
      g.equipa_casa.toUpperCase().includes(upper) ||
      g.equipa_fora.toUpperCase().includes(upper)
    )
  }, [clubName])

  // Persist games to localStorage whenever they change
  useEffect(() => {
    if (games.length > 0) {
      saveLocalCache(season, clube, games)
    }
  }, [games, season, clube])

  const refresh = useCallback(async () => {
    try {
      const freshData = await fetchFPBGames(season, clube)
      const withEpoch = freshData.map(g => {
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
          slug
        }
      })

      // Compare with current data to avoid unnecessary updates
      const current = gamesRef.current
      if (current.length > 0 && withEpoch.length > 0) {
        const currentKey = current.map(g => `${g.id}|${g.resultado_casa}|${g.resultado_fora}`).sort().join(',')
        const freshKey = withEpoch.map(g => `${g.id}|${g.resultado_casa}|${g.resultado_fora}`).sort().join(',')
        if (currentKey === freshKey) {
          return // nothing changed, skip update
        }
      }

      // Show games immediately from FPB data (don't wait for DB upsert)
      setGames(withEpoch)
      setLastUpdated(new Date())

      // Deduplicate by slug before upserting (avoids "ON CONFLICT DO UPDATE
      // cannot affect row a second time" when FPB returns duplicate game entries)
      const seen = new Map<string, boolean>()
      const unique = withEpoch.filter(g => {
        if (seen.has(g.slug)) return false
        seen.set(g.slug, true)
        return true
      })

      // Try to persist to Supabase (fire-and-forget — don't block UI)
      supabase.from(tableName).upsert(
        unique.map(g => ({ ...g, updated_at: new Date().toISOString() })),
        { onConflict: 'slug' }
      ).then(({ error }) => {
        if (error) console.warn('Failed to upsert games to Supabase:', error.message)
      })
    } catch (err) {
      console.error('Failed to fetch games from FPB:', err)
      setError(err instanceof Error ? err.message : 'Erro ao carregar jogos')
      throw err
    }
  }, [season, clube, tableName])

  // Keep ref in sync
  gamesRef.current = games

  const lastUpdatedRef = useRef<Date | null>(null)
  lastUpdatedRef.current = lastUpdated

  // Silent refresh when user returns to the page
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const last = lastUpdatedRef.current
        const staleThreshold = new Date(Date.now() - CACHE_MINUTES * 60000)
        if (!last || last < staleThreshold) {
          refresh()
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [refresh])

  useEffect(() => {
    let cancelled = false

    const loadData = async () => {
      if (loadLocalCache(season, clube).length === 0) {
        setLoading(true)
      }
      setError(null)

      try {
        // Query Supabase for cached games
        let query = supabase.from(tableName).select('*')
        if (clubName) {
          query = query.or(
            `equipa_casa.ilike.%${clubName}%,equipa_fora.ilike.%${clubName}%`
          )
        }
        const supabasePromise = query.order('data', { ascending: true })

        // Fetch FPB in parallel — always
        const fpbPromise = refresh().catch(() => {})

        // Wait for both
        const [{ data: cached }] = await Promise.all([supabasePromise, fpbPromise])

        if (cancelled) return

        if (cached && cached.length > 0) {
          const filtered = filterByClub(cached as Match[])
          const updatedAt = new Date(cached[0].updated_at || cached[0].created_at || 0)
          const staleThreshold = new Date(Date.now() - CACHE_MINUTES * 60000)
          const isStale = updatedAt < staleThreshold

          if (!isStale && filtered.length > 0) {
            // Fresh cache — show it (FPB data already set via refresh)
            setLastUpdated(updatedAt)
          }
          // If stale, FPB already refreshed via parallel call
        }
        // If no cache, FPB already fetched via parallel call
      } catch (err) {
        console.error('Failed to load games:', err)
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadData()

    return () => {
      cancelled = true
    }
  }, [season, clube, tableName, refresh, filterByClub, clubName])

  return {
    games,
    loading,
    lastUpdated,
    error,
    refresh
  }
}