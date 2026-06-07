import { useEffect, useState } from 'react'
import { Save, X } from 'lucide-react'
import {
    useAdminApi,
    type AdminCompetitionMeta,
} from '../../lib/adminApi'

export default function CompetitionsAdmin() {
    const api = useAdminApi()
    const [comps, setComps] = useState<AdminCompetitionMeta[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [editForm, setEditForm] = useState<Partial<AdminCompetitionMeta>>({})
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        api
            .listCompetitionsMeta()
            .then((data) => setComps(data.competitions))
            .catch((e: Error) => setError(e.message))
            .finally(() => setLoading(false))
    }, [])

    const startEdit = (comp: AdminCompetitionMeta) => {
        setEditingId(comp.id)
        setEditForm({ ...comp })
    }

    const cancelEdit = () => {
        setEditingId(null)
        setEditForm({})
    }

    const saveEdit = async () => {
        if (!editingId || !editForm.name) return
        setSaving(true)
        try {
            const result = await api.upsertCompetitionMeta({
                id: editingId,
                ...editForm,
            } as AdminCompetitionMeta)
            setComps((prev) =>
                prev.map((c) =>
                    c.id === editingId
                        ? (result.competition as AdminCompetitionMeta)
                        : c,
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
        return (
            <p className="text-zinc-500 text-sm">A carregar competições...</p>
        )
    }

    if (error) {
        return <p className="text-red-500 text-sm font-bold">Erro: {error}</p>
    }

    return (
        <div>
            <h2 className="text-lg font-black text-zinc-900 dark:text-white mb-4">
                Competições ({comps.length})
            </h2>

            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
                                <th className="text-left px-4 py-2.5 font-bold text-zinc-500">
                                    Logo
                                </th>
                                <th className="text-left px-4 py-2.5 font-bold text-zinc-500">
                                    Nome
                                </th>
                                <th className="text-left px-4 py-2.5 font-bold text-zinc-500">
                                    Abrev
                                </th>
                                <th className="text-left px-4 py-2.5 font-bold text-zinc-500">
                                    Gradiente
                                </th>
                                <th className="px-4 py-2.5"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {comps.map((comp) =>
                                editingId === comp.id ? (
                                    <EditRow
                                        key={comp.id}
                                        form={editForm}
                                        setForm={setEditForm}
                                        onSave={saveEdit}
                                        onCancel={cancelEdit}
                                        saving={saving}
                                    />
                                ) : (
                                    <tr
                                        key={comp.id}
                                        className="border-b border-zinc-50 dark:border-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-950 transition-colors"
                                    >
                                        <td className="px-4 py-2">
                                            {comp.logo_url ? (
                                                <img
                                                    src={comp.logo_url}
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
                                            {comp.name}
                                        </td>
                                        <td className="px-4 py-2 text-zinc-500 font-mono">
                                            {comp.abrev}
                                        </td>
                                        <td className="px-4 py-2">
                                            {comp.gradient_from ? (
                                                <div className="flex items-center gap-1">
                                                    <span
                                                        className="w-4 h-4 rounded-full border border-zinc-300"
                                                        style={{
                                                            backgroundColor:
                                                                comp.gradient_from,
                                                        }}
                                                    />
                                                    <span
                                                        className="w-4 h-4 rounded-full border border-zinc-300"
                                                        style={{
                                                            backgroundColor:
                                                                comp.gradient_to || comp.gradient_from,
                                                        }}
                                                    />
                                                </div>
                                            ) : (
                                                <span className="text-zinc-300">
                                                    —
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2">
                                            <button
                                                onClick={() =>
                                                    startEdit(comp)
                                                }
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
            </div>
        </div>
    )
}

function EditRow({
    form,
    setForm,
    onSave,
    onCancel,
    saving,
}: {
    form: Partial<AdminCompetitionMeta>
    setForm: (f: Partial<AdminCompetitionMeta>) => void
    onSave: () => void
    onCancel: () => void
    saving: boolean
}) {
    return (
        <tr className="bg-dribly-purple/5 dark:bg-dribly-purple/10 border-b border-dribly-purple/20">
            <td className="px-4 py-2">
                <input
                    type="text"
                    value={form.logo_url || ''}
                    onChange={(e) =>
                        setForm({ ...form, logo_url: e.target.value || null })
                    }
                    placeholder="URL logo"
                    className="w-36 px-2 py-1 text-[11px] rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white"
                />
            </td>
            <td className="px-4 py-2">
                <input
                    type="text"
                    value={form.name || ''}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-48 px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white font-bold"
                />
            </td>
            <td className="px-4 py-2">
                <input
                    type="text"
                    value={form.abrev || ''}
                    onChange={(e) =>
                        setForm({ ...form, abrev: e.target.value })
                    }
                    className="w-20 px-2 py-1 text-[11px] rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white font-mono"
                />
            </td>
            <td className="px-4 py-2">
                <div className="flex items-center gap-1.5">
                    <input
                        type="color"
                        value={form.gradient_from || '#7C3AED'}
                        onChange={(e) =>
                            setForm({
                                ...form,
                                gradient_from: e.target.value,
                            })
                        }
                        className="w-7 h-7 rounded cursor-pointer border-0 p-0"
                    />
                    <input
                        type="color"
                        value={form.gradient_to || '#4C1D95'}
                        onChange={(e) =>
                            setForm({
                                ...form,
                                gradient_to: e.target.value,
                            })
                        }
                        className="w-7 h-7 rounded cursor-pointer border-0 p-0"
                    />
                </div>
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
