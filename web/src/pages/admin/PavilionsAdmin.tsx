import { useEffect, useState } from 'react'
import { Search, Save, X, MapPin, ExternalLink } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface PavilionRow {
    id: number
    recinto_id: number | null
    nome: string
    rua: string | null
    codigo_postal: string | null
    cidade: string | null
    distrito: string | null
    concelho: string | null
    lat: number | null
    lng: number | null
    fpb_url: string | null
    geocode_ok: boolean
}

export default function PavilionsAdmin() {
    const [pavilions, setPavilions] = useState<PavilionRow[]>([])
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(true)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [editForm, setEditForm] = useState<Partial<PavilionRow>>({})
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const load = async () => {
            try {
                const { data } = await supabase
                    .from('pavilions')
                    .select('*')
                    .order('nome')
                if (data) setPavilions(data as PavilionRow[])
            } catch (e) {
                setError((e as Error).message)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    const filtered = pavilions.filter(
        (p) =>
            !search ||
            p.nome.toLowerCase().includes(search.toLowerCase()) ||
            (p.cidade || '').toLowerCase().includes(search.toLowerCase()) ||
            (p.distrito || '').toLowerCase().includes(search.toLowerCase()),
    )

    const startEdit = (p: PavilionRow) => {
        setEditingId(p.id)
        setEditForm({ ...p })
    }

    const cancelEdit = () => {
        setEditingId(null)
        setEditForm({})
    }

    const saveEdit = async () => {
        if (!editingId || !editForm.nome) return
        setSaving(true)
        const { error: updateErr } = await supabase
            .from('pavilions')
            .update({
                nome: editForm.nome,
                rua: editForm.rua || null,
                codigo_postal: editForm.codigo_postal || null,
                cidade: editForm.cidade || null,
                distrito: editForm.distrito || null,
                concelho: editForm.concelho || null,
                lat: editForm.lat ?? null,
                lng: editForm.lng ?? null,
                fpb_url: editForm.fpb_url || null,
            })
            .eq('id', editingId)

        if (updateErr) {
            setError(updateErr.message)
        } else {
            setPavilions((prev) =>
                prev.map((p) =>
                    p.id === editingId ? { ...p, ...editForm } : p,
                ),
            )
            setEditingId(null)
        }
        setSaving(false)
    }

    if (loading) {
        return <p className="text-zinc-500 text-sm">A carregar pavilhões...</p>
    }

    if (error) {
        return <p className="text-red-500 text-sm font-bold">Erro: {error}</p>
    }

    // Stats
    const withCoords = pavilions.filter((p) => p.lat && p.lng).length
    const withoutCoords = pavilions.length - withCoords

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-lg font-black text-zinc-900 dark:text-white">
                        Pavilhões ({pavilions.length})
                    </h2>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                        {withCoords} com coordenadas · {withoutCoords} sem
                        geocode
                    </p>
                </div>
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
                        className="pl-8 pr-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white w-52 focus:outline-none focus:border-dribly-purple"
                    />
                </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
                                <th className="text-left px-4 py-2.5 font-bold text-zinc-500 w-12">ID</th>
                                <th className="text-left px-4 py-2.5 font-bold text-zinc-500">Nome</th>
                                <th className="text-left px-4 py-2.5 font-bold text-zinc-500">Rua</th>
                                <th className="text-left px-4 py-2.5 font-bold text-zinc-500">Cód. Postal</th>
                                <th className="text-left px-4 py-2.5 font-bold text-zinc-500">Cidade</th>
                                <th className="text-left px-4 py-2.5 font-bold text-zinc-500">Distrito</th>
                                <th className="text-left px-4 py-2.5 font-bold text-zinc-500 w-16">Coord</th>
                                <th className="text-left px-4 py-2.5 font-bold text-zinc-500 w-16">FPB</th>
                                <th className="px-4 py-2.5 w-16"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((p) =>
                                editingId === p.id ? (
                                    <EditRow
                                        key={p.id}
                                        form={editForm}
                                        setForm={setEditForm}
                                        onSave={saveEdit}
                                        onCancel={cancelEdit}
                                        saving={saving}
                                    />
                                ) : (
                                    <tr
                                        key={p.id}
                                        className="border-b border-zinc-50 dark:border-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-950 transition-colors"
                                    >
                                        <td className="px-4 py-2 text-zinc-400 font-mono">
                                            {p.id}
                                        </td>
                                        <td className="px-4 py-2 font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                                            <MapPin size={12} className="text-dribly-purple shrink-0" />
                                            <span className="truncate max-w-[250px]">{p.nome}</span>
                                        </td>
                                        <td className="px-4 py-2 text-zinc-500 truncate max-w-[150px]">{p.rua || '—'}</td>
                                        <td className="px-4 py-2 text-zinc-500 font-mono text-[11px]">{p.codigo_postal || '—'}</td>
                                        <td className="px-4 py-2 text-zinc-500">{p.cidade || '—'}</td>
                                        <td className="px-4 py-2">
                                            {p.distrito ? (
                                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-dribly-purple/10 text-dribly-purple">
                                                    {p.distrito}
                                                </span>
                                            ) : '—'}
                                        </td>
                                        <td className="px-4 py-2">
                                            {p.lat && p.lng ? (
                                                <span className="text-green-600 dark:text-green-400 font-bold">✓</span>
                                            ) : (
                                                <span className="text-red-400">✗</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2">
                                            {p.fpb_url ? (
                                                <a href={p.fpb_url} target="_blank" rel="noopener noreferrer"
                                                    className="text-drably-purple hover:underline inline-flex items-center gap-1">
                                                    <ExternalLink size={11} />
                                                </a>
                                            ) : '—'}
                                        </td>
                                        <td className="px-4 py-2">
                                            <button
                                                onClick={() => startEdit(p)}
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
                        Nenhum pavilhão encontrado.
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
    form: Partial<PavilionRow>
    setForm: (f: Partial<PavilionRow>) => void
    onSave: () => void
    onCancel: () => void
    saving: boolean
}) {
    const field = (label: string, key: keyof PavilionRow, width: string) => (
        <input
            type="text"
            value={(form[key] as string) || ''}
            onChange={(e) => setForm({ ...form, [key]: e.target.value || null })}
            placeholder={label}
            className={`${width} px-2 py-1 text-[11px] rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white`}
        />
    )

    return (
        <tr className="bg-dribly-purple/5 dark:bg-dribly-purple/10 border-b border-dribly-purple/20">
            <td className="px-4 py-2 text-zinc-400 font-mono">{form.id}</td>
            <td className="px-4 py-2">{field('Nome', 'nome', 'w-40')}</td>
            <td className="px-4 py-2">{field('Rua', 'rua', 'w-36')}</td>
            <td className="px-4 py-2">{field('C.Postal', 'codigo_postal', 'w-24')}</td>
            <td className="px-4 py-2">{field('Cidade', 'cidade', 'w-24')}</td>
            <td className="px-4 py-2">{field('Distrito', 'distrito', 'w-28')}</td>
            <td className="px-4 py-2">
                <div className="flex items-center gap-1">
                    <input type="number" step="any" value={form.lat ?? ''}
                        onChange={(e) => setForm({ ...form, lat: e.target.value ? parseFloat(e.target.value) : null })}
                        placeholder="lat" className="w-20 px-1 py-1 text-[10px] rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white" />
                    <input type="number" step="any" value={form.lng ?? ''}
                        onChange={(e) => setForm({ ...form, lng: e.target.value ? parseFloat(e.target.value) : null })}
                        placeholder="lng" className="w-20 px-1 py-1 text-[10px] rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white" />
                </div>
            </td>
            <td className="px-4 py-2">{field('URL FPB', 'fpb_url', 'w-40')}</td>
            <td className="px-4 py-2">
                <div className="flex items-center gap-1">
                    <button onClick={onSave} disabled={saving}
                        className="p-1.5 rounded-lg bg-dribly-purple text-white hover:bg-dribly-purple-dark transition-colors disabled:opacity-50" title="Guardar">
                        <Save size={14} />
                    </button>
                    <button onClick={onCancel}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors" title="Cancelar">
                        <X size={14} />
                    </button>
                </div>
            </td>
        </tr>
    )
}
