import { useState, useEffect, useRef, useCallback } from 'react'
import { Plus, Upload, Trash2, Download, Eye, X, Image, Save, Move, Search, Trophy } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAdminApi, type AdminPostTemplate, type AdminGame } from '../../lib/adminApi'

// ── Types ──────────────────────────────────────────────

interface FieldDef {
    id: string
    label: string
    x: number
    y: number
    w: number
    h: number
    fontSize: number
    color: string
    italic: boolean
    outline: boolean
    kind: 'text' | 'logo'
    content: string
    fontFamily: string
    fontWeight: number  // 400, 700, 900
    textAlign: 'left' | 'center' | 'right'
}

type Tab = 'templates' | 'editor' | 'generate'

type PostType = 'resultado_hero' | 'agenda_hero' | 'resultados_lista' | 'agenda_lista' | 'gameday' | 'capa_resultados' | 'capa_agenda' | 'custom'

const POST_TYPE_LABELS: Record<PostType, string> = {
    resultado_hero: 'Resultado — Jogo Único',
    agenda_hero: 'Agenda — Jogo Único',
    resultados_lista: 'Resultados — Lista',
    agenda_lista: 'Agenda — Lista',
    gameday: 'GameDay',
    capa_resultados: 'Capa Resultados',
    capa_agenda: 'Capa Agenda',
    custom: 'Personalizado',
}

// ── Available variables for content templates ─────────

const ALL_VARIABLES: { key: string; label: string; example: string }[] = [
    { key: 'equipa_casa', label: 'Equipa Casa', example: 'FC GAIA' },
    { key: 'equipa_fora', label: 'Equipa Fora', example: 'FC PORTO' },
    { key: 'resultado_casa', label: 'Resultado Casa', example: '37' },
    { key: 'resultado_fora', label: 'Resultado Fora', example: '91' },
    { key: 'data', label: 'Data (ISO)', example: '2025-01-19' },
    { key: 'dia_semana', label: 'Dia da Semana', example: 'DOMINGO' },
    { key: 'dia_mes', label: 'Dia + Mês', example: '19 JAN' },
    { key: 'hora', label: 'Hora (XHYY)', example: '16H30' },
    { key: 'local', label: 'Local', example: 'PAVILHÃO MUNICIPAL' },
    { key: 'escalao', label: 'Escalão', example: 'SUB14A' },
    { key: 'competicao', label: 'Competição', example: 'LIGA BETCLIC' },
    { key: 'status', label: 'Status', example: 'FINALIZADO' },
]

// ── Font options ───────────────────────────────────────

const AVAILABLE_FONTS = [
    { name: 'Montserrat', weights: [400, 700, 900] },
    { name: 'Outfit', weights: [400, 700, 800] },
    { name: 'Bebas Neue', weights: [400] },
    { name: 'Oswald', weights: [400, 700] },
    { name: 'Impact', weights: [400] },
]

const WEIGHT_LABELS: Record<number, string> = { 400: 'Regular', 700: 'Bold', 800: 'Extra Bold', 900: 'Black' }

// Standard content template for each predefined field
const DEFAULT_CONTENT: Record<string, string> = {
    equipa_casa: '{equipa_casa}',
    equipa_fora: '{equipa_fora}',
    resultado_casa: '{resultado_casa}',
    resultado_fora: '{resultado_fora}',
    data: '{data}',
    dia_semana: '{dia_semana}',
    dia_mes: '{dia_mes}',
    hora: '{hora}',
    local: '{local}',
    escalao: '{escalao}',
    competicao: '{competicao}',
}

const FIELD_DEFAULTS: Record<string, Partial<FieldDef>> = {
    equipa_casa: { label: 'Equipa Casa', fontSize: 40, color: '#FFFFFF', italic: false, outline: false, kind: 'text', w: 35, h: 8, content: '{equipa_casa}', fontFamily: 'Montserrat', fontWeight: 900, textAlign: 'left' },
    equipa_fora: { label: 'Equipa Fora', fontSize: 40, color: '#FFFFFF', italic: false, outline: false, kind: 'text', w: 35, h: 8, content: '{equipa_fora}', fontFamily: 'Montserrat', fontWeight: 900, textAlign: 'left' },
    resultado_casa: { label: 'Placar Casa', fontSize: 120, color: '#7C3AED', italic: true, outline: false, kind: 'text', w: 15, h: 14, content: '{resultado_casa}', fontFamily: 'Montserrat', fontWeight: 900, textAlign: 'center' },
    resultado_fora: { label: 'Placar Fora', fontSize: 120, color: '#7C3AED', italic: true, outline: true, kind: 'text', w: 15, h: 14, content: '{resultado_fora}', fontFamily: 'Montserrat', fontWeight: 900, textAlign: 'center' },
    data: { label: 'Data', fontSize: 24, color: '#9CA3AF', italic: false, outline: false, kind: 'text', w: 30, h: 5, content: '{data}', fontFamily: 'Montserrat', fontWeight: 400, textAlign: 'left' },
    dia_semana: { label: 'Dia Semana', fontSize: 28, color: '#FFFFFF', italic: false, outline: false, kind: 'text', w: 25, h: 5, content: '{dia_semana}', fontFamily: 'Montserrat', fontWeight: 900, textAlign: 'left' },
    dia_mes: { label: 'Dia + Mês', fontSize: 28, color: '#FFFFFF', italic: false, outline: false, kind: 'text', w: 25, h: 5, content: '{dia_mes}', fontFamily: 'Montserrat', fontWeight: 900, textAlign: 'left' },
    hora: { label: 'Hora', fontSize: 80, color: '#7C3AED', italic: true, outline: false, kind: 'text', w: 20, h: 12, content: '{hora}', fontFamily: 'Montserrat', fontWeight: 900, textAlign: 'center' },
    local: { label: 'Local', fontSize: 22, color: '#9CA3AF', italic: false, outline: false, kind: 'text', w: 30, h: 5, content: '{local}', fontFamily: 'Montserrat', fontWeight: 400, textAlign: 'left' },
    escalao: { label: 'Escalão', fontSize: 32, color: '#FFFFFF', italic: false, outline: false, kind: 'text', w: 20, h: 6, content: '{escalao}', fontFamily: 'Montserrat', fontWeight: 900, textAlign: 'left' },
    competicao: { label: 'Competição', fontSize: 24, color: '#9CA3AF', italic: false, outline: false, kind: 'text', w: 25, h: 5, content: '{competicao}', fontFamily: 'Montserrat', fontWeight: 400, textAlign: 'left' },
    logo_casa: { label: 'Logo Casa', fontSize: 0, color: '', italic: false, outline: false, kind: 'logo', w: 28, h: 28, content: '', fontFamily: 'Montserrat', fontWeight: 400, textAlign: 'left' },
    logo_fora: { label: 'Logo Fora', fontSize: 0, color: '', italic: false, outline: false, kind: 'logo', w: 28, h: 28, content: '', fontFamily: 'Montserrat', fontWeight: 400, textAlign: 'left' },
}

