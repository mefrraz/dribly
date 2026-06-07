import { useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

// Reuse the existing FPB parser
import { fetchFPBGames } from '../lib/fpbApi'
import type { Match } from '../components/types'
import type { AdminClub } from '../lib/adminApi'

const SEASON = '2025/2026'
const CONCURRENCY = 4 // parallel club fetches

export interface ScrapeProgress {
    current: number
    total: number
    clubName: string
    newGames: number
}

export function useScraper(clubs: AdminClub[]) {
    const [selected, setSelected] = useState<Set<number>>(new Set())
    const [progress, setProgress] = useState<ScrapeProgress | null>(null)
    const [running, setRunning] = useState(false)
    const [results, setResults] = useState<{ club: string; games: number; errors: string[] }[]>([])
    const abortRef = useRef(false)

    const toggleClub = useCallback((id: number) => {
        setSelected(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }, [])

    const selectAll = useCallback(() => {
        setSelected(new Set(clubs.map(c => c.id)))
    }, [clubs])

    const deselectAll = useCallback(() => {
        setSelected(new Set())
    }, [])

    const startScrape = useCallback(async () => {
        const targets = clubs.filter(c => selected.has(c.id))
        if (targets.length === 0) return

        setRunning(true)
        abortRef.current = false
        setResults([])

        const allResults: { club: string; games: number; errors: string[] }[] = []
        let done = 0

        // Process clubs in batches of CONCURRENCY
        for (let i = 0; i < targets.length; i += CONCURRENCY) {
            if (abortRef.current) break
            const batch = targets.slice(i, i + CONCURRENCY)

            const batchResults = await Promise.all(
                batch.map(async (club) => {
                    const errors: string[] = []
                    let gameCount = 0

                    try {
                        // Use the existing FPB parser
                        const games: Match[] = await fetchFPBGames(SEASON, club.id)
                        gameCount = games.length

                        // Upsert each game to Supabase
                        for (const game of games) {
                            if (abortRef.current) break
                            try {
                                await supabase
                                    .from('games_2025_2026')
                                    .upsert(
                                        {
                                            slug: game.slug || game.id,
                                            data: game.data,
                                            hora: game.hora || null,
                                            equipa_casa: game.equipa_casa,
                                            equipa_fora: game.equipa_fora,
                                            resultado_casa: game.resultado_casa,
                                            resultado_fora: game.resultado_fora,
                                            escalao: game.escalao || null,
                                            competicao: game.competicao || null,
                                            local: game.local || null,
                                            status: game.status || 'AGENDADO',
                                            logotipo_casa: game.logotipo_casa || null,
                                            logotipo_fora: game.logotipo_fora || null,
                                            epoca: SEASON,
                                        },
                                        { onConflict: 'slug' },
                                    )
                            } catch (e) {
                                errors.push(`Erro ao guardar jogo: ${(e as Error).message}`)
                            }
                        }
                    } catch (e) {
                        errors.push(`Erro ao obter jogos: ${(e as Error).message}`)
                    }

                    done++
                    setProgress({
                        current: done,
                        total: targets.length,
                        clubName: club.name,
                        newGames: gameCount,
                    })

                    return { club: club.name, games: gameCount, errors }
                }),
            )

            allResults.push(...batchResults)
        }

        setResults(allResults)
        setProgress(null)
        setRunning(false)
    }, [clubs, selected])

    const abort = useCallback(() => {
        abortRef.current = true
        setRunning(false)
        setProgress(null)
    }, [])

    return {
        selected,
        progress,
        running,
        results,
        toggleClub,
        selectAll,
        deselectAll,
        startScrape,
        abort,
    }
}
