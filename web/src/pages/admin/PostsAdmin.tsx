import { useState, useEffect, useRef, useCallback } from 'react'
import { Plus, Upload, Trash2, Download, Eye, X, Image, Save, Move, Search } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAdminApi, type AdminPostTemplate, type AdminGame } from '../../lib/adminApi'

// ── Types ──────────────────────────────────────────────

interface FieldDef {
    id: string
    label: string
    x: number  // percentage 0-100
    y: number
    w: number
    h: number
    fontSize: number
    color: string
    italic: boolean
    outline: boolean
    kind: 'text' | 'logo'
}

type Tab = 'templates' | 'editor' | 'generate'

const FIELD_DEFAULTS: Record<string, Partial<FieldDef>> = {
    equipa_casa: { label: 'Equipa Casa', fontSize: 40, color: '#FFFFFF', italic: false, outline: false, kind: 'text', w: 35, h: 8 },
    equipa_fora: { label: 'Equipa Fora', fontSize: 40, color: '#FFFFFF', italic: false, outline: false, kind: 'text', w: 35, h: 8 },
    resultado_casa: { label: 'Placar Casa', fontSize: 120, color: '#7C3AED', italic: true, outline: false, kind: 'text', w: 15, h: 14 },
    resultado_fora: { label: 'Placar Fora', fontSize: 120, color: '#7C3AED', italic: true, outline: true, kind: 'text', w: 15, h: 14 },
    data: { label: 'Data', fontSize: 24, color: '#9CA3AF', italic: false, outline: false, kind: 'text', w: 30, h: 5 },
    hora: { label: 'Hora', fontSize: 80, color: '#7C3AED', italic: true, outline: false, kind: 'text', w: 20, h: 12 },
    local: { label: 'Local', fontSize: 22, color: '#9CA3AF', italic: false, outline: false, kind: 'text', w: 30, h: 5 },
    escalao: { label: 'Escalão', fontSize: 32, color: '#FFFFFF', italic: false, outline: false, kind: 'text', w: 20, h: 6 },
    competicao: { label: 'Competição', fontSize: 24, color: '#9CA3AF', italic: false, outline: false, kind: 'text', w: 25, h: 5 },
    logo_casa: { label: 'Logo Casa', fontSize: 0, color: '', italic: false, outline: false, kind: 'logo', w: 28, h: 28 },
    logo_fora: { label: 'Logo Fora', fontSize: 0, color: '', italic: false, outline: false, kind: 'logo', w: 28, h: 28 },
}

// ── Component ───────────────────────────────────────────

