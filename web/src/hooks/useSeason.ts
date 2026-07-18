import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'dribly_season'

const ALL_SEASONS = [
    '2026/2027', '2025/2026', '2024/2025', '2023/2024', '2022/2023',
    '2021/2022', '2020/2021', '2019/2020', '2018/2019', '2017/2018',
    '2016/2017', '2015/2016', '2014/2015', '2013/2014',
]

function getInitialSeason(): string {
    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored && ALL_SEASONS.includes(stored)) return stored
    } catch { /* localStorage not available */ }
    return ALL_SEASONS[0]
}

export function useSeason(initialSeason?: string) {
    const [season, setSeasonState] = useState<string>(() => {
        if (initialSeason && ALL_SEASONS.includes(initialSeason)) return initialSeason
        return getInitialSeason()
    })

    const setSeason = useCallback((s: string) => {
        setSeasonState(s)
        try { localStorage.setItem(STORAGE_KEY, s) } catch { /* ok */ }
    }, [])

    // Sync across tabs
    useEffect(() => {
        const onStorage = (e: StorageEvent) => {
            if (e.key === STORAGE_KEY && e.newValue && ALL_SEASONS.includes(e.newValue)) {
                setSeasonState(e.newValue)
            }
        }
        window.addEventListener('storage', onStorage)
        return () => window.removeEventListener('storage', onStorage)
    }, [])

    return { season, setSeason, seasons: ALL_SEASONS }
}
