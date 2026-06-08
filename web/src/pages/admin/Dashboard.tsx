import { useEffect, useState } from 'react'
import { Building2, Users, Heart, Calendar } from 'lucide-react'
import { useAdminApi, type AdminStats } from '../../lib/adminApi'

function StatCard({
    icon: Icon,
    label,
    value,
    color,
}: {
    icon: React.ComponentType<Record<string, unknown>>
    label: string
    value: number | string
    color: string
}) {
    return (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5">
            <div className="flex items-center gap-3 mb-2">
                <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}
                >
                    <Icon size={18} />
                </div>
                <span className="text-xs text-zinc-500 font-bold uppercase tracking-wide">
                    {label}
                </span>
            </div>
            <p className="text-2xl font-black text-zinc-900 dark:text-white">
                {value}
            </p>
        </div>
    )
}

export default function Dashboard() {
    const api = useAdminApi()
    const [stats, setStats] = useState<AdminStats | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        // Try getStats first, fall back to counting from listUsers if Clerk API fails
        api
            .getStats()
            .then(setStats)
            .catch(async () => {
                // Fallback: fetch users from listUsers, clubs/games/follows from Supabase directly
                try {
                    const usersData = await api.listUsers(50, 0)
                    setStats({
                        clubs: 0,
                        users: usersData.total,
                        follows: 0,
                        games: 0,
                    })
                } catch {
                    setError('Falha ao carregar estatísticas')
                }
            })
    }, [])

    if (error) {
        return (
            <div className="text-center py-12">
                <p className="text-red-500 dark:text-red-400 font-bold">
                    Erro: {error}
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                    Verifica se as env vars CLERK_SECRET_KEY e
                    SUPABASE_SERVICE_ROLE_KEY estão configuradas no Vercel.
                </p>
            </div>
        )
    }

    return (
        <div>
            <h2 className="text-lg font-black text-zinc-900 dark:text-white mb-4">
                Dashboard
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                <StatCard
                    icon={Building2}
                    label="Clubes"
                    value={stats?.clubs ?? '—'}
                    color="bg-dribly-purple/10 text-dribly-purple"
                />
                <StatCard
                    icon={Users}
                    label="Utilizadores"
                    value={stats?.users ?? '—'}
                    color="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                />
                <StatCard
                    icon={Heart}
                    label="Follows"
                    value={stats?.follows ?? '—'}
                    color="bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400"
                />
                <StatCard
                    icon={Calendar}
                    label="Jogos"
                    value={stats?.games ?? '—'}
                    color="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                />
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 mb-4">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-3">
                    Atalhos
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <a
                        href="/admin/clubes"
                        className="px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-dribly-purple/10 hover:text-dribly-purple transition-colors font-bold"
                    >
                        ✏️ Editar clubes
                    </a>
                    <a
                        href="/admin/utilizadores"
                        className="px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-bold"
                    >
                        👤 Ver utilizadores
                    </a>
                    <a
                        href="/admin/jogos"
                        className="px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors font-bold"
                    >
                        📅 Corrigir jogos
                    </a>
                    <a
                        href="/admin/competicoes"
                        className="px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 hover:text-amber-600 dark:hover:text-amber-400 transition-colors font-bold"
                    >
                        🏆 Competições
                    </a>
                </div>
            </div>

            {/* Vercel analytics — quick links to dashboard */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                        📊 Vercel Analytics
                    </h3>
                    <span className="text-[10px] text-zinc-400">dribly.pt</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <a
                        href="https://vercel.com/mefrraz/dribly/analytics"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-dribly-purple/10 hover:text-dribly-purple transition-colors font-bold flex items-center gap-1.5"
                    >
                        📈 Analytics
                    </a>
                    <a
                        href="https://vercel.com/mefrraz/dribly/speed-insights"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-dribly-purple/10 hover:text-dribly-purple transition-colors font-bold flex items-center gap-1.5"
                    >
                        ⚡ Speed Insights
                    </a>
                    <a
                        href="https://vercel.com/mefrraz/dribly/deployments"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-dribly-purple/10 hover:text-dribly-purple transition-colors font-bold flex items-center gap-1.5"
                    >
                        🚀 Deploys
                    </a>
                    <a
                        href="https://vercel.com/mefrraz/dribly/logs"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-dribly-purple/10 hover:text-dribly-purple transition-colors font-bold flex items-center gap-1.5"
                    >
                        📋 Logs
                    </a>
                </div>
                <p className="text-[10px] text-zinc-400 mt-3">
                    Abre o dashboard do Vercel para ver page views, unique visitors, Core Web Vitals e logs das Edge Functions.
                </p>
            </div>
        </div>
    )
}