export default function PostsAdmin() {
    const api = useAdminApi()
    const [tab, setTab] = useState<Tab>('templates')
    const [templates, setTemplates] = useState<AdminPostTemplate[]>([])
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Editor state
    const [editingTemplate, setEditingTemplate] = useState<AdminPostTemplate | null>(null)
    const [fields, setFields] = useState<FieldDef[]>([])
    const [dragging, setDragging] = useState<string | null>(null)
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
    const [selectedField, setSelectedField] = useState<string | null>(null)
    const [uploading, setUploading] = useState(false)
    const editorRef = useRef<HTMLDivElement>(null)

    // Generate state
    const [selectedTemplate, setSelectedTemplate] = useState<AdminPostTemplate | null>(null)
    const [gameQuery, setGameQuery] = useState('')
    const [games, setGames] = useState<AdminGame[]>([])
    const [selectedGames, setSelectedGames] = useState<AdminGame[]>([])
    const [searching, setSearching] = useState(false)
    const [generating, setGenerating] = useState(false)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)

    // ── Load templates ──────────────────────────────────

    const loadTemplates = useCallback(async () => {
        setLoading(true)
        try {
            const { templates: tpls } = await api.listPostTemplates()
            setTemplates(tpls)
        } catch (e) {
            setMessage('Erro: ' + (e as Error).message)
        }
        setLoading(false)
    }, [api])

    useEffect(() => { loadTemplates() }, [loadTemplates])

    // ── Upload new template ─────────────────────────────

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploading(true)
        setMessage(null)

        try {
            const ext = file.name.split('.').pop() || 'png'
            const fileName = `${Date.now()}.${ext}`
            const { error } = await supabase.storage
                .from('post_templates')
                .upload(fileName, file, { contentType: file.type, upsert: false })

            if (error) throw new Error(error.message)

            const { data: urlData } = supabase.storage
                .from('post_templates')
                .getPublicUrl(fileName)

            const bgUrl = urlData.publicUrl

            // Determine type from filename or default
            const type = file.name.toLowerCase().includes('gameday') ? 'gameday' :
                         file.name.toLowerCase().includes('agenda') ? 'agenda_hero' :
                         file.name.toLowerCase().includes('resultado') ? 'resultado_hero' :
                         'custom'

            const name = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')

            // Create default fields based on type
            const defaultFields: Record<string, FieldDef> = {}
            const fieldIds = type === 'gameday' ?
                ['equipa_casa', 'equipa_fora', 'data', 'hora', 'local', 'escalao', 'logo_casa', 'logo_fora'] :
                type === 'agenda_hero' ?
                ['equipa_casa', 'equipa_fora', 'hora', 'data', 'local', 'escalao', 'logo_casa', 'logo_fora'] :
                ['equipa_casa', 'equipa_fora', 'resultado_casa', 'resultado_fora', 'data', 'escalao', 'logo_casa', 'logo_fora']

            fieldIds.forEach((fid, i) => {
                const def = FIELD_DEFAULTS[fid] || {}
                // Stagger positions so they don't all overlap
                const row = Math.floor(i / 2)
                const col = i % 2
                defaultFields[fid] = {
                    id: fid,
                    label: def.label || fid,
                    x: col === 0 ? 10 : 55,
                    y: 10 + row * 12,
                    w: def.w || 30,
                    h: def.h || 8,
                    fontSize: def.fontSize || 30,
                    color: def.color || '#FFFFFF',
                    italic: def.italic || false,
                    outline: def.outline || false,
                    kind: def.kind || 'text',
                }
            })

            const { template: created } = await api.upsertPostTemplate({
                name,
                type,
                background_url: bgUrl,
                fields: defaultFields,
            })

            setTemplates(prev => [created, ...prev])
            setMessage(`Template "${name}" criado.`)
            if (fileInputRef.current) fileInputRef.current.value = ''
        } catch (e) {
            setMessage('Erro no upload: ' + (e as Error).message)
        }
        setUploading(false)
    }

    // ── Delete template ─────────────────────────────────

    const deleteTemplate = async (id: number, name: string) => {
        if (!confirm(`Apagar template "${name}"?`)) return
        try {
            await api.deletePostTemplate(id)
            setTemplates(prev => prev.filter(t => t.id !== id))
            if (editingTemplate?.id === id) {
                setEditingTemplate(null)
                setFields([])
                setTab('templates')
            }
            setMessage(`Template "${name}" apagado.`)
        } catch (e) {
            setMessage('Erro: ' + (e as Error).message)
        }
    }

    // ── Open editor ─────────────────────────────────────

    const openEditor = (template: AdminPostTemplate) => {
        setEditingTemplate(template)
        const raw = template.fields as Record<string, Record<string, unknown>>
        const parsed: FieldDef[] = Object.entries(raw).map(([id, f]) => ({
            id,
            label: (f.label as string) || id,
            x: (f.x as number) || 10,
            y: (f.y as number) || 10,
            w: (f.w as number) || 20,
            h: (f.h as number) || 8,
            fontSize: (f.fontSize as number) || 30,
            color: (f.color as string) || '#FFFFFF',
            italic: (f.italic as boolean) || false,
            outline: (f.outline as boolean) || false,
            kind: (f.kind as FieldDef['kind']) || 'text',
        }))
        setFields(parsed)
        setSelectedField(null)
        setTab('editor')
    }

    const addField = () => {
        const newId = `field_${Date.now()}`
        setFields(prev => [...prev, {
            id: newId,
            label: 'Novo Campo',
            x: 50, y: 50, w: 20, h: 6,
            fontSize: 30, color: '#FFFFFF',
            italic: false, outline: false, kind: 'text',
        }])
        setSelectedField(newId)
    }

    const removeField = (id: string) => {
        setFields(prev => prev.filter(f => f.id !== id))
        if (selectedField === id) setSelectedField(null)
    }

    const updateField = (id: string, updates: Partial<FieldDef>) => {
        setFields(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f))
    }

    // ── Drag handling ───────────────────────────────────

    const startDrag = (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        const field = fields.find(f => f.id === id)
        if (!field || !editorRef.current) return
        const rect = editorRef.current.getBoundingClientRect()
        const clientX = e.clientX - rect.left
        const clientY = e.clientY - rect.top
        const pctX = (clientX / rect.width) * 100
        const pctY = (clientY / rect.height) * 100
        setDragging(id)
        setDragOffset({ x: pctX - field.x, y: pctY - field.y })
        setSelectedField(id)
    }

    const onDrag = (e: React.MouseEvent) => {
        if (!dragging || !editorRef.current) return
        const rect = editorRef.current.getBoundingClientRect()
        const pctX = ((e.clientX - rect.left) / rect.width) * 100
        const pctY = ((e.clientY - rect.top) / rect.height) * 100
        updateField(dragging, {
            x: Math.max(0, Math.min(100, pctX - dragOffset.x)),
            y: Math.max(0, Math.min(100, pctY - dragOffset.y)),
        })
    }

    const endDrag = () => setDragging(null)

    // ── Save template ───────────────────────────────────

    const saveTemplate = async () => {
        if (!editingTemplate) return
        setUploading(true)
        setMessage(null)
        try {
            const fieldsObj: Record<string, unknown> = {}
            fields.forEach(f => {
                fieldsObj[f.id] = {
                    label: f.label, x: f.x, y: f.y, w: f.w, h: f.h,
                    fontSize: f.fontSize, color: f.color,
                    italic: f.italic, outline: f.outline, kind: f.kind,
                }
            })
            await api.upsertPostTemplate({
                id: editingTemplate.id,
                name: editingTemplate.name,
                type: editingTemplate.type,
                background_url: editingTemplate.background_url,
                fields: fieldsObj,
            })
            setMessage('Template guardado!')
            loadTemplates()
        } catch (e) {
            setMessage('Erro: ' + (e as Error).message)
        }
        setUploading(false)
    }

    // ── Search games ────────────────────────────────────

    const searchGames = async () => {
        if (!gameQuery.trim()) return
        setSearching(true)
        const term = `%${gameQuery.trim()}%`
        const { data, error } = await supabase
            .from('games_2025_2026')
            .select('*')
            .or(`equipa_casa.ilike.${term},equipa_fora.ilike.${term},competicao.ilike.${term}`)
            .order('data', { ascending: false })
            .limit(50)

        if (error) {
            setMessage('Erro na pesquisa: ' + error.message)
            setGames([])
        } else {
            setGames((data as AdminGame[]) || [])
        }
        setSearching(false)
    }

    const toggleGame = (game: AdminGame) => {
        setSelectedGames(prev =>
            prev.find(g => g.slug === game.slug)
                ? prev.filter(g => g.slug !== game.slug)
                : [...prev, game]
        )
    }

    // ── Render post to canvas ───────────────────────────

    const renderPost = useCallback(async (template: AdminPostTemplate, game: AdminGame): Promise<HTMLCanvasElement> => {
        const canvas = document.createElement('canvas')
        canvas.width = 1080
        canvas.height = 1080
        const ctx = canvas.getContext('2d')!
        const fieldsObj = template.fields as Record<string, Record<string, unknown>>

        // Draw background
        const bgImg = new window.Image()
        bgImg.crossOrigin = 'anonymous'
        await new Promise<void>((resolve, reject) => {
            bgImg.onload = () => resolve()
            bgImg.onerror = () => reject(new Error('Failed to load background'))
            bgImg.src = template.background_url
        })
        ctx.drawImage(bgImg, 0, 0, 1080, 1080)

        // Load team logos
        const logoCache: Record<string, HTMLImageElement | null> = {}
        const loadLogo = async (url: string | null | undefined): Promise<HTMLImageElement | null> => {
            if (!url) return null
            if (logoCache[url] !== undefined) return logoCache[url]
            const img = new window.Image()
            img.crossOrigin = 'anonymous'
            await new Promise<void>((resolve) => {
                img.onload = () => resolve()
                img.onerror = () => resolve()
                img.src = url
            })
            logoCache[url] = img.complete && img.naturalWidth > 0 ? img : null
            return logoCache[url]
        }

        const logoCasa = await loadLogo(game.logotipo_casa)
        const logoFora = await loadLogo(game.logotipo_fora)

        // Draw each field
        for (const [id, f] of Object.entries(fieldsObj)) {
            const fx = ((f.x as number) / 100) * 1080
            const fy = ((f.y as number) / 100) * 1080
            const fw = ((f.w as number) / 100) * 1080
            const fh = ((f.h as number) / 100) * 1080
            const kind = (f.kind as string) || 'text'

            if (kind === 'logo') {
                const logo = id === 'logo_casa' ? logoCasa : id === 'logo_fora' ? logoFora : null
                if (logo) {
                    // Scale logo to fit the bounding box while maintaining aspect ratio
                    const scale = Math.min(fw / logo.naturalWidth, fh / logo.naturalHeight)
                    const lw = logo.naturalWidth * scale
                    const lh = logo.naturalHeight * scale
                    const lx = fx + (fw - lw) / 2
                    const ly = fy + (fh - lh) / 2
                    ctx.save()
                    // Rounded rect clip for logos
                    ctx.beginPath()
                    const r = 16
                    ctx.moveTo(lx + r, ly)
                    ctx.lineTo(lx + lw - r, ly)
                    ctx.arcTo(lx + lw, ly, lx + lw, ly + r, r)
                    ctx.lineTo(lx + lw, ly + lh - r)
                    ctx.arcTo(lx + lw, ly + lh, lx + lw - r, ly + lh, r)
                    ctx.lineTo(lx + r, ly + lh)
                    ctx.arcTo(lx, ly + lh, lx, ly + lh - r, r)
                    ctx.lineTo(lx, ly + r)
                    ctx.arcTo(lx, ly, lx + r, ly, r)
                    ctx.clip()
                    ctx.drawImage(logo, lx, ly, lw, lh)
                    ctx.restore()
                }
                continue
            }

            // Text field — resolve value
            let value = ''
            switch (id) {
                case 'equipa_casa': value = game.equipa_casa; break
                case 'equipa_fora': value = game.equipa_fora; break
                case 'resultado_casa': value = game.resultado_casa != null ? String(game.resultado_casa) : ''; break
                case 'resultado_fora': value = game.resultado_fora != null ? String(game.resultado_fora) : ''; break
                case 'data': value = game.data || ''; break
                case 'hora': value = game.hora || ''; break
                case 'local': value = game.local || ''; break
                case 'escalao': value = game.escalao || ''; break
                case 'competicao': value = game.competicao || ''; break
                default: value = ''; break
            }

            if (!value) continue

            const fontSize = (f.fontSize as number) || 30
            const color = (f.color as string) || '#FFFFFF'
            const italic = f.italic as boolean
            const outline = f.outline as boolean

            ctx.save()
            const fontStyle = `900 ${fontSize}px Montserrat, Outfit, sans-serif`
            ctx.font = fontStyle
            ctx.textBaseline = 'top'
            ctx.textAlign = 'left'

            // Measure and scale to fit
            let actualSize = fontSize
            let metrics = ctx.measureText(value)
            while (metrics.width > fw * 0.95 && actualSize > 8) {
                actualSize--
                ctx.font = `900 ${actualSize}px Montserrat, Outfit, sans-serif`
                metrics = ctx.measureText(value)
            }
            if (italic) {
                ctx.font = `italic 900 ${actualSize}px Montserrat, Outfit, sans-serif`
            }

            if (outline) {
                ctx.strokeStyle = color
                ctx.lineWidth = Math.max(2, actualSize / 15)
                ctx.lineJoin = 'round'
                ctx.strokeText(value, fx, fy)
            } else {
                ctx.fillStyle = color
                // Shadow for readability
                ctx.shadowColor = 'rgba(0,0,0,0.7)'
                ctx.shadowBlur = 4
                ctx.shadowOffsetX = 2
                ctx.shadowOffsetY = 2
                ctx.fillText(value, fx, fy)
            }

            ctx.restore()
        }

        // Dribly watermark
        ctx.save()
        ctx.fillStyle = 'rgba(255,255,255,0.15)'
        ctx.font = '600 16px Montserrat, Outfit, sans-serif'
        ctx.textAlign = 'right'
        ctx.textBaseline = 'bottom'
        ctx.fillText('DRIBLY', 1060, 1060)
        ctx.restore()

        return canvas
    }, [])

    // ── Generate preview ────────────────────────────────

    const generatePreview = async () => {
        if (!selectedTemplate || selectedGames.length === 0) {
            setMessage('Seleciona um template e pelo menos um jogo.')
            return
        }
        setGenerating(true)
        setMessage(null)
        try {
            // Preview first game
            const canvas = await renderPost(selectedTemplate, selectedGames[0])
            setPreviewUrl(canvas.toDataURL('image/png'))
        } catch (e) {
            setMessage('Erro ao gerar: ' + (e as Error).message)
        }
        setGenerating(false)
    }

    // ── Download single ─────────────────────────────────

    const downloadSingle = async () => {
        if (!selectedTemplate || selectedGames.length === 0) return
        try {
            const canvas = await renderPost(selectedTemplate, selectedGames[0])
            const link = document.createElement('a')
            link.download = `dribly_${selectedGames[0].slug}.png`
            link.href = canvas.toDataURL('image/png')
            link.click()
        } catch (e) {
            setMessage('Erro: ' + (e as Error).message)
        }
    }

    // ── Download all as individual files ────────────────

    const downloadAll = async () => {
        if (!selectedTemplate || selectedGames.length === 0) return
        setGenerating(true)
        try {
            for (const game of selectedGames) {
                const canvas = await renderPost(selectedTemplate, game)
                const link = document.createElement('a')
                link.download = `dribly_${selectedTemplate.type}_${game.slug}.png`
                link.href = canvas.toDataURL('image/png')
                link.click()
                // Small delay between downloads
                await new Promise(r => setTimeout(r, 200))
            }
            setMessage(`${selectedGames.length} posts descarregados.`)
        } catch (e) {
            setMessage('Erro: ' + (e as Error).message)
        }
        setGenerating(false)
    }

    // ── Render ───────────────────────────────────────────

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Posts Redes Sociais</h1>
                    <p className="text-sm text-zinc-500 mt-1">Templates e geração de posts para Instagram/Facebook</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => { setTab('templates'); setEditingTemplate(null); setFields([]); }}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${tab === 'templates' ? 'bg-dribly-purple text-white' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/5'}`}
                    >
                        Templates
                    </button>
                    <button
                        onClick={() => { setTab('generate'); setPreviewUrl(null); }}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${tab === 'generate' ? 'bg-dribly-purple text-white' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/5'}`}
                    >
                        Gerar Posts
                    </button>
                </div>
            </div>

            {message && (
                <div className={`p-3 rounded-lg text-sm font-medium ${message.startsWith('Erro') ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400' : 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400'}`}>
                    {message}
                </div>
            )}

            {/* ── Tab: Templates ────────────────────────── */}
            {tab === 'templates' && (
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={handleFileUpload}
                            className="hidden"
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className="flex items-center gap-2 px-4 py-2.5 bg-dribly-purple text-white rounded-lg text-sm font-bold hover:bg-dribly-purple-dim transition-colors disabled:opacity-50"
                        >
                            {uploading ? <span className="animate-spin">⟳</span> : <Upload size={16} />}
                            Novo Template (PNG)
                        </button>
                        <span className="text-xs text-zinc-400">Faz upload do teu PNG com o design de fundo</span>
                    </div>

                    {loading ? (
                        <div className="text-center py-12 text-zinc-400">A carregar...</div>
                    ) : templates.length === 0 ? (
                        <div className="text-center py-12 bg-zinc-50 dark:bg-white/5 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700">
                            <Image size={40} className="mx-auto mb-3 text-zinc-300" />
                            <p className="text-zinc-500 font-medium">Nenhum template ainda</p>
                            <p className="text-xs text-zinc-400 mt-1">Faz upload de um PNG com o teu design</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {templates.map(t => (
                                <div key={t.id} className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden hover:border-dribly-purple transition-colors">
                                    <div className="aspect-square bg-zinc-100 dark:bg-zinc-900 relative">
                                        <img
                                            src={t.background_url}
                                            alt={t.name}
                                            className="w-full h-full object-cover"
                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                                        />
                                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold bg-black/60 text-white uppercase">
                                            {t.type.replace(/_/g, ' ')}
                                        </span>
                                    </div>
                                    <div className="p-3 flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-bold text-zinc-900 dark:text-white capitalize">{t.name}</p>
                                            <p className="text-[10px] text-zinc-400">{Object.keys(t.fields as object).length} campos</p>
                                        </div>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => openEditor(t)}
                                                className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-500 hover:text-dribly-purple transition-colors"
                                                title="Editar coordenadas"
                                            >
                                                <Move size={14} />
                                            </button>
                                            <button
                                                onClick={() => deleteTemplate(t.id, t.name)}
                                                className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 text-zinc-500 hover:text-red-600 transition-colors"
                                                title="Apagar"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── Tab: Editor ───────────────────────────── */}
            {tab === 'editor' && editingTemplate && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-bold text-zinc-900 dark:text-white capitalize">{editingTemplate.name}</h2>
                            <p className="text-xs text-zinc-400">Arrasta os campos para as posições corretas. Usa o preview como referência.</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={addField} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors">
                                <Plus size={12} /> Campo
                            </button>
                            <button onClick={saveTemplate} disabled={uploading} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-dribly-purple text-white hover:bg-dribly-purple-dim transition-colors disabled:opacity-50">
                                <Save size={12} /> {uploading ? 'Guardando...' : 'Guardar'}
                            </button>
                            <button onClick={() => { setTab('templates'); setEditingTemplate(null); }} className="px-3 py-1.5 rounded-lg text-xs font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors">
                                <X size={12} />
                            </button>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        {/* Editor area */}
                        <div className="flex-1">
                            <div
                                ref={editorRef}
                                className="relative w-full aspect-square bg-zinc-900 rounded-xl overflow-hidden cursor-crosshair select-none"
                                onMouseMove={onDrag}
                                onMouseUp={endDrag}
                                onMouseLeave={endDrag}
                            >
                                <img
                                    src={editingTemplate.background_url}
                                    alt="Background"
                                    className="absolute inset-0 w-full h-full object-contain"
                                    draggable={false}
                                />
                                {fields.map(f => (
                                    <div
                                        key={f.id}
                                        className={`absolute border-2 rounded cursor-move transition-colors ${
                                            selectedField === f.id
                                                ? 'border-dribly-purple bg-dribly-purple/20'
                                                : dragging === f.id
                                                    ? 'border-dribly-purple bg-dribly-purple/10'
                                                    : 'border-white/30 bg-white/5 hover:border-white/60'
                                        }`}
                                        style={{
                                            left: `${f.x}%`,
                                            top: `${f.y}%`,
                                            width: `${f.w}%`,
                                            height: `${f.h}%`,
                                        }}
                                        onMouseDown={(e) => startDrag(f.id, e)}
                                        onClick={(e) => { e.stopPropagation(); setSelectedField(f.id) }}
                                    >
                                        <div className="absolute -top-5 left-0 right-0 text-[9px] font-bold text-white bg-black/60 rounded px-1 py-0.5 truncate text-center">
                                            {f.label}
                                        </div>
                                        {f.kind === 'logo' && (
                                            <div className="flex items-center justify-center h-full">
                                                <Image size={16} className="text-white/40" />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <p className="text-[10px] text-zinc-400 mt-1 text-center">Arrasta os campos para posicionar. Clique num campo para o editar.</p>
                        </div>

                        {/* Field properties */}
                        {selectedField && (() => {
                            const f = fields.find(ff => ff.id === selectedField)
                            if (!f) return null
                            return (
                                <div className="w-64 shrink-0 space-y-3 p-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Propriedades</h3>
                                        <button onClick={() => removeField(f.id)} className="p-1 rounded hover:bg-red-50 text-zinc-400 hover:text-red-600">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Label</label>
                                        <input
                                            value={f.label}
                                            onChange={(e) => updateField(f.id, { label: e.target.value })}
                                            className="w-full mt-0.5 px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-transparent"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-[10px] font-bold text-zinc-500 uppercase">X %</label>
                                            <input
                                                type="number"
                                                value={Math.round(f.x)}
                                                onChange={(e) => updateField(f.id, { x: Number(e.target.value) })}
                                                className="w-full mt-0.5 px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-transparent"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-zinc-500 uppercase">Y %</label>
                                            <input
                                                type="number"
                                                value={Math.round(f.y)}
                                                onChange={(e) => updateField(f.id, { y: Number(e.target.value) })}
                                                className="w-full mt-0.5 px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-transparent"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-zinc-500 uppercase">Larg %</label>
                                            <input
                                                type="number"
                                                value={Math.round(f.w)}
                                                onChange={(e) => updateField(f.id, { w: Number(e.target.value) })}
                                                className="w-full mt-0.5 px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-transparent"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-zinc-500 uppercase">Alt %</label>
                                            <input
                                                type="number"
                                                value={Math.round(f.h)}
                                                onChange={(e) => updateField(f.id, { h: Number(e.target.value) })}
                                                className="w-full mt-0.5 px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-transparent"
                                            />
                                        </div>
                                    </div>

                                    {f.kind === 'text' && (
                                        <>
                                            <div>
                                                <label className="text-[10px] font-bold text-zinc-500 uppercase">Tamanho</label>
                                                <input
                                                    type="number"
                                                    value={f.fontSize}
                                                    onChange={(e) => updateField(f.id, { fontSize: Number(e.target.value) })}
                                                    className="w-full mt-0.5 px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-transparent"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-zinc-500 uppercase">Cor</label>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <input
                                                        type="color"
                                                        value={f.color}
                                                        onChange={(e) => updateField(f.id, { color: e.target.value })}
                                                        className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                                                    />
                                                    <input
                                                        value={f.color}
                                                        onChange={(e) => updateField(f.id, { color: e.target.value })}
                                                        className="flex-1 px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-transparent font-mono"
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={f.italic}
                                                        onChange={(e) => updateField(f.id, { italic: e.target.checked })}
                                                        className="rounded"
                                                    />
                                                    Itálico
                                                </label>
                                                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={f.outline}
                                                        onChange={(e) => updateField(f.id, { outline: e.target.checked })}
                                                        className="rounded"
                                                    />
                                                    Outline
                                                </label>
                                            </div>
                                        </>
                                    )}

                                    {f.kind === 'logo' && (
                                        <p className="text-[10px] text-zinc-400">O logo do clube será automaticamente recortado e ajustado a esta área.</p>
                                    )}

                                    <div>
                                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Tipo</label>
                                        <select
                                            value={f.kind}
                                            onChange={(e) => updateField(f.id, { kind: e.target.value as 'text' | 'logo' })}
                                            className="w-full mt-0.5 px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-transparent"
                                        >
                                            <option value="text">Texto</option>
                                            <option value="logo">Logo</option>
                                        </select>
                                    </div>
                                </div>
                            )
                        })()}
                    </div>
                </div>
            )}

            {/* ── Tab: Generate ─────────────────────────── */}
            {tab === 'generate' && (
                <div className="space-y-4">
                    {/* Template selection */}
                    <div>
                        <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-2">1. Escolhe o template</h3>
                        {templates.length === 0 ? (
                            <p className="text-sm text-zinc-400">Nenhum template. Faz upload primeiro.</p>
                        ) : (
                            <div className="flex gap-2 flex-wrap">
                                {templates.map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => { setSelectedTemplate(t); setPreviewUrl(null); }}
                                        className={`px-3 py-2 rounded-lg text-xs font-bold border transition-colors capitalize ${
                                            selectedTemplate?.id === t.id
                                                ? 'border-dribly-purple bg-dribly-purple/10 text-dribly-purple'
                                                : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'
                                        }`}
                                    >
                                        {t.name} <span className="opacity-50 ml-1">({t.type.replace(/_/g, ' ')})</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Game search */}
                    <div>
                        <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-2">2. Pesquisa jogos</h3>
                        <div className="flex gap-2 mb-3">
                            <input
                                value={gameQuery}
                                onChange={(e) => setGameQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && searchGames()}
                                placeholder="Equipa, competição..."
                                className="flex-1 px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent"
                            />
                            <button
                                onClick={searchGames}
                                disabled={searching}
                                className="flex items-center gap-1 px-4 py-2 bg-dribly-purple text-white rounded-lg text-sm font-bold hover:bg-dribly-purple-dim disabled:opacity-50"
                            >
                                <Search size={14} />
                                {searching ? '...' : 'Pesquisar'}
                            </button>
                        </div>

                        {games.length > 0 && (
                            <div className="max-h-64 overflow-y-auto space-y-1 border border-zinc-200 dark:border-zinc-700 rounded-lg divide-y divide-zinc-100 dark:divide-zinc-800">
                                {games.map(game => {
                                    const isSelected = selectedGames.some(g => g.slug === game.slug)
                                    return (
                                        <button
                                            key={game.slug}
                                            onClick={() => toggleGame(game)}
                                            className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between ${
                                                isSelected ? 'bg-dribly-purple/10' : 'hover:bg-zinc-50 dark:hover:bg-white/5'
                                            }`}
                                        >
                                            <div>
                                                <span className="font-bold">{game.equipa_casa}</span>
                                                <span className="text-zinc-400 mx-1.5">vs</span>
                                                <span className="font-bold">{game.equipa_fora}</span>
                                                <span className="text-zinc-400 ml-2 text-xs">{game.data}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {game.resultado_casa != null && (
                                                    <span className="text-xs font-bold text-dribly-purple">{game.resultado_casa} - {game.resultado_fora}</span>
                                                )}
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${game.status === 'FINALIZADO' ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400' : game.status === 'AGENDADO' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400'}`}>
                                                    {game.status}
                                                </span>
                                                {isSelected && <span className="text-dribly-purple font-bold text-lg">✓</span>}
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                        {selectedGames.length > 0 && (
                            <p className="text-xs text-zinc-500 mt-2">{selectedGames.length} jogo(s) selecionado(s)</p>
                        )}
                    </div>

                    {/* Generate & Preview */}
                    <div>
                        <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-2">3. Gerar</h3>
                        <div className="flex gap-2 mb-4">
                            <button
                                onClick={generatePreview}
                                disabled={!selectedTemplate || selectedGames.length === 0 || generating}
                                className="flex items-center gap-1 px-4 py-2 bg-dribly-purple text-white rounded-lg text-sm font-bold hover:bg-dribly-purple-dim disabled:opacity-50"
                            >
                                <Eye size={14} /> Preview
                            </button>
                            <button
                                onClick={downloadSingle}
                                disabled={!selectedTemplate || selectedGames.length === 0}
                                className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-bold border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-white/5 disabled:opacity-50"
                            >
                                <Download size={14} /> Download 1º
                            </button>
                            <button
                                onClick={downloadAll}
                                disabled={!selectedTemplate || selectedGames.length === 0 || generating}
                                className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-bold border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-white/5 disabled:opacity-50"
                            >
                                <Download size={14} /> Todos ({selectedGames.length})
                            </button>
                        </div>

                        {generating && (
                            <div className="text-center py-8 text-zinc-400">
                                <span className="animate-spin inline-block mr-2">⟳</span> A gerar...
                            </div>
                        )}

                        {previewUrl && !generating && (
                            <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden max-w-md mx-auto">
                                <img src={previewUrl} alt="Preview" className="w-full" />
                            </div>
                        )}
                    </div>

                    {/* Hidden canvas */}
                    <canvas ref={canvasRef} className="hidden" width={1080} height={1080} />
                </div>
            )}
        </div>
    )
}
