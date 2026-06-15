import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Bell, Send, RotateCcw } from 'lucide-react'

interface Template { id: string; title: string; body: string; updated_at?: string }

const DEFAULTS: Record<string, Template> = {
    game_starting: { id: 'game_starting', title: '🏀 {equipa_casa} vs {equipa_fora}', body: 'Começa às {hora} — {competicao}' },
    game_win: { id: 'game_win', title: '✅ Vitória!', body: '{equipa_casa} {resultado_casa} - {resultado_fora} {equipa_fora}' },
    game_loss: { id: 'game_loss', title: '❌ Derrota', body: '{equipa_casa} {resultado_casa} - {resultado_fora} {equipa_fora}' },
    game_draw: { id: 'game_draw', title: '🤝 Empate', body: '{equipa_casa} {resultado_casa} - {resultado_fora} {equipa_fora}' },
    game_result: { id: 'game_result', title: '📊 Resultado', body: '{equipa_casa} {resultado_casa} - {resultado_fora} {equipa_fora}' },
}

const LABELS: Record<string, string> = {
    game_starting: 'Jogo a começar',
    game_win: 'Vitória do teu clube',
    game_loss: 'Derrota do teu clube',
    game_draw: 'Empate do teu clube',
    game_result: 'Resultado (segues os 2 ou neutro)',
}

const PREVIEW_VARS: Record<string, string> = {
    '{equipa_casa}': 'FC Porto',
    '{equipa_fora}': 'SL Benfica',
    '{resultado_casa}': '78',
    '{resultado_fora}': '65',
    '{competicao}': 'Liga Betclic',
    '{hora}': '21H30',
    '{escalao}': 'Seniores Masculinos',
}

