import { useEffect, useState } from 'react'
import { Trash2, AlertTriangle, X, Eye } from 'lucide-react'
import {
    useAdminApi,
    type AdminUser,
    type AdminFollow,
} from '../../lib/adminApi'

function formatDate(ts: number | null) {
    if (!ts) return '—'
    return new Date(ts).toLocaleDateString('pt-PT', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    })
}

export default function UsersAdmin() {
    const api = useAdminApi()
    const [users, setUsers] = useState<AdminUser[]>([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [offset, setOffset] = useState(0)
    const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)
    const [deleting, setDeleting] = useState(false)
    const [deleteError, setDeleteError] = useState<string | null>(null)
    const [detailUser, setDetailUser] = useState<AdminUser | null>(null)
    const [follows, setFollows] = useState<AdminFollow[]>([])
    const [followsLoading, setFollowsLoading] = useState(false)

    const LIMIT = 30

    const loadUsers = () => {
        setLoading(true)
        api
            .listUsers(LIMIT, offset)
            .then((data) => {
                setUsers(data.users)
                setTotal(data.total)
            })
            .catch((e: Error) => setError(e.message))
            .finally(() => setLoading(false))
    }

    useEffect(() => {
        loadUsers()
    }, [offset])

    const confirmDelete = async () => {
        if (!deleteTarget) return
        setDeleting(true)
        setDeleteError(null)
        try {
            const result = await api.deleteUser(deleteTarget.id)
            if (result.ok) {
                setUsers((prev) =>
                    prev.filter((u) => u.id !== deleteTarget.id),
                )
                setDeleteTarget(null)
            } else {
                setDeleteError(
                    result.errors?.join(', ') || 'Erro ao apagar',
                )
            }
        } catch (e) {
            setDeleteError((e as Error).message)
        } finally {
            setDeleting(false)
        }
    }

    const showDetail = async (user: AdminUser) => {
        setDetailUser(user)
        setFollowsLoading(true)
        try {
            const data = await api.getUserFollows(user.id)
            setFollows(data.follows)
        } catch {
            setFollows([])
        } finally {
            setFollowsLoading(false)
        }
    }

    const totalPages = Math.ceil(total / LIMIT)
    const currentPage = Math.floor(offset / LIMIT) + 1

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-black text-zinc-900 dark:text-white">
                    Utilizadores ({total})
                </h2>
            </div>

            {error && (
                <p className="text-red-500 text-sm font-bold mb-4">
                    Erro: {error}
                </p>
            )}

            {loading ? (
                <p className="text-zinc-500 text-sm">A carregar...</p>
            ) : (
                <>
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden mb-4">
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
                                        <th className="text-left px-4 py-2.5 font-bold text-zinc-500">
                                            Email
                                        </th>
                                        <th className="text-left px-4 py-2.5 font-bold text-zinc-500">
                                            Username
                                        </th>
                                        <th className="text-left px-4 py-2.5 font-bold text-zinc-500">
                                            Registo
                                        </th>
                                        <th className="text-left px-4 py-2.5 font-bold text-zinc-500">
                                            Último login
                                        </th>
                                        <th className="text-center px-4 py-2.5 font-bold text-zinc-500">
                                            Admin
                                        </th>
                                        <th className="px-4 py-2.5"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((u) => (
                                        <tr
                                            key={u.id}
                                            className="border-b border-zinc-50 dark:border-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-950 transition-colors"
                                        >
                                            <td className="px-4 py-2 font-bold text-zinc-900 dark:text-white">
                                                {u.email || '—'}
                                            </td>
                                            <td className="px-4 py-2 text-zinc-500">
                                                {u.username || '—'}
                                            </td>
                                            <td className="px-4 py-2 text-zinc-400">
                                                {formatDate(u.created_at)}
                                            </td>
                                            <td className="px-4 py-2 text-zinc-400">
                                                {formatDate(u.last_sign_in_at)}
                                            </td>
                                            <td className="px-4 py-2 text-center">
                                                {u.is_admin ? (
                                                    <span className="inline-block px-2 py-0.5 rounded-md bg-dribly-purple/10 text-[10px] font-bold text-dribly-purple">
                                                        Admin
                                                    </span>
                                                ) : (
                                                    <span className="text-zinc-300">
                                                        —
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2">
                                                <div className="flex items-center gap-1 justify-end">
                                                    <button
                                                        onClick={() =>
                                                            showDetail(u)
                                                        }
                                                        className="p-1.5 rounded-lg text-zinc-400 hover:text-dribly-purple hover:bg-dribly-purple/5 transition-colors"
                                                        title="Ver follows"
                                                    >
                                                        <Eye size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() =>
                                                            setDeleteTarget(u)
                                                        }
                                                        className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                                        title="Apagar"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {users.length === 0 && (
                                        <tr>
                                            <td
                                                colSpan={6}
                                                className="text-center py-8 text-zinc-400"
                                            >
                                                Nenhum utilizador encontrado.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2">
                            <button
                                disabled={offset === 0}
                                onClick={() =>
                                    setOffset((p) =>
                                        Math.max(0, p - LIMIT),
                                    )
                                }
                                className="px-3 py-1.5 rounded-lg text-xs font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/5 disabled:opacity-30 transition-colors"
                            >
                                ← Anterior
                            </button>
                            <span className="text-xs text-zinc-400">
                                Página {currentPage} de {totalPages}
                            </span>
                            <button
                                disabled={
                                    offset + LIMIT >= total
                                }
                                onClick={() =>
                                    setOffset((p) =>
                                        p + LIMIT,
                                    )
                                }
                                className="px-3 py-1.5 rounded-lg text-xs font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/5 disabled:opacity-30 transition-colors"
                            >
                                Seguinte →
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* ── Delete modal ─────────────────────────── */}
            {deleteTarget && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
                    onClick={() => !deleting && setDeleteTarget(null)}
                >
                    <div
                        className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 max-w-sm w-full mx-4 shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                <AlertTriangle
                                    size={20}
                                    className="text-red-500"
                                />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                                    Apagar utilizador?
                                </h3>
                                <p className="text-[11px] text-zinc-500">
                                    Esta ação é irreversível.
                                </p>
                            </div>
                        </div>

                        <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-4">
                            <strong>{deleteTarget.email}</strong> será removido
                            do Clerk <strong>e</strong> do Supabase (follows,
                            favoritos). Esta ação é sincronizada — ou apaga nos
                            dois ou reporta erro.
                        </p>

                        {deleteError && (
                            <p className="text-xs text-red-500 mb-3 font-bold">
                                {deleteError}
                            </p>
                        )}

                        <div className="flex gap-2">
                            <button
                                onClick={() => setDeleteTarget(null)}
                                disabled={deleting}
                                className="flex-1 px-4 py-2 rounded-xl text-xs font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmDelete}
                                disabled={deleting}
                                className="flex-1 px-4 py-2 rounded-xl text-xs font-bold bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
                            >
                                {deleting
                                    ? 'A apagar...'
                                    : 'Sim, apagar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Detail modal ─────────────────────────── */}
            {detailUser && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
                    onClick={() => setDetailUser(null)}
                >
                    <div
                        className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 max-w-md w-full mx-4 shadow-xl max-h-[80vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                                Follows de {detailUser.email}
                            </h3>
                            <button
                                onClick={() => setDetailUser(null)}
                                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {followsLoading ? (
                            <p className="text-xs text-zinc-500">
                                A carregar...
                            </p>
                        ) : follows.length === 0 ? (
                            <p className="text-xs text-zinc-400">
                                Este utilizador não segue nada.
                            </p>
                        ) : (
                            <div className="space-y-1">
                                {follows.map((f, i) => (
                                    <div
                                        key={i}
                                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-xs"
                                    >
                                        <span
                                            className={`w-1.5 h-1.5 rounded-full ${
                                                f.entity_type === 'club'
                                                    ? 'bg-dribly-purple'
                                                    : 'bg-amber-500'
                                            }`}
                                        />
                                        <span className="text-zinc-500">
                                            {f.entity_type === 'club'
                                                ? 'Clube'
                                                : 'Competição'}
                                        </span>
                                        <span className="text-zinc-400 font-mono text-[11px]">
                                            #{f.entity_id}
                                        </span>
                                        <span className="text-zinc-300 text-[10px] ml-auto">
                                            {formatDate(
                                                new Date(
                                                    f.created_at,
                                                ).getTime(),
                                            )}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
