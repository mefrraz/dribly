import { useState } from 'react'
import { Search, Save, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAdminApi, type AdminGame } from '../../lib/adminApi'

export default function GamesAdmin() {
    const api = useAdminApi()
    const [query, setQuery] = useState('')
    const [games, setGames] = useState<AdminGame[]>([])
    const [loading, setLoading] = useState(false)
    const [searched, setSearched] = useState(false)
    const [editingSlug, setEditingSlug] = useState<string | null>(null)
    const [editForm, setEditForm] = useState<Record<string, unknown>>({})
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState<string | null>(null)

    const doSearch = async () => {
        if (!query.trim()) return
        setLoading(true)
        setSearched(true)
        setMessage(null)

        // Search by team name (casa or fora) using ilike via supabase
        const term = `%${query.trim()}%`
        const { data, error } = await supabase
            .from('games_2025_2026')
            .select('*')
            .or(`equipa_casa.ilike.${term},equipa_fora.ilike.${term}`)
            .order('data', { ascending: false })
            .limit(50)

        if (error) {
            setMessage('Erro na pesquisa: ' + error.message)
            setGames([])
        } else {
            setGames((data as AdminGame[]) || [])
        }
        setLoading(false)
    }

    const startEdit = (game: AdminGame) => {
        setEditingSlug(game.slug)
        setEditForm({
            status: game.status,
            resultado_casa: game.resultado_casa,
            resultado_fora: game.resultado_fora,
            data: game.data,
            hora: game.hora,
            local: game.local,
        })
    }

    const cancelEdit = () => {
        setEditingSlug(null)
        setEditForm({})
    }

    const saveEdit = async () => {
        if (!editingSlug) return
        setSaving(true)
        setMessage(null)
        try {
            await api.updateGame(editingSlug, editForm)
            setGames((prev) =>
                prev.map((g) =>
                    g.slug === editingSlug
                        ? ({ ...g, ...editForm } as AdminGame)
                        : g,
                ),
            )
            setEditingSlug(null)
            setMessage('Jogo atualizado com sucesso.')
        } catch (e) {
            setMessage('Erro: ' + (e as Error).message)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div>
            <h2 className="text-lg font-black text-zinc-900 dark:text-white mb-4">
                Corrigir Jogos
            </h2>

            {/* Search bar */}
            <div className="flex gap-2 mb-4">
                <div className="relative flex-1 max-w-md">
                    <Search
                        size={14}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                    />
                    <input
                        type="text"
                        placeholder='Ex: "FC Porto" ou "Benfica"...'
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && doSearch()}
                        className="w-full pl-8 pr-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-dribly-purple"
                    />
                </div>
                <button
                    onClick={doSearch}
                    disabled={loading}
                    className="px-4 py-2 rounded-xl bg-dribly-purple text-white text-sm font-bold hover:bg-dribly-purple-dark transition-colors disabled:opacity-50"
                >
                    {loading ? '...' : 'Pesquisar'}
                </button>
            </div>

            {message && (
                <p
                    className={`text-xs font-bold mb-3 ${
                        message.startsWith('Erro')
                            ? 'text-red-500'
                            : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                >
                    {message}
                </p>
            )}

            {/* Results */}
            {searched && (
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
                                    <th className="text-left px-4 py-2.5 font-bold text-zinc-500">
                                        Data
                                    </th>
                                    <th className="text-left px-4 py-2.5 font-bold text-zinc-500">
                                        Casa
                                    </th>
                                    <th className="text-center px-4 py-2.5 font-bold text-zinc-500">
                                        Res.
                                    </th>
                                    <th className="text-left px-4 py-2.5 font-bold text-zinc-500">
                                        Fora
                                    </th>
                                    <th className="text-left px-4 py-2.5 font-bold text-zinc-500">
                                        Status
                                    </th>
                                    <th className="text-left px-4 py-2.5 font-bold text-zinc-500">
                                        Local
                                    </th>
                                    <th className="px-4 py-2.5"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {games.map((game) =>
                                    editingSlug === game.slug ? (
                                        <EditRow
                                            key={game.slug}
                                            game={game}
                                            form={editForm}
                                            setForm={setEditForm}
                                            onSave={saveEdit}
                                            onCancel={cancelEdit}
                                            saving={saving}
                                        />
                                    ) : (
                                        <tr
                                            key={game.slug}
                                            className="border-b border-zinc-50 dark:border-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-950 transition-colors"
                                        >
                                            <td className="px-4 py-2 text-zinc-500">
                                                {game.data}
                                            </td>
                                            <td className="px-4 py-2 font-bold text-zinc-900 dark:text-white">
                                                {game.equipa_casa}
                                            </td>
                                            <td className="px-4 py-2 text-center font-mono font-bold text-zinc-900 dark:text-white">
                                                {game.resultado_casa != null
                                                    ? `${game.resultado_casa} - ${game.resultado_fora}`
                                                    : '—'}
                                            </td>
                                            <td className="px-4 py-2 font-bold text-zinc-900 dark:text-white">
                                                {game.equipa_fora}
                                            </td>
                                            <td className="px-4 py-2">
                                                <StatusBadge
                                                    status={game.status}
                                                />
                                            </td>
                                            <td className="px-4 py-2 text-zinc-400 max-w-[150px] truncate">
                                                {game.local || '—'}
                                            </td>
                                            <td className="px-4 py-2">
                                                <button
                                                    onClick={() =>
                                                        startEdit(game)
                                                    }
                                                    className="text-xs font-bold text-dribly-purple hover:underline"
                                                >
                                                    Editar
                                                </button>
                                            </td>
                                        </tr>
                                    ),
                                )}
                                {games.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={7}
                                            className="text-center py-8 text-zinc-400"
                                        >
                                            Nenhum jogo encontrado. Pesquisa por
                                            nome de equipa.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}

function StatusBadge({ status }: { status: string }) {
    const colors: Record<string, string> = {
        AGENDADO:
            'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
        'A DECORRER':
            'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
        FINALIZADO:
            'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400',
    }
    return (
        <span
            className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                colors[status] || colors.FINALIZADO
            }`}
        >
            {status}
        </span>
    )
}

function EditRow({
    game,
    form,
    setForm,
    onSave,
    onCancel,
    saving,
}: {
    game: AdminGame
    form: Record<string, unknown>
    setForm: (f: Record<string, unknown>) => void
    onSave: () => void
    onCancel: () => void
    saving: boolean
}) {
    return (
        <tr className="bg-dribly-purple/5 dark:bg-dribly-purple/10 border-b border-dribly-purple/20">
            <td className="px-4 py-2">
                <input
                    type="date"
                    value={(form.data as string) || game.data}
                    onChange={(e) =>
                        setForm({ ...form, data: e.target.value })
                    }
                    className="w-32 px-2 py-1 text-[11px] rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white"
                />
            </td>
            <td className="px-4 py-2 font-bold text-zinc-900 dark:text-white">
                {game.equipa_casa}
            </td>
            <td className="px-4 py-2">
                <div className="flex items-center gap-1 justify-center">
                    <input
                        type="number"
                        value={(form.resultado_casa as number) ?? ''}
                        onChange={(e) =>
                            setForm({
                                ...form,
                                resultado_casa: e.target.value
                                    ? parseInt(e.target.value)
                                    : null,
                            })
                        }
                        className="w-14 px-2 py-1 text-xs text-center rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white font-mono"
                    />
                    <span className="text-zinc-400">—</span>
                    <input
                        type="number"
                        value={(form.resultado_fora as number) ?? ''}
                        onChange={(e) =>
                            setForm({
                                ...form,
                                resultado_fora: e.target.value
                                    ? parseInt(e.target.value)
                                    : null,
                            })
                        }
                        className="w-14 px-2 py-1 text-xs text-center rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white font-mono"
                    />
                </div>
            </td>
            <td className="px-4 py-2 font-bold text-zinc-900 dark:text-white">
                {game.equipa_fora}
            </td>
            <td className="px-4 py-2">
                <select
                    value={(form.status as string) || game.status}
                    onChange={(e) =>
                        setForm({ ...form, status: e.target.value })
                    }
                    className="px-2 py-1 text-[11px] rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white"
                >
                    <option value="AGENDADO">AGENDADO</option>
                    <option value="A DECORRER">A DECORRER</option>
                    <option value="FINALIZADO">FINALIZADO</option>
                </select>
            </td>
            <td className="px-4 py-2">
                <input
                    type="text"
                    value={(form.local as string) || ''}
                    onChange={(e) =>
                        setForm({ ...form, local: e.target.value })
                    }
                    className="w-36 px-2 py-1 text-[11px] rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white"
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
