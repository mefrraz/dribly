import { useEffect, useState, useRef } from 'react'
import { Search, Save, X, MapPin, Navigation, Upload, Loader2 } from 'lucide-react'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import L from 'leaflet'
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
    morada_completa: string | null
    fpb_url: string | null
    image_url: string | null
    google_rating: number | null
    google_maps_url: string | null
    website: string | null
    phone: string | null
}

const BUCKET = 'pavilions'

export default function PavilionsAdmin() {
    const [pavilions, setPavilions] = useState<PavilionRow[]>([])
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(true)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [editForm, setEditForm] = useState<Partial<PavilionRow>>({})
    const [saving, setSaving] = useState(false)
    const [geocoding, setGeocoding] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [uploading, setUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null!)

    useEffect(() => {
        const load = async () => {
            try {
                // Fetch ALL pavilions (paginated — Supabase max 1000/request)
                const all: PavilionRow[] = []
                let from = 0
                const PAGE = 1000
                while (true) {
                    const { data } = await supabase.from('pavilions').select('*').order('nome').range(from, from + PAGE - 1)
                    if (!data || data.length === 0) break
                    all.push(...(data as PavilionRow[]))
                    if (data.length < PAGE) break
                    from += PAGE
                }
                setPavilions(all)
            } catch (e) {
                setError((e as Error).message)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    const filtered = pavilions.filter(p =>
        !search ||
        p.nome.toLowerCase().includes(search.toLowerCase()) ||
        (p.cidade || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.distrito || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.concelho || '').toLowerCase().includes(search.toLowerCase())
    )

    const startEdit = (p: PavilionRow) => { setEditingId(p.id); setEditForm({ ...p }) }
    const cancelEdit = () => { setEditingId(null); setEditForm({}) }

    // ── Geocode ──────────────────────────────────────
    const geocode = async () => {
        const parts = [
            editForm.rua,
            editForm.codigo_postal,
            editForm.cidade,
            editForm.distrito,
            'Portugal',
        ].filter(Boolean)
        if (parts.length < 2) { setError('Preenche rua + cidade ou código postal.'); return }
        setGeocoding(true)
        setError(null)
        try {
            const q = parts.join(', ')
            const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`)
            const json = await res.json()
            if (json[0]) {
                setEditForm(f => ({ ...f, lat: parseFloat(json[0].lat), lng: parseFloat(json[0].lon) }))
            } else {
                setError('Morada não encontrada.')
            }
        } catch { setError('Erro ao geocodificar.') }
        setGeocoding(false)
    }

    // ── Image upload ─────────────────────────────────
    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !editForm.recinto_id) return
        setUploading(true)
        setError(null)
        try {
            const ext = file.name.split('.').pop() || 'jpg'
            const name = `${editForm.recinto_id}_${Date.now()}.${ext}`
            const { data, error: upErr } = await supabase.storage.from(BUCKET).upload(name, file, {
                cacheControl: '31536000',
                upsert: false,
            })
            if (upErr) throw upErr
            const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path)
            setEditForm(f => ({ ...f, image_url: urlData.publicUrl }))
        } catch (err) { setError((err as Error).message) }
        setUploading(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    // ── Save ─────────────────────────────────────────
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
                morada_completa: editForm.morada_completa || null,
                fpb_url: editForm.fpb_url || null,
                image_url: editForm.image_url || null,
                google_rating: editForm.google_rating ?? null,
                google_maps_url: editForm.google_maps_url || null,
                website: editForm.website || null,
                phone: editForm.phone || null,
            })
            .eq('id', editingId)
        if (updateErr) { setError(updateErr.message) } else {
            setPavilions(prev => prev.map(p => p.id === editingId ? { ...p, ...editForm } : p))
            setEditingId(null)
        }
        setSaving(false)
    }

    const withCoords = pavilions.filter(p => p.lat && p.lng).length
    const withAddress = pavilions.filter(p => p.rua || p.morada_completa).length
    const withPhotos = pavilions.filter(p => p.image_url).length

    if (loading) return <p className="text-zinc-500 text-sm">A carregar pavilhões...</p>

    return (
        <div>
            {/* Header + stats */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div>
                    <h2 className="text-lg font-black text-zinc-900 dark:text-white">Pavilhões ({pavilions.length})</h2>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                        {withCoords} c/ coordenadas · {withAddress} c/ morada · {withPhotos} c/ foto
                    </p>
                </div>
                <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input type="text" placeholder="Pesquisar..." value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-8 pr-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white w-52 focus:outline-none focus:border-dribly-purple" />
                </div>
            </div>

            {error && (
                <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                    <span className="flex-1">{error}</span>
                    <button onClick={() => setError(null)}><X size={14} /></button>
                </div>
            )}

            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
                                <th className="text-left px-3 py-2.5 font-bold text-zinc-500 w-10">ID</th>
                                <th className="text-left px-3 py-2.5 font-bold text-zinc-500">Nome</th>
                                <th className="text-left px-3 py-2.5 font-bold text-zinc-500 hidden md:table-cell">Morada</th>
                                <th className="text-left px-3 py-2.5 font-bold text-zinc-500 hidden lg:table-cell">Cidade</th>
                                <th className="text-left px-3 py-2.5 font-bold text-zinc-500 hidden lg:table-cell">Distrito</th>
                                <th className="text-center px-3 py-2.5 font-bold text-zinc-500 w-12">📍</th>
                                <th className="text-center px-3 py-2.5 font-bold text-zinc-500 w-12">📷</th>
                                <th className="text-center px-3 py-2.5 font-bold text-zinc-500 w-12">★</th>
                                <th className="px-3 py-2.5 w-14"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(p => editingId === p.id ? (
                                <EditRow key={p.id} form={editForm} setForm={setEditForm}
                                    onSave={saveEdit} onCancel={cancelEdit} saving={saving}
                                    geocoding={geocoding} onGeocode={geocode}
                                    uploading={uploading} onUpload={handleUpload}
                                    fileInputRef={fileInputRef} />
                            ) : (
                                <tr key={p.id} className="border-b border-zinc-50 dark:border-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-950 transition-colors">
                                    <td className="px-3 py-2 text-zinc-400 font-mono">{p.id}</td>
                                    <td className="px-3 py-2 font-bold text-zinc-900 dark:text-white max-w-[200px] truncate">
                                        {p.nome}
                                    </td>
                                    <td className="px-3 py-2 text-zinc-500 truncate max-w-[180px] hidden md:table-cell">
                                        {p.rua || p.morada_completa || '—'}
                                    </td>
                                    <td className="px-3 py-2 text-zinc-500 hidden lg:table-cell">{p.cidade || '—'}</td>
                                    <td className="px-3 py-2 hidden lg:table-cell">
                                        {p.distrito ? <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-dribly-purple/10 text-dribly-purple">{p.distrito}</span> : '—'}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        {p.lat && p.lng ? <span className="text-green-500 font-bold">✓</span> : <span className="text-red-400">✗</span>}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        {p.image_url ? <span className="text-green-500 font-bold">✓</span> : '—'}
                                    </td>
                                    <td className="px-3 py-2 text-center text-zinc-500">
                                        {p.google_rating?.toFixed(1) || '—'}
                                    </td>
                                    <td className="px-3 py-2">
                                        <button onClick={() => startEdit(p)}
                                            className="text-xs font-bold text-dribly-purple hover:underline">Editar</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {filtered.length === 0 && <p className="text-center py-8 text-zinc-400 text-xs">Nenhum pavilhão.</p>}
            </div>
        </div>
    )
}

// ── Expanded edit row ─────────────────────────────────

function EditRow({ form, setForm, onSave, onCancel, saving, geocoding, onGeocode, uploading, onUpload, fileInputRef }: {
    form: Partial<PavilionRow>
    setForm: (f: Partial<PavilionRow>) => void
    onSave: () => void
    onCancel: () => void
    saving: boolean
    geocoding: boolean
    onGeocode: () => void
    uploading: boolean
    onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
    fileInputRef: React.RefObject<HTMLInputElement>
}) {
    const f = (key: keyof PavilionRow, placeholder: string, cls = '') => (
        <input type="text" value={(form[key] as string) || ''}
            onChange={e => setForm({ ...form, [key]: e.target.value || null })}
            placeholder={placeholder}
            className={`px-2 py-1 text-[11px] rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white ${cls}`} />
    )

    const hasCoords = form.lat != null && form.lng != null && !isNaN(form.lat) && !isNaN(form.lng)

    return (
        <tr className="bg-dribly-purple/5 dark:bg-dribly-purple/10">
            <td colSpan={9} className="px-4 py-3">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Left: form fields */}
                    <div className="space-y-2.5">
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-[10px] font-bold text-zinc-400 uppercase">Nome *</label>
                                {f('nome', 'Nome do pavilhão', 'w-full mt-0.5')}
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-zinc-400 uppercase">Cidade</label>
                                {f('cidade', 'Cidade', 'w-full mt-0.5')}
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-zinc-400 uppercase">Rua / Morada</label>
                            {f('rua', 'Rua', 'w-full mt-0.5')}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <div>
                                <label className="text-[10px] font-bold text-zinc-400 uppercase">C. Postal</label>
                                {f('codigo_postal', 'Cód. Postal', 'w-full mt-0.5')}
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-zinc-400 uppercase">Distrito</label>
                                {f('distrito', 'Distrito', 'w-full mt-0.5')}
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-zinc-400 uppercase">Concelho</label>
                                {f('concelho', 'Concelho', 'w-full mt-0.5')}
                            </div>
                        </div>
                        <div className="flex items-end gap-2">
                            <div className="flex-1">
                                <label className="text-[10px] font-bold text-zinc-400 uppercase">Lat / Lng</label>
                                <div className="flex gap-1 mt-0.5">
                                    <input type="number" step="any" value={form.lat ?? ''}
                                        onChange={e => setForm({ ...form, lat: e.target.value ? parseFloat(e.target.value) : null })}
                                        placeholder="lat" className="w-1/2 px-2 py-1 text-[11px] rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white" />
                                    <input type="number" step="any" value={form.lng ?? ''}
                                        onChange={e => setForm({ ...form, lng: e.target.value ? parseFloat(e.target.value) : null })}
                                        placeholder="lng" className="w-1/2 px-2 py-1 text-[11px] rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white" />
                                </div>
                            </div>
                            <button onClick={onGeocode} disabled={geocoding}
                                className="px-2.5 py-1.5 rounded-lg bg-dribly-purple text-white text-[10px] font-bold hover:bg-dribly-purple/90 transition-colors disabled:opacity-50 flex items-center gap-1 shrink-0">
                                {geocoding ? <Loader2 size={12} className="animate-spin" /> : <Navigation size={12} />}
                                Geo
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-[10px] font-bold text-zinc-400 uppercase">Rating Google</label>
                                <input type="number" step="0.1" value={form.google_rating ?? ''}
                                    onChange={e => setForm({ ...form, google_rating: e.target.value ? parseFloat(e.target.value) : null })}
                                    placeholder="4.5" className="w-full mt-0.5 px-2 py-1 text-[11px] rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-zinc-400 uppercase">URL FPB</label>
                                {f('fpb_url', 'https://www.fpb.pt/...', 'w-full mt-0.5')}
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-zinc-400 uppercase">Foto</label>
                            <div className="flex items-center gap-2 mt-0.5">
                                {f('image_url', 'URL ou upload abaixo', 'flex-1')}
                                <input ref={fileInputRef} type="file" accept="image/*" onChange={onUpload}
                                    className="hidden" id="pav-upload" />
                                <label htmlFor="pav-upload"
                                    className="px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer flex items-center gap-1">
                                    {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                                    Upload
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Right: mini-map preview */}
                    <div>
                        {hasCoords ? (
                            <div>
                                <label className="text-[10px] font-bold text-zinc-400 uppercase mb-1 block">Pré-visualização</label>
                                <div className="h-48 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700">
                                    <MapContainer center={[form.lat!, form.lng!]} zoom={16}
                                        zoomControl={false} dragging={false} scrollWheelZoom={false}
                                        doubleClickZoom={false} attributionControl={false}
                                        className="w-full h-full">
                                        <TileLayer url="https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png" />
                                        <Marker position={[form.lat!, form.lng!]}
                                            icon={L.divIcon({
                                                html: '<div style="width:16px;height:16px;background:#7C3AED;border:2px solid white;border-radius:50%;box-shadow:0 0 6px rgba(124,58,237,0.5)"></div>',
                                                className: '', iconSize: [16, 16], iconAnchor: [8, 8],
                                            })} />
                                    </MapContainer>
                                </div>
                            </div>
                        ) : (
                            <div className="h-48 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 flex items-center justify-center text-zinc-400 text-[11px]">
                                <div className="text-center">
                                    <MapPin size={24} className="mx-auto mb-1 opacity-30" />
                                    Preenche coordenadas ou usa o botão Geo
                                </div>
                            </div>
                        )}
                        {/* Save / Cancel */}
                        <div className="flex items-center gap-2 mt-3 justify-end">
                            <button onClick={onCancel}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors">
                                Cancelar
                            </button>
                            <button onClick={onSave} disabled={saving || !form.nome}
                                className="px-4 py-1.5 rounded-lg bg-dribly-purple text-white text-xs font-bold hover:bg-dribly-purple/90 transition-colors disabled:opacity-50 flex items-center gap-1.5">
                                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                                Guardar
                            </button>
                        </div>
                    </div>
                </div>
            </td>
        </tr>
    )
}