export default function NotificationsAdmin() {
    const [templates, setTemplates] = useState<Record<string, Template>>({ ...DEFAULTS })
    const [editing, setEditing] = useState<string | null>(null)
    const [editTitle, setEditTitle] = useState('')
    const [editBody, setEditBody] = useState('')
    const [saved, setSaved] = useState(false)

    const [broadcastTitle, setBroadcastTitle] = useState('Dribly')
    const [broadcastBody, setBroadcastBody] = useState('')
    const [broadcastUrl, setBroadcastUrl] = useState('https://dribly.pt')
    const [sending, setSending] = useState(false)
    const [result, setResult] = useState<string | null>(null)
    const [subCount, setSubCount] = useState<number | null>(null)

    useEffect(() => {
        supabase.from('push_subscriptions').select('id', { count: 'exact', head: true })
            .then(({ count }: { count: number | null }) => setSubCount(count))
        supabase.from('notification_templates').select('id, title, body')
            .then(({ data }: { data: Template[] | null }) => {
                if (data && data.length > 0) {
                    const map = { ...DEFAULTS }
                    for (const t of data) map[t.id] = t
                    setTemplates(map)
                }
            })
    }, [])

    const startEdit = (id: string) => {
        setEditing(id)
        setEditTitle(templates[id].title)
        setEditBody(templates[id].body)
        setSaved(false)
    }

    const saveTemplate = async (id: string) => {
        const { error } = await supabase.from('notification_templates').upsert({
            id, title: editTitle, body: editBody,
            updated_at: new Date().toISOString(),
        })
        if (!error) {
            setTemplates(prev => ({ ...prev, [id]: { id, title: editTitle, body: editBody } }))
            setEditing(null)
            setSaved(true)
            setTimeout(() => setSaved(false), 2000)
        }
    }

    const resetTemplate = async (id: string) => {
        await supabase.from('notification_templates').delete().eq('id', id)
        setTemplates(prev => ({ ...prev, [id]: DEFAULTS[id] }))
    }

    const preview = (text: string) => {
        let result = text
        for (const [k, v] of Object.entries(PREVIEW_VARS)) {
            result = result.replace(new RegExp(k.replace(/[{}]/g, '\\$&'), 'g'), v)
        }
        return result
    }

    const sendBroadcast = async () => {
        setSending(true)
        setResult(null)
        try {
            const res = await fetch('/api/send-notifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: broadcastTitle, body: broadcastBody, url: broadcastUrl }),
            })
            const data = await res.json()
            setResult(res.ok ? `Enviadas: ${data.sent} (${data.errors} erros)` : `Erro: ${data.error}`)
        } catch (err) {
            setResult(`Erro: ${String(err)}`)
        }
        setSending(false)
    }

    return (
        <div className="space-y-6">
            <h1 className="text-lg font-bold text-zinc-900 dark:text-white">📢 Notificações push</h1>

            {/* Broadcast */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                    <Send size={16} className="text-dribly-purple" />
                    <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Envio manual</h2>
                    <span className="text-xs text-zinc-400 ml-auto">{subCount ?? '...'} dispositivos</span>
                </div>
                <input value={broadcastTitle} onChange={e => setBroadcastTitle(e.target.value)}
                    placeholder="Título" className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm" />
                <textarea value={broadcastBody} onChange={e => setBroadcastBody(e.target.value)} rows={2}
                    placeholder="Mensagem" className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm resize-none" />
                <div className="flex items-center gap-2">
                    <input value={broadcastUrl} onChange={e => setBroadcastUrl(e.target.value)}
                        className="flex-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm" />
                    <button onClick={sendBroadcast} disabled={sending || !broadcastBody.trim()}
                        className="px-4 py-2 bg-dribly-purple text-white text-sm font-bold rounded-xl hover:bg-dribly-purple/90 disabled:opacity-50 transition-colors">
                        {sending ? '...' : 'Enviar'}
                    </button>
                </div>
                {result && <p className="text-xs text-zinc-500 bg-zinc-50 dark:bg-zinc-800 p-3 rounded-lg font-mono">{result}</p>}
            </div>

            {/* Templates */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                    <Bell size={16} className="text-dribly-purple" />
                    <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Templates automáticos</h2>
                    {saved && <span className="text-xs text-green-500 ml-auto">Guardado!</span>}
                </div>

                <p className="text-xs text-zinc-400">
                    Variáveis: <code className="text-dribly-purple">{'{equipa_casa}'}</code> <code className="text-dribly-purple">{'{equipa_fora}'}</code> <code className="text-dribly-purple">{'{resultado_casa}'}</code> <code className="text-dribly-purple">{'{resultado_fora}'}</code> <code className="text-dribly-purple">{'{competicao}'}</code> <code className="text-dribly-purple">{'{hora}'}</code>
                </p>

                {Object.entries(templates).map(([id, t]) => (
                    <div key={id} className="border border-zinc-100 dark:border-zinc-800 rounded-xl p-3 space-y-2">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-zinc-500">{LABELS[id]}</span>
                            <button onClick={() => startEdit(id)} className="text-xs text-dribly-purple hover:underline ml-auto">editar</button>
                            <button onClick={() => resetTemplate(id)} className="text-xs text-zinc-400 hover:text-red-500" title="Restaurar default">
                                <RotateCcw size={12} />
                            </button>
                        </div>
                        {editing === id ? (
                            <div className="space-y-2">
                                <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                                    className="w-full px-2 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg" />
                                <textarea value={editBody} onChange={e => setEditBody(e.target.value)} rows={2}
                                    className="w-full px-2 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg resize-none" />
                                <div className="flex gap-2">
                                    <button onClick={() => saveTemplate(id)} className="px-3 py-1 text-xs font-bold bg-dribly-purple text-white rounded-lg">Guardar</button>
                                    <button onClick={() => setEditing(null)} className="px-3 py-1 text-xs text-zinc-500">Cancelar</button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-xs text-zinc-600 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800 rounded-lg p-2 space-y-1">
                                <p><span className="text-zinc-400">Título:</span> {preview(t.title)}</p>
                                <p><span className="text-zinc-400">Corpo:</span> {preview(t.body)}</p>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}
