import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function NotificationsAdmin() {
    const [title, setTitle] = useState('Dribly')
    const [body, setBody] = useState('')
    const [url, setUrl] = useState('https://dribly.pt')
    const [sending, setSending] = useState(false)
    const [result, setResult] = useState<string | null>(null)
    const [subCount, setSubCount] = useState<number | null>(null)

    useEffect(() => {
        supabase.from('push_subscriptions').select('id', { count: 'exact', head: true }).then(({ count }: { count: number | null }) => setSubCount(count))
    }, [])

    const send = async () => {
        setSending(true)
        setResult(null)
        try {
            const res = await fetch('/api/send-notifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, body, url }),
            })
            const data = await res.json()
            setResult(res.ok ? `Enviado! (${JSON.stringify(data)})` : `Erro: ${data.error || data}`)
        } catch (err) {
            setResult(`Erro: ${String(err)}`)
        }
        setSending(false)
    }

    return (
        <div className="max-w-xl mx-auto px-4 py-8">
            <h1 className="text-lg font-bold text-zinc-900 dark:text-white mb-6">📢 Enviar notificação push</h1>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl p-5 space-y-4">
                <p className="text-sm text-zinc-500">
                    {subCount !== null ? `${subCount} dispositivos subscritos` : 'A carregar...'}
                </p>

                <div>
                    <label className="text-xs font-bold text-zinc-500 block mb-1">Título</label>
                    <input value={title} onChange={e => setTitle(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm" />
                </div>

                <div>
                    <label className="text-xs font-bold text-zinc-500 block mb-1">Mensagem</label>
                    <textarea value={body} onChange={e => setBody(e.target.value)} rows={3}
                        className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm resize-none" />
                </div>

                <div>
                    <label className="text-xs font-bold text-zinc-500 block mb-1">URL (ao clicar)</label>
                    <input value={url} onChange={e => setUrl(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm" />
                </div>

                <button onClick={send} disabled={sending || !body.trim()}
                    className="w-full py-2.5 bg-dribly-purple text-white text-sm font-bold rounded-xl hover:bg-dribly-purple/90 disabled:opacity-50 transition-colors">
                    {sending ? 'A enviar...' : 'Enviar para todos'}
                </button>

                {result && (
                    <p className="text-xs text-zinc-500 bg-zinc-50 dark:bg-zinc-800 p-3 rounded-lg font-mono">{result}</p>
                )}
            </div>
        </div>
    )
}
