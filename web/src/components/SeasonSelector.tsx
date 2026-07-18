import { useSeason } from '../hooks/useSeason'

interface Props {
    className?: string
    value?: string
    onChange?: (season: string) => void
}

export function SeasonSelector({ className = '', value, onChange }: Props) {
    const ownSeason = useSeason()
    const season = value ?? ownSeason.season
    const setSeason = onChange ?? ownSeason.setSeason
    const seasons = ownSeason.seasons

    return (
        <select
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-800 dark:text-zinc-200 text-xs font-medium rounded-lg focus:ring-2 focus:ring-[var(--club-color)]/30 focus:border-[var(--club-color)] p-2.5 appearance-none shadow-sm transition-colors ${className}`}
        >
            {seasons.map(s => (
                <option key={s} value={s}>{s}</option>
            ))}
        </select>
    )
}