// ── Color palette ──────────────────────────────────────

const PALETTE_SWATCHES = [
    '#7C3AED', '#FFFFFF', '#9CA3AF', '#D9F99D', '#EF4444',
    '#09070F', '#1B162E', '#000000', '#F59E0B', '#06B6D4',
]

function loadRecentColors(): string[] {
    try {
        const raw = localStorage.getItem('dribly_recent_colors')
        return raw ? JSON.parse(raw) : []
    } catch { return [] }
}
function saveRecentColor(color: string) {
    const recent = loadRecentColors().filter(c => c !== color)
    recent.unshift(color)
    localStorage.setItem('dribly_recent_colors', JSON.stringify(recent.slice(0, 6)))
}

// ── Component ───────────────────────────────────────────

export default function PostsAdmin() {
    const api = useAdminApi()
    const [tab, setTab] = useState<Tab>('templates')
    const [templates, setTemplates] = useState<AdminPostTemplate[]>([])
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [selectedType, setSelectedType] = useState<PostType>('resultado_hero')
    const [recentColors, setRecentColors] = useState<string[]>(() => loadRecentColors())

    // Editor state
    const [editingTemplate, setEditingTemplate] = useState<AdminPostTemplate | null>(null)
    const [fields, setFields] = useState<FieldDef[]>([])
    const [dragging, setDragging] = useState<string | null>(null)
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
    const [resizing, setResizing] = useState<{ id: string; corner: string; startX: number; startY: number; startW: number; startH: number; startLeft: number; startTop: number } | null>(null)
    const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set())
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

    const apiRef = useRef(api)
    apiRef.current = api

    // ── Load templates ──────────────────────────────────

    const loadTemplates = async () => {
        setLoading(true)
        try {
            const { templates: tpls } = await apiRef.current.listPostTemplates()
            setTemplates(tpls)
        } catch (e) {
            setMessage('Erro: ' + (e as Error).message)
        }
        setLoading(false)
    }

    useEffect(() => { loadTemplates() }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-select default template when switching to generate tab
    useEffect(() => {
        if (tab === 'generate' && templates.length > 0 && !selectedTemplate) {
            const def = templates.find(t => t.is_default)
            if (def) setSelectedTemplate(def)
        }
    }, [tab, templates]) // eslint-disable-line react-hooks/exhaustive-deps

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

            const type = selectedType
            const name = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')

            // Create template with NO fields — user adds them manually in the editor
            const defaultFields: Record<string, FieldDef> = {}

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
            content: (f.content as string) || (DEFAULT_CONTENT[id] || ''),
            fontFamily: (f.fontFamily as string) || 'Montserrat',
            fontWeight: (f.fontWeight as number) || 900,
            textAlign: (f.textAlign as FieldDef['textAlign']) || 'left',
        }))
        setFields(parsed)
        setSelectedFields(new Set())
        setTab('editor')
    }

    const [showAddMenu, setShowAddMenu] = useState(false)
    const addMenuRef = useRef<HTMLDivElement>(null)
    const [showGrid, setShowGrid] = useState(false)
    const [gridDivisions, setGridDivisions] = useState(4)  // 2,4,8,16
    const [zoom, setZoom] = useState(100)  // 25-200
    const [showFakeGame, setShowFakeGame] = useState(true)

    // ── Fake game for preview ───────────────────────────

    const [fakeGame, setFakeGame] = useState<AdminGame>({
        slug: 'exemplo',
        data: '2025-10-19',
        hora: '16:30',
        equipa_casa: 'FC GAIA',
        equipa_fora: 'FC PORTO',
        resultado_casa: 37,
        resultado_fora: 91,
        escalao: 'SUB14A',
        competicao: 'LIGA BETCLIC',
        local: 'PAVILHÃO MUNICIPAL',
        logotipo_casa: 'https://qdzmwgahencinoucvoop.supabase.co/storage/v1/object/public/club-logos/fc-gaia.png',
        logotipo_fora: 'https://qdzmwgahencinoucvoop.supabase.co/storage/v1/object/public/club-logos/fc-porto.png',
        status: 'FINALIZADO',
    })

    const resolvePreview = (content: string): string => {
        if (!content) return ''
        const vars: Record<string, string> = {
            equipa_casa: fakeGame.equipa_casa || '',
            equipa_fora: fakeGame.equipa_fora || '',
            resultado_casa: fakeGame.resultado_casa != null ? String(fakeGame.resultado_casa) : '',
            resultado_fora: fakeGame.resultado_fora != null ? String(fakeGame.resultado_fora) : '',
            data: fakeGame.data || '',
            local: fakeGame.local || '',
            escalao: fakeGame.escalao || '',
            competicao: fakeGame.competicao || '',
            status: fakeGame.status || '',
        }
        if (fakeGame.data) {
            const d = new Date(fakeGame.data + 'T00:00:00')
            vars.dia_semana = d.toLocaleDateString('pt-PT', { weekday: 'long' }).toUpperCase()
            const mes = d.toLocaleDateString('pt-PT', { month: 'short' }).toUpperCase().replace('.', '')
            vars.dia_mes = `${d.getDate()} ${mes}`
        } else {
            vars.dia_semana = ''
            vars.dia_mes = ''
        }
        vars.hora = (fakeGame.hora || '').replace(':', 'H')
        return content.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`)
    }

    // Close add menu on outside click
    useEffect(() => {
        if (!showAddMenu) return
        const handler = (e: MouseEvent) => {
            if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
                setShowAddMenu(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [showAddMenu])

    const addField = (fid?: string) => {
        setShowAddMenu(false)
        const id = fid || `field_${Date.now()}`
        const existing = fields.find(f => f.id === id)
        if (existing) {
            setSelectedFields(new Set([id]))
            return
        }
        const def = FIELD_DEFAULTS[id] || {}
        const content = fid ? (def.content || DEFAULT_CONTENT[id] || '') : '{competicao}'
        const label = fid ? (def.label || id) : 'Novo Campo'
        setFields(prev => [...prev, {
            id,
            label,
            x: 50, y: 50, w: def.w || 25, h: def.h || 6,
            fontSize: def.fontSize || 30, color: def.color || '#FFFFFF',
            italic: def.italic || false, outline: def.outline || false,
            kind: def.kind || 'text', content,
            fontFamily: def.fontFamily || 'Montserrat',
            fontWeight: def.fontWeight || 900,
            textAlign: def.textAlign || 'left',
        }])
        setSelectedFields(new Set([id]))
    }

    const removeField = (id: string) => {
        setFields(prev => prev.filter(f => f.id !== id))
        setSelectedFields(prev => { const n = new Set(prev); n.delete(id); return n })
    }

    const updateField = (id: string, updates: Partial<FieldDef>) => {
        setFields(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f))
    }

    const updateAllSelected = (updates: Partial<FieldDef>) => {
        setFields(prev => prev.map(f => selectedFields.has(f.id) ? { ...f, ...updates } : f))
    }

    // ── Drag handling ───────────────────────────────────

    const startDrag = (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        const field = fields.find(f => f.id === id)
        if (!field || !editorRef.current) return
        // Select on drag start if not already selected
        if (!selectedFields.has(id)) {
            if (e.ctrlKey || e.metaKey) {
                setSelectedFields(prev => { const n = new Set(prev); n.add(id); return n })
            } else {
                setSelectedFields(new Set([id]))
            }
        }
        const rect = editorRef.current.getBoundingClientRect()
        const clientX = e.clientX - rect.left
        const clientY = e.clientY - rect.top
        const pctX = (clientX / rect.width) * 100
        const pctY = (clientY / rect.height) * 100
        setDragging(id)
        setDragOffset({ x: pctX - field.x, y: pctY - field.y })
    }

    const onDrag = (e: React.MouseEvent) => {
        if (!dragging || !editorRef.current) return
        const rect = editorRef.current.getBoundingClientRect()
        let pctX = ((e.clientX - rect.left) / rect.width) * 100
        let pctY = ((e.clientY - rect.top) / rect.height) * 100
        pctX -= dragOffset.x
        pctY -= dragOffset.y

        // Snap to grid
        if (showGrid) {
            const gridSize = 100 / gridDivisions
            pctX = Math.round(pctX / gridSize) * gridSize
            pctY = Math.round(pctY / gridSize) * gridSize
        }

        // Clamp to bounds
        const field = fields.find(f => f.id === dragging)
        const fw = field?.w || 10
        const fh = field?.h || 5
        pctX = Math.max(0, Math.min(100 - fw, pctX))
        pctY = Math.max(0, Math.min(100 - fh, pctY))

        // Collision avoidance — push away from overlapping fields
        const dragged = fields.find(f => f.id === dragging)
        let adjustedX = pctX
        let adjustedY = pctY
        if (dragged) {
            for (const other of fields) {
                if (other.id === dragging) continue
                // Check overlap
                const overlapX = pctX < other.x + other.w && pctX + dragged.w > other.x
                const overlapY = pctY < other.y + other.h && pctY + dragged.h > other.y
                if (overlapX && overlapY) {
                    // Push in the direction of least resistance
                    const pushRight = (other.x + other.w) - pctX
                    const pushLeft = (pctX + dragged.w) - other.x
                    const pushDown = (other.y + other.h) - pctY
                    const pushUp = (pctY + dragged.h) - other.y
                    const minPush = Math.min(pushRight, pushLeft, pushDown, pushUp)
                    if (minPush === pushRight && pctX + dragged.w + pushRight <= 100) adjustedX = other.x + other.w
                    else if (minPush === pushLeft && other.x - dragged.w >= 0) adjustedX = other.x - dragged.w
                    else if (minPush === pushDown && pctY + dragged.h + pushDown <= 100) adjustedY = other.y + other.h
                    else if (minPush === pushUp && other.y - dragged.h >= 0) adjustedY = other.y - dragged.h
                }
            }
        }

        updateField(dragging, { x: adjustedX, y: adjustedY })
    }

    const endDrag = () => setDragging(null)

    // ── Resize handling ──────────────────────────────────

    const startResize = (id: string, corner: string, e: React.MouseEvent) => {
        const field = fields.find(f => f.id === id)
        if (!field || !editorRef.current) return
        setResizing({
            id, corner,
            startX: e.clientX,
            startY: e.clientY,
            startW: field.w,
            startH: field.h,
            startLeft: field.x,
            startTop: field.y,
        })
    }

    const onResize = (e: React.MouseEvent) => {
        if (!resizing || !editorRef.current) return
        const rect = editorRef.current.getBoundingClientRect()
        const dx = ((e.clientX - resizing.startX) / rect.width) * 100
        const dy = ((e.clientY - resizing.startY) / rect.height) * 100
        const { corner, startW, startH, startLeft, startTop } = resizing

        let newX = startLeft, newY = startTop, newW = startW, newH = startH
        const minPct = 3

        if (corner.includes('e')) newW = Math.max(minPct, startW + dx)
        if (corner.includes('w')) { newW = Math.max(minPct, startW - dx); newX = startLeft + (startW - newW) }
        if (corner.includes('s')) newH = Math.max(minPct, startH + dy)
        if (corner.includes('n')) { newH = Math.max(minPct, startH - dy); newY = startTop + (startH - newH) }

        updateField(resizing.id, { x: Math.max(0, newX), y: Math.max(0, newY), w: newW, h: newH })
    }

    const endResize = () => setResizing(null)

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
                    content: f.content,
                    fontFamily: f.fontFamily, fontWeight: f.fontWeight, textAlign: f.textAlign,
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
        // Ensure fonts are loaded for Canvas
        await document.fonts.ready

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

            // Text field — resolve content template
            let value = (f.content as string) || ''
            if (!value) continue

            // Build variable map for this game
            const vars: Record<string, string> = {
                equipa_casa: game.equipa_casa || '',
                equipa_fora: game.equipa_fora || '',
                resultado_casa: game.resultado_casa != null ? String(game.resultado_casa) : '',
                resultado_fora: game.resultado_fora != null ? String(game.resultado_fora) : '',
                data: game.data || '',
                local: game.local || '',
                escalao: game.escalao || '',
                competicao: game.competicao || '',
                status: game.status || '',
            }

            // Computed date fields
            if (game.data) {
                const dateObj = new Date(game.data + 'T00:00:00')
                vars.dia_semana = dateObj.toLocaleDateString('pt-PT', { weekday: 'long' }).toUpperCase()
                const mes = dateObj.toLocaleDateString('pt-PT', { month: 'short' }).toUpperCase().replace('.', '')
                vars.dia_mes = `${dateObj.getDate()} ${mes}`
            } else {
                vars.dia_semana = ''
                vars.dia_mes = ''
            }

            // Format hora
            vars.hora = (game.hora || '').replace(':', 'H')

            // Replace {variables} in content
            value = value.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`)

            if (!value) continue

            const fontSize = (f.fontSize as number) || 30
            const color = (f.color as string) || '#FFFFFF'
            const italic = f.italic as boolean
            const outline = f.outline as boolean
            const fontFamily = (f.fontFamily as string) || 'Montserrat'
            const fontWeight = (f.fontWeight as number) || 900
            const textAlign = (f.textAlign as string) || 'left'

            ctx.save()
            const fontStr = `${italic ? 'italic ' : ''}${fontWeight} ${fontSize}px ${fontFamily}, Outfit, sans-serif`
            ctx.font = fontStr
            ctx.textBaseline = 'top'
            ctx.textAlign = textAlign as CanvasTextAlign

            // Calculate x based on alignment
            let textX = fx
            if (textAlign === 'center') textX = fx + fw / 2
            else if (textAlign === 'right') textX = fx + fw

            // Measure and scale to fit
            let actualSize = fontSize
            let metrics = ctx.measureText(value)
            while (metrics.width > fw * 0.95 && actualSize > 8) {
                actualSize--
                ctx.font = `${italic ? 'italic ' : ''}${fontWeight} ${actualSize}px ${fontFamily}, Outfit, sans-serif`
                metrics = ctx.measureText(value)
            }

            if (outline) {
                ctx.strokeStyle = color
                ctx.lineWidth = Math.max(2, actualSize / 15)
                ctx.lineJoin = 'round'
                ctx.strokeText(value, textX, fy)
            } else {
                ctx.fillStyle = color
                ctx.shadowColor = 'rgba(0,0,0,0.7)'
                ctx.shadowBlur = 4
                ctx.shadowOffsetX = 2
                ctx.shadowOffsetY = 2
                ctx.fillText(value, textX, fy)
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
                        <select
                            value={selectedType}
                            onChange={(e) => setSelectedType(e.target.value as PostType)}
                            className="px-3 py-2.5 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent text-zinc-900 dark:text-white font-medium"
                        >
                            {(Object.entries(POST_TYPE_LABELS) as [PostType, string][]).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
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
                        <span className="text-xs text-zinc-400">Escolhe o tipo e faz upload do PNG</span>
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
                                <div key={t.id} className={`bg-white dark:bg-zinc-950 border rounded-xl overflow-hidden hover:border-dribly-purple transition-colors ${t.is_default ? 'border-dribly-purple ring-1 ring-dribly-purple' : 'border-zinc-200 dark:border-zinc-800'}`}>
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
                                        {t.is_default && (
                                            <span className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold bg-dribly-purple text-white">PADRÃO</span>
                                        )}
                                    </div>
                                    <div className="p-3 flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-bold text-zinc-900 dark:text-white capitalize">{t.name}</p>
                                            <p className="text-[10px] text-zinc-400">{Object.keys(t.fields as object).length} campos</p>
                                        </div>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={async () => {
                                                    await api.upsertPostTemplate({ id: t.id, is_default: !t.is_default } as AdminPostTemplate)
                                                    loadTemplates()
                                                }}
                                                className={`p-1.5 rounded-lg transition-colors ${t.is_default ? 'bg-dribly-purple/10 text-dribly-purple' : 'hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-500 hover:text-dribly-purple'}`}
                                                title={t.is_default ? 'Remover padrão' : 'Definir como padrão'}
                                            >
                                                <Trophy size={14} />
                                            </button>
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
                            <div className="relative" ref={addMenuRef}>
                                <button onClick={() => setShowAddMenu(!showAddMenu)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors">
                                    <Plus size={12} /> Campo
                                </button>
                                {showAddMenu && (
                                    <div className="absolute top-full left-0 mt-1 w-56 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl z-30 py-1 max-h-64 overflow-y-auto">
                                        <p className="px-3 py-1.5 text-[10px] font-bold text-zinc-400 uppercase">Campos de Texto</p>
                                        {ALL_VARIABLES.map(v => (
                                            <button
                                                key={v.key}
                                                onClick={() => addField(v.key)}
                                                className="w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-100 dark:hover:bg-white/5 flex items-center justify-between"
                                            >
                                                <span>{v.label}</span>
                                                <span className="text-[10px] text-zinc-400 font-mono">{`{${v.key}}`}</span>
                                            </button>
                                        ))}
                                        <div className="border-t border-zinc-200 dark:border-zinc-700 my-1" />
                                        <p className="px-3 py-1.5 text-[10px] font-bold text-zinc-400 uppercase">Logos</p>
                                        <button
                                            onClick={() => addField('logo_casa')}
                                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-100 dark:hover:bg-white/5 flex items-center justify-between"
                                        >
                                            <span>Logo Casa</span>
                                            <Image size={12} className="text-zinc-400" />
                                        </button>
                                        <button
                                            onClick={() => addField('logo_fora')}
                                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-100 dark:hover:bg-white/5 flex items-center justify-between"
                                        >
                                            <span>Logo Fora</span>
                                            <Image size={12} className="text-zinc-400" />
                                        </button>
                                        <div className="border-t border-zinc-200 dark:border-zinc-700 my-1" />
                                        <button
                                            onClick={() => addField()}
                                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-100 dark:hover:bg-white/5 text-dribly-purple font-bold"
                                        >
                                            + Campo Personalizado (texto livre)
                                        </button>
                                    </div>
                                )}
                            </div>
                            <button onClick={saveTemplate} disabled={uploading} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-dribly-purple text-white hover:bg-dribly-purple-dim transition-colors disabled:opacity-50">
                                <Save size={12} /> {uploading ? 'Guardando...' : 'Guardar'}
                            </button>
                            <button onClick={() => { setTab('templates'); setEditingTemplate(null); }} className="px-3 py-1.5 rounded-lg text-xs font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors">
                                <X size={12} />
                            </button>
                        </div>
                    </div>

                    {/* Grid & Zoom controls */}
                    <div className="flex items-center gap-3 text-xs">
                        <button
                            onClick={() => setShowGrid(!showGrid)}
                            className={`flex items-center gap-1 px-2 py-1 rounded font-bold transition-colors ${showGrid ? 'bg-dribly-purple text-white' : 'bg-zinc-100 dark:bg-white/10 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-white/20'}`}
                        >
                            Grelha
                        </button>
                        {showGrid && (
                            <select
                                value={gridDivisions}
                                onChange={(e) => setGridDivisions(Number(e.target.value))}
                                className="px-1.5 py-1 rounded bg-zinc-100 dark:bg-white/10 text-xs font-bold"
                            >
                                <option value={2}>1/2</option>
                                <option value={4}>1/4</option>
                                <option value={8}>1/8</option>
                                <option value={16}>1/16</option>
                            </select>
                        )}
                        <div className="flex items-center gap-1 ml-auto bg-zinc-100 dark:bg-white/10 rounded px-1">
                            <button
                                onClick={() => setZoom(Math.max(25, zoom - 25))}
                                className="px-1 py-0.5 font-bold hover:text-dribly-purple transition-colors"
                                disabled={zoom <= 25}
                            >−</button>
                            <span className="px-1 text-[10px] font-bold min-w-[36px] text-center">{zoom}%</span>
                            <button
                                onClick={() => setZoom(Math.min(200, zoom + 25))}
                                className="px-1 py-0.5 font-bold hover:text-dribly-purple transition-colors"
                                disabled={zoom >= 200}
                            >+</button>
                            <button
                                onClick={() => setZoom(100)}
                                className="px-1 text-[9px] text-zinc-400 hover:text-white transition-colors ml-0.5"
                                title="Reset zoom"
                            >↺</button>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        {/* Editor area */}
                        <div className="flex-1">
                            <div className="overflow-auto border border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-200 dark:bg-zinc-800 flex justify-center">
                                <div
                                    style={{
                                        width: `${zoom}%`,
                                        aspectRatio: '1 / 1',
                                        transformOrigin: 'top left',
                                    }}
                                >
                                    <div
                                        ref={editorRef}
                                        className="relative w-full aspect-square bg-zinc-900 cursor-crosshair select-none"
                                        onMouseMove={(e) => { onDrag(e); onResize(e) }}
                                        onMouseUp={() => { endDrag(); endResize() }}
                                        onMouseLeave={() => { endDrag(); endResize() }}
                                    >
                                        {/* Grid overlay */}
                                        {showGrid && (
                                            <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 5 }}>
                                                {Array.from({ length: gridDivisions + 1 }).map((_, i) => (
                                                    <div key={`h${i}`} className="absolute left-0 right-0 border-t border-white/10" style={{ top: `${(i / gridDivisions) * 100}%` }} />
                                                ))}
                                                {Array.from({ length: gridDivisions + 1 }).map((_, i) => (
                                                    <div key={`v${i}`} className="absolute top-0 bottom-0 border-l border-white/10" style={{ left: `${(i / gridDivisions) * 100}%` }} />
                                                ))}
                                                {/* Center crosshair */}
                                                <div className="absolute left-1/2 top-0 bottom-0 border-l border-dribly-purple/30" />
                                                <div className="absolute top-1/2 left-0 right-0 border-t border-dribly-purple/30" />
                                            </div>
                                        )}

                                        <img
                                            src={editingTemplate.background_url}
                                            alt="Background"
                                            className="absolute inset-0 w-full h-full object-contain"
                                            draggable={false}
                                        />
                                {fields.map(f => (
                                    <div
                                        key={f.id}
                                        className={`absolute border-2 rounded cursor-move transition-colors overflow-visible group ${
                                            selectedFields.has(f.id)
                                                ? 'border-dribly-purple bg-dribly-purple/20 z-10'
                                                : dragging === f.id
                                                    ? 'border-dribly-purple bg-dribly-purple/10 z-10'
                                                    : 'border-white/30 bg-white/5 hover:border-white/60'
                                        }`}
                                        style={{
                                            left: `${f.x}%`,
                                            top: `${f.y}%`,
                                            width: `${f.w}%`,
                                            height: `${f.h}%`,
                                        }}
                                        onMouseDown={(e) => startDrag(f.id, e)}
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            if (e.ctrlKey || e.metaKey) {
                                                // Toggle in selection
                                                setSelectedFields(prev => {
                                                    const n = new Set(prev)
                                                    if (n.has(f.id)) n.delete(f.id); else n.add(f.id)
                                                    return n
                                                })
                                            } else {
                                                setSelectedFields(new Set([f.id]))
                                            }
                                        }}
                                    >
                                        {/* X delete button */}
                                        <button
                                            className="absolute -top-2.5 -right-2.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20"
                                            onMouseDown={(e) => { e.stopPropagation(); e.preventDefault() }}
                                            onClick={(e) => { e.stopPropagation(); removeField(f.id) }}
                                            title="Remover campo"
                                        >
                                            <X size={10} />
                                        </button>

                                        {/* Label */}
                                        <div className="absolute -top-5 left-0 right-0 text-[9px] font-bold text-white bg-black/60 rounded px-1 py-0.5 truncate text-center">
                                            {f.label}
                                        </div>

                                        {/* Content preview */}
                                        {f.kind === 'logo' ? (
                                            <div className="flex items-center justify-center h-full p-1">
                                                {(() => {
                                                    const logoUrl = f.id === 'logo_casa' ? fakeGame.logotipo_casa : f.id === 'logo_fora' ? fakeGame.logotipo_fora : null
                                                    return logoUrl ? (
                                                        <img src={logoUrl} alt="" className="max-w-full max-h-full object-contain opacity-80" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                                                    ) : (
                                                        <Image size={f.w > 20 ? 20 : 14} className="text-white/40" />
                                                    )
                                                })()}
                                            </div>
                                        ) : (
                                            <div
                                                className="flex items-center h-full px-1 overflow-hidden"
                                                style={{
                                                    justifyContent: f.textAlign === 'center' ? 'center' : f.textAlign === 'right' ? 'flex-end' : 'flex-start',
                                                    fontSize: Math.min(f.fontSize * 0.35, 80),
                                                    color: f.color,
                                                    fontStyle: f.italic ? 'italic' : 'normal',
                                                    fontWeight: f.fontWeight,
                                                    fontFamily: `${f.fontFamily}, Outfit, sans-serif`,
                                                    WebkitTextStroke: f.outline ? `1px ${f.color}` : undefined,
                                                    opacity: 0.85,
                                                    textAlign: f.textAlign,
                                                    lineHeight: 1.2,
                                                    wordBreak: 'break-word' as const,
                                                    whiteSpace: 'pre-line' as const,
                                                }}
                                            >
                                                {resolvePreview(f.content || '') || f.label}
                                            </div>
                                        )}

                                        {/* Resize handles — only on selected fields */}
                                        {selectedFields.has(f.id) && (
                                            <>
                                                {/* 4 corners */}
                                                {['nw', 'ne', 'sw', 'se'].map(corner => {
                                                    const isLeft = corner.includes('w')
                                                    const isTop = corner.includes('n')
                                                    return (
                                                        <div
                                                            key={corner}
                                                            className="absolute w-3 h-3 bg-white border-2 border-dribly-purple rounded-sm z-20"
                                                            style={{
                                                                [isLeft ? 'left' : 'right']: -5,
                                                                [isTop ? 'top' : 'bottom']: -5,
                                                                cursor: `${corner}-resize`,
                                                            }}
                                                            onMouseDown={(e) => {
                                                                e.stopPropagation()
                                                                e.preventDefault()
                                                                startResize(f.id, corner, e)
                                                            }}
                                                        />
                                                    )
                                                })}
                                                {/* 4 mid-edge handles */}
                                                {['n', 's', 'e', 'w'].map(edge => {
                                                    const isVert = edge === 'n' || edge === 's'
                                                    return (
                                                        <div
                                                            key={edge}
                                                            className="absolute w-3 h-3 bg-white border-2 border-dribly-purple rounded-sm z-20"
                                                            style={{
                                                                [isVert ? 'top' : 'left']: isVert ? -5 : '50%',
                                                                [isVert ? 'bottom' : 'right']: isVert ? undefined : -5,
                                                                [isVert ? 'left' : 'top']: isVert ? '50%' : -5,
                                                                transform: isVert ? 'translateX(-50%)' : 'translateY(-50%)',
                                                                cursor: `${edge}-resize`,
                                                            }}
                                                            onMouseDown={(e) => {
                                                                e.stopPropagation()
                                                                e.preventDefault()
                                                                startResize(f.id, edge, e)
                                                            }}
                                                        />
                                                    )
                                                })}
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                                </div> {/* zoom wrapper */}
                            </div> {/* overflow-auto */}
                            <p className="text-[10px] text-zinc-400 mt-1 text-center">Arrasta para mover. Puxa as pegas (cantos) para redimensionar. Usa zoom e grelha para precisão.</p>
                        </div> {/* flex-1 */}

                        {/* Field properties */}
                        {selectedFields.size > 0 && (() => {
                            const f = fields.find(ff => selectedFields.has(ff.id))
                            if (!f) return null
                            const isMulti = selectedFields.size > 1
                            return (
                                <div className="w-64 shrink-0 space-y-3 p-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl max-h-[calc(100vh-200px)] overflow-y-auto">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                                            {isMulti ? `${selectedFields.size} campos` : 'Propriedades'}
                                        </h3>
                                        <button onClick={() => { selectedFields.forEach(id => removeField(id)) }} className="p-1 rounded hover:bg-red-50 text-zinc-400 hover:text-red-600" title="Eliminar selecionados">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>

                                    {isMulti && <p className="text-[10px] text-zinc-400 -mt-2">A mostrar 1º campo. Alterações aplicam-se a todos.</p>}

                                    <div>
                                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Label</label>
                                        <input
                                            value={f.label}
                                            onChange={(e) => isMulti ? updateAllSelected({ label: e.target.value }) : updateField(f.id, { label: e.target.value })}
                                            className="w-full mt-0.5 px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-transparent"
                                        />
                                    </div>

                                    {f.kind === 'text' && (
                                        <>
                                            <div>
                                                <label className="text-[10px] font-bold text-zinc-500 uppercase">Conteúdo</label>
                                                <textarea
                                                    id={`content-${f.id}`}
                                                    value={f.content || ''}
                                                    onChange={(e) => updateField(f.id, { content: e.target.value })}
                                                    className="w-full mt-0.5 px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-transparent font-mono resize-none h-12"
                                                    placeholder="Texto fixo ou {variavel}"
                                                />
                                                <p className="text-[9px] text-zinc-400 mt-0.5">
                                                    Usa {'{nome}'} para variáveis. Ex: {'{equipa_casa} vs {equipa_fora}'}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Variáveis</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {ALL_VARIABLES.map(v => (
                                                        <button
                                                            key={v.key}
                                                            onClick={() => {
                                                                const input = document.getElementById(`content-${f.id}`) as HTMLTextAreaElement
                                                                if (input) {
                                                                    const start = input.selectionStart
                                                                    const end = input.selectionEnd
                                                                    const text = input.value
                                                                    const insert = `{${v.key}}`
                                                                    const newText = text.substring(0, start) + insert + text.substring(end)
                                                                    updateField(f.id, { content: newText })
                                                                    setTimeout(() => { input.focus(); input.setSelectionRange(start + insert.length, start + insert.length) }, 0)
                                                                } else {
                                                                    updateField(f.id, { content: (f.content || '') + `{${v.key}}` })
                                                                }
                                                            }}
                                                            className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-100 dark:bg-white/10 hover:bg-dribly-purple/20 transition-colors"
                                                            title={`{${v.key}} — ${v.example}`}
                                                        >
                                                            {`{${v.key}}`}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-[10px] font-bold text-zinc-500 uppercase">X %</label>
                                            <input type="number" value={Math.round(f.x)} onChange={(e) => isMulti ? updateAllSelected({ x: Number(e.target.value) }) : updateField(f.id, { x: Number(e.target.value) })} className="w-full mt-0.5 px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-transparent" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-zinc-500 uppercase">Y %</label>
                                            <input type="number" value={Math.round(f.y)} onChange={(e) => isMulti ? updateAllSelected({ y: Number(e.target.value) }) : updateField(f.id, { y: Number(e.target.value) })} className="w-full mt-0.5 px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-transparent" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-zinc-500 uppercase">Larg %</label>
                                            <input type="number" value={Math.round(f.w)} onChange={(e) => isMulti ? updateAllSelected({ w: Number(e.target.value) }) : updateField(f.id, { w: Number(e.target.value) })} className="w-full mt-0.5 px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-transparent" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-zinc-500 uppercase">Alt %</label>
                                            <input type="number" value={Math.round(f.h)} onChange={(e) => isMulti ? updateAllSelected({ h: Number(e.target.value) }) : updateField(f.id, { h: Number(e.target.value) })} className="w-full mt-0.5 px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-transparent" />
                                        </div>
                                    </div>

                                    {f.kind === 'text' && (
                                        <>
                                            <div>
                                                <label className="text-[10px] font-bold text-zinc-500 uppercase">Fonte</label>
                                                <select value={f.fontFamily} onChange={(e) => isMulti ? updateAllSelected({ fontFamily: e.target.value }) : updateField(f.id, { fontFamily: e.target.value })} className="w-full mt-0.5 px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-transparent">
                                                    {AVAILABLE_FONTS.map(ff => (<option key={ff.name} value={ff.name}>{ff.name}</option>))}
                                                </select>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Peso</label>
                                                    <select value={f.fontWeight} onChange={(e) => isMulti ? updateAllSelected({ fontWeight: Number(e.target.value) }) : updateField(f.id, { fontWeight: Number(e.target.value) })} className="w-full mt-0.5 px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-transparent">
                                                        {(() => {
                                                            const fontObj = AVAILABLE_FONTS.find(ff => ff.name === f.fontFamily)
                                                            const weights = fontObj?.weights || [400, 700, 900]
                                                            return weights.map(w => (<option key={w} value={w}>{WEIGHT_LABELS[w] || w}</option>))
                                                        })()}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Alinhar</label>
                                                    <select value={f.textAlign} onChange={(e) => isMulti ? updateAllSelected({ textAlign: e.target.value as 'left' | 'center' | 'right' }) : updateField(f.id, { textAlign: e.target.value as 'left' | 'center' | 'right' })} className="w-full mt-0.5 px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-transparent">
                                                        <option value="left">Esquerda</option>
                                                        <option value="center">Centro</option>
                                                        <option value="right">Direita</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-zinc-500 uppercase">Tamanho {f.fontSize}px</label>
                                                <input type="range" min="8" max="200" value={f.fontSize} onChange={(e) => isMulti ? updateAllSelected({ fontSize: Number(e.target.value) }) : updateField(f.id, { fontSize: Number(e.target.value) })} className="w-full mt-0.5 accent-dribly-purple" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-zinc-500 uppercase">Cor</label>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <input type="color" value={f.color} onChange={(e) => { if (isMulti) updateAllSelected({ color: e.target.value }); else updateField(f.id, { color: e.target.value }); saveRecentColor(e.target.value); setRecentColors(loadRecentColors()) }} className="w-8 h-8 rounded cursor-pointer border-0 p-0" />
                                                    <input value={f.color} onChange={(e) => { const c = e.target.value; isMulti ? updateAllSelected({ color: c }) : updateField(f.id, { color: c }); saveRecentColor(c); setRecentColors(loadRecentColors()) }} className="flex-1 px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-transparent font-mono" />
                                                </div>
                                                <div className="flex flex-wrap gap-1 mt-1.5">
                                                    {PALETTE_SWATCHES.map(c => (
                                                        <button key={c} className="w-5 h-5 rounded border border-zinc-300 dark:border-zinc-600 cursor-pointer transition-transform hover:scale-110" style={{ backgroundColor: c }}
                                                            onClick={() => { isMulti ? updateAllSelected({ color: c }) : updateField(f.id, { color: c }); saveRecentColor(c); setRecentColors(loadRecentColors()) }}
                                                            title={c} />
                                                    ))}
                                                </div>
                                                {recentColors.length > 0 && (
                                                    <div className="mt-1">
                                                        <p className="text-[9px] text-zinc-400 uppercase mb-0.5">Recentes</p>
                                                        <div className="flex flex-wrap gap-1">
                                                            {recentColors.map(c => (
                                                                <button key={c} className="w-5 h-5 rounded-full border border-zinc-300 dark:border-zinc-600 cursor-pointer transition-transform hover:scale-110" style={{ backgroundColor: c }}
                                                                    onClick={() => { isMulti ? updateAllSelected({ color: c }) : updateField(f.id, { color: c }); setRecentColors(loadRecentColors()) }}
                                                                    title={c} />
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                                                    <input type="checkbox" checked={f.italic} onChange={(e) => isMulti ? updateAllSelected({ italic: e.target.checked }) : updateField(f.id, { italic: e.target.checked })} className="rounded" />
                                                    Itálico
                                                </label>
                                                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                                                    <input type="checkbox" checked={f.outline} onChange={(e) => isMulti ? updateAllSelected({ outline: e.target.checked }) : updateField(f.id, { outline: e.target.checked })} className="rounded" />
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
                                        <select value={f.kind} onChange={(e) => isMulti ? updateAllSelected({ kind: e.target.value as 'text' | 'logo' }) : updateField(f.id, { kind: e.target.value as 'text' | 'logo' })} className="w-full mt-0.5 px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-transparent">
                                            <option value="text">Texto</option>
                                            <option value="logo">Logo</option>
                                        </select>
                                    </div>
                                </div>
                            )
                        })()}
                    </div>

                    {/* ── Fake Game Data ──────────────────── */}
                    <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden">
                        <button
                            onClick={() => setShowFakeGame(!showFakeGame)}
                            className="w-full flex items-center justify-between px-4 py-2.5 bg-zinc-50 dark:bg-white/5 text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors"
                        >
                            <span>📋 Dados de Exemplo (preview)</span>
                            <span className="text-[10px] text-zinc-400">{showFakeGame ? '▲' : '▼'}</span>
                        </button>
                        {showFakeGame && (
                            <div className="p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-xs">
                                {[
                                    { key: 'equipa_casa', label: 'Casa' },
                                    { key: 'equipa_fora', label: 'Fora' },
                                    { key: 'resultado_casa', label: 'Res. Casa' },
                                    { key: 'resultado_fora', label: 'Res. Fora' },
                                    { key: 'data', label: 'Data' },
                                    { key: 'hora', label: 'Hora' },
                                    { key: 'escalao', label: 'Escalão' },
                                    { key: 'competicao', label: 'Competição' },
                                    { key: 'local', label: 'Local' },
                                    { key: 'status', label: 'Status' },
                                    { key: 'logotipo_casa', label: 'Logo Casa (URL)' },
                                    { key: 'logotipo_fora', label: 'Logo Fora (URL)' },
                                ].map(({ key, label }) => (
                                    <div key={key} className="flex flex-col gap-0.5">
                                        <label className="text-[9px] text-zinc-400 uppercase font-bold">{label}</label>
                                        <input
                                            value={(fakeGame as unknown as Record<string, unknown>)[key] as string || ''}
                                            onChange={(e) => setFakeGame(prev => ({ ...prev, [key]: key.startsWith('resultado') ? (e.target.value ? Number(e.target.value) : null) : e.target.value }))}
                                            className="w-full px-1.5 py-1 rounded border border-zinc-200 dark:border-zinc-700 bg-transparent text-[10px] font-mono"
                                        />
                                    </div>
                                ))}
                                <div className="col-span-full">
                                    <p className="text-[9px] text-zinc-400 mt-1">
                                        Altera estes dados para ver como o preview reage. As variáveis nos campos atualizam em tempo real.
                                    </p>
                                </div>
                            </div>
                        )}
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
