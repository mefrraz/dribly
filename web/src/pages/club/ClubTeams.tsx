import { Link, useOutletContext } from 'react-router-dom'
import { Users, ChevronRight } from 'lucide-react'
import { PageHeader } from '../../components/PageHeader'
import { useTeamPhotos } from '../../lib/useTeamPhotos'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { type Club, displayName } from '../../lib/ClubContext'

function slugify(text: string): string {
    return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-+/g, '-')
}

function ClubTeams() {
    const { club } = useOutletContext<{ club: Club }>()
    const { teams: fpbTeams, loading } = useTeamPhotos(club.id, club.name)

    if (loading) {
        return <LoadingSpinner />
    }

    // Sort: oldest escalão first, same escalão: A before B
    const escalaoOrder = ['MASTERS', 'VETERANOS', 'SENIOR', 'SUB23', 'SUB22', 'SUB18', 'SUB16', 'SUB14', 'MINI12', 'MINI10', 'MINI8']
    function escalaoPriority(t: typeof fpbTeams[0]): number {
        const search = (t.nome + ' ' + (t.escalao || '')).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/\bSUB\s*(\d)/gi, 'SUB$1')
            .replace(/\bMINI\s*(\d)/gi, 'MINI$1')
        for (let i = 0; i < escalaoOrder.length; i++) if (search.includes(escalaoOrder[i])) return i
        return escalaoOrder.length
    }
    const displayTeams = [...fpbTeams].sort((a, b) => {
        const pa = escalaoPriority(a); const pb = escalaoPriority(b)
        if (pa !== pb) return pa - pb
        const aA = /\bA\b/.test(a.nome); const bA = /\bA\b/.test(b.nome)
        if (aA && !bA) return -1; if (!aA && bA) return 1
        return a.nome.localeCompare(b.nome)
    })

    if (displayTeams.length === 0) {
        return (
            <div className="max-w-xl mx-auto px-3 py-20 text-center">
                <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-4">
                    <Users size={28} className="text-zinc-400" />
                </div>
                <p className="text-sm font-medium text-zinc-500">Nenhuma equipa encontrada</p>
                <p className="text-xs text-zinc-400 mt-1">Os dados podem ainda não estar disponíveis.</p>
            </div>
        )
    }

    return (
        <div className="max-w-xl mx-auto space-y-4 pb-20 px-3">
            <PageHeader backTo={`/clube/${club.slug}/home`} title={displayName(club)} />
            <div className="pt-1 pb-1">
                <h2 className="text-xl font-black text-zinc-900 dark:text-white">Equipas</h2>
                <p className="text-xs text-zinc-500 mt-1">{displayTeams.length} equipas de {displayName(club)} na época 2025/2026</p>
            </div>

            <div className="space-y-2.5">
                {displayTeams.map(team => (
                    <Link
                        key={team.id}
                        to={`/clube/${club.slug}/team/${slugify(team.nome)}?eid=${team.id}`}
                        className="block bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden hover:shadow-md hover:border-dribly-purple/30 dark:hover:border-dribly-purple/30 transition-all duration-200"
                    >
                        {team.photo && (
                            <div className="relative h-48 bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                                <img src={team.photo} alt="" className="absolute inset-0 w-full h-full object-cover object-center" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                            </div>
                        )}
                        <div className="p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white truncate">
                                        {team.nome}
                                    </h3>
                                    {team.escalao && (
                                        <div className="flex items-center gap-1.5 mt-1">
                                            <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
                                                {team.escalao}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <ChevronRight size={16} className="text-zinc-400 shrink-0 mt-1" />
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    )
}

export default ClubTeams
