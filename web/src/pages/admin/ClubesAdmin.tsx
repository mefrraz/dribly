import { useEffect, useState } from 'react'
import { Search, Save, X } from 'lucide-react'
import { useAdminApi, type AdminClub } from '../../lib/adminApi'

export default function ClubesAdmin() {
    const api = useAdminApi()
    const [clubs, setClubs] = useState<AdminClub[]>([])
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(true)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [editForm, setEditForm] = useState<Partial<AdminClub>>({})
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        api
            .listClubs()
            .then((data) => setClubs(data.clubs))
            .catch((e: Error) => setError(e.message))
            .finally(() => setLoading(false))
    }, [])

    const filtered = clubs.filter(
        (c) =>
            !search ||
            c.name.toLowerCase().includes(search.toLowerCase()) ||
            c.slug.toLowerCase().includes(search.toLowerCase()),
    )

    const startEdit = (club: AdminClub) => {
        setEditingId(club.id)
        setEditForm({ ...club })
    }

    const cancelEdit = () => {
        setEditingId(null)
        setEditForm({})
    }

    const saveEdit = async () => {
        if (!editingId || !editForm.name || !editForm.slug) return
        setSaving(true)
        try {
            const result = await api.upsertClub({
                id: editingId,
                ...editForm,
            } as AdminClub)
            setClubs((prev) =>
                prev.map((c) =>
                    c.id === editingId ? (result.club as AdminClub) : c,
                ),
            )
            setEditingId(null)
        } catch (e) {
            setError((e as Error).message)
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return <p className="text-zinc-500 text-sm">A carregar clubes...</p>
    }

    if (error) {
        return <p className="text-red-500 text-sm font-bold">Erro: {error}</p>
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-black text-zinc-900 dark:text-white">
                    Clubes ({clubs.length})
                </h2>
                <div className="relative">
                    <Search
                        size={14}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                    />
                    <input
                        type="text"
                        placeholder="Pesquisar..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-8 pr-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white w-48 focus:outline-none focus:border-dribly-purple"
                    />
                </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
                                <th className="text-left px-4 py-2.5 font-bold text-zinc-500">
                                    ID
                                </th>
                                <th className="text-left px-4 py-2.5 font-bold text-zinc-500">
                                    Logo
                                </th>
                                <th className="text-left px-4 py-2.5 font-bold text-zinc-500">
                                    Nome
                                </th>
                                <th className="text-left px-4 py-2.5 font-bold text-zinc-500">
                                    Slug
                                </th>
                                <th className="text-left px-4 py-2.5 font-bold text-zinc-500">
                                    Cor
                                </th>
                                <th className="text-left px-4 py-2.5 font-bold text-zinc-500">
                                    Prioridade
                                </th>
                                <th className="px-4 py-2.5"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((club) =>
                                editingId === club.id ? (
                                    <EditRow
                                        key={club.id}
                                        form={editForm}
                                        setForm={setEditForm}
                                        onSave={saveEdit}
                                        onCancel={cancelEdit}
                                        saving={saving}
                                    />
                                ) : (
                                    <tr
                                        key={club.id}
                                        className="border-b border-zinc-50 dark:border-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-950 transition-colors"
                                    >
                                        <td className="px-4 py-2 text-zinc-400 font-mono">
                                            {club.id}
                                        </td>
                                        <td className="px-4 py-2">
                                            {club.logo_url ? (
                                                <img
                                                    src={club.logo_url}
                                                    alt=""
                                                    className="w-6 h-6 object-contain rounded"
                                                />
                                            ) : (
                                                <span className="text-zinc-300">
                                                    —
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2 font-bold text-zinc-900 dark:text-white">
                                            {club.name}
                                        </td>
                                        <td className="px-4 py-2 text-zinc-500 font-mono text-[11px]">
                                            {club.slug}
                                        </td>
                                        <td className="px-4 py-2">
                                            {club.primary_color ? (
                                                <div className="flex items-center gap-1.5">
                                                    <span
                                                        className="w-4 h-4 rounded-full border border-zinc-300 dark:border-zinc-600"
                                                        style={{
                                                            backgroundColor:
                                                                club.primary_color,
                                                        }}
                                                    />
                                                    <span className="text-[11px] text-zinc-400">
                                                        {club.primary_color}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-zinc-300">
                                                    —
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2 text-zinc-400">
                                            {club.priority ?? '—'}
                                        </td>
                                        <td className="px-4 py-2">
                                            <button
                                                onClick={() => startEdit(club)}
                                                className="text-xs font-bold text-dribly-purple hover:underline"
                                            >
                                                Editar
                                            </button>
                                        </td>
                                    </tr>
                                ),
                            )}
                        </tbody>
                    </table>
                </div>
                {filtered.length === 0 && (
                    <p className="text-center py-8 text-zinc-400 text-xs">
                        Nenhum clube encontrado.
                    </p>
                )}
            </div>
        </div>
    )
}

// ── Inline edit row ────────────────────────────────────

function EditRow({
    form,
    setForm,
    onSave,
    onCancel,
    saving,
}: {
    form: Partial<AdminClub>
    setForm: (f: Partial<AdminClub>) => void
    onSave: () => void
    onCancel: () => void
    saving: boolean
}) {
    return (
        <tr className="bg-dribly-purple/5 dark:bg-dribly-purple/10 border-b border-dribly-purple/20">
            <td className="px-4 py-2 text-zinc-400 font-mono">{form.id}</td>
            <td className="px-4 py-2">
                <input
                    type="text"
                    value={form.logo_url || ''}
                    onChange={(e) =>
                        setForm({ ...form, logo_url: e.target.value || null })
                    }
                    placeholder="URL logo"
                    className="w-28 px-2 py-1 text-[11px] rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white"
                />
            </td>
            <td className="px-4 py-2">
                <input
                    type="text"
                    value={form.name || ''}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-40 px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white font-bold"
                />
            </td>
            <td className="px-4 py-2">
                <input
                    type="text"
                    value={form.slug || ''}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    className="w-36 px-2 py-1 text-[11px] rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white font-mono"
                />
            </td>
            <td className="px-4 py-2">
                <div className="flex items-center gap-1.5">
                    <input
                        type="color"
                        value={form.primary_color || '#7C3AED'}
                        onChange={(e) =>
                            setForm({
                                ...form,
                                primary_color: e.target.value,
                            })
                        }
                        className="w-7 h-7 rounded cursor-pointer border-0 p-0"
                    />
                    <input
                        type="text"
                        value={form.primary_color || ''}
                        onChange={(e) =>
                            setForm({
                                ...form,
                                primary_color: e.target.value,
                            })
                        }
                        placeholder="#000000"
                        className="w-20 px-2 py-1 text-[11px] rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white"
                    />
                </div>
            </td>
            <td className="px-4 py-2">
                <input
                    type="number"
                    value={form.priority ?? ''}
                    onChange={(e) =>
                        setForm({
                            ...form,
                            priority: e.target.value
                                ? parseInt(e.target.value)
                                : null,
                        })
                    }
                    className="w-16 px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white"
                />
            </td>
            <td className="px-4 py-2">
                <div className="flex items-center gap-1">
                    <button
                        onClick={onSave}
                        disabled={saving}
                        className="p-1.5 rounded-lg bg-dribly-purple text-white hover:bg-dribly-purple-dark transition-colors disabled:opacity-50"
                        title="Guardar"
                    >
                        <Save size={14} />
                    </button>
                    <button
                        onClick={onCancel}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
                        title="Cancelar"
                    >
                        <X size={14} />
                    </button>
                </div>
            </td>
        </tr>
    )
}
