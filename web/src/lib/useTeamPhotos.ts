import { useState, useEffect } from 'react'

const FPB_PROXY = '/api/fpb'
const CACHE_KEY = 'dribly_team_data_v7'
const CACHE_TTL = 30 * 60 * 1000

export interface TeamData {
    nome: string       // real team name: "FC GAIA A"
    escalao: string    // e.g., "Sub 16"
    photo: string | null
}

interface DataMap { [teamId: string]: TeamData }
const norm = (s: string) => s.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()

function getCache() { try { return JSON.parse(sessionStorage.getItem(CACHE_KEY) || '{}') } catch { return {} } }
function setCache(k: string, v: DataMap) { const c = getCache(); c[k] = { ts: Date.now(), map: v }; try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(c)) } catch {} }

/** Parse WP AJAX for equipa IDs + photos */
function parseCompTeams(html: string): { equipaId: string; nome: string; photo: string | null }[] {
    const results: { equipaId: string; nome: string; photo: string | null }[] = []
    const re = /<div class="equipa">\s*<a href="\/equipa\/(equipa_\d+)">([\s\S]*?)<\/a>\s*<\/div>/g
    let m
    while ((m = re.exec(html)) !== null) {
        const equipaId = m[1]
        const block = m[2]
        const nm = block.match(/<div class="equipa-name">([^<]+)<\/div>/)
        const bg = block.match(/background-image:\s*url\(['"]?([^'")]+)['"]?\)/)
        const nome = nm?.[1]?.trim() || ''
        const photo = bg?.[1] || null
        const isPlaceholder = photo && /ass_highlight_default/i.test(photo)
        results.push({ equipaId, nome, photo: isPlaceholder ? null : photo })
    }
    return results
}

/** Parse individual equipa page for real team name */
function parseEquipaPage(html: string): { nome: string; escalao: string } | null {
    const lines = html
        .replace(/<script[\s\S]*?<\/script>/g, '')
        .replace(/<style[\s\S]*?<\/style>/g, '')
        .replace(/<[^>]+>/g, '\n')
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 2 && l.length < 60 && !l.startsWith('{') && !l.startsWith('//') && !l.includes('Cookie'))

    // Team name: short text with club prefix (FC, SL, SC, etc.)
    const clubRe = /\b(FC|SL|SC|CD|GD|UD|AD|GS|CP|CF|ABC|AJ|AA|ACR|GDB|GDR|NBA|CA|CS|GC|GDC)\b/i
    let nome = ''
    for (const l of lines) {
        if (clubRe.test(l) && !l.includes('FPB') && !l.includes('Subscrever') && !l.includes('Newsletter')) {
            nome = l; break
        }
    }

    // Escalão: "Sub 16", "Sénior", "Mini 12", etc.
    const escRe = /\b(S(é|e)nior|Sub\s*\d+|Mini\s*\d+|SUB\s*\d+|MINI\s*\d+)\b/i
    let escalao = ''
    for (const l of lines) {
        if (escRe.test(l) && l.length < 30) { escalao = l; break }
    }

    if (!nome) return null
    return { nome, escalao }
}

async function fetchBatch(ids: string[]): Promise<{ equipaId: string; nome: string; escalao: string }[]> {
    const results = await Promise.all(ids.map(async (id) => {
        try {
            const r = await fetch(`${FPB_PROXY}?page=equipa&equipa_id=${id}`)
            if (!r.ok) return null
            const info = parseEquipaPage(await r.text())
            return info ? { equipaId: id, nome: info.nome, escalao: info.escalao } : null
        } catch { return null }
    }))
    return results.filter(Boolean) as { equipaId: string; nome: string; escalao: string }[]
}

export function useTeamPhotos(clubId: number, clubName: string): { teamData: DataMap; loading: boolean } {
    const [teamData, setTeamData] = useState<DataMap>({})
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!clubId || !clubName) return
        const key = clubName.toLowerCase().trim()
        const cache = getCache()
        if (cache[key] && Date.now() - cache[key].ts < CACHE_TTL) {
            setTeamData(cache[key].map); setLoading(false); return
        }

        let cancelled = false
        async function run() {
            try {
                const topComps = [10902, 10903, 10904, 10906, 10907, 10908]
                const clubNorm = norm(clubName)

                // Step 1: fetch all competitions in parallel → get equipa IDs + photos
                const compResults = await Promise.all(topComps.map(async (cid) => {
                    try {
                        const r = await fetch(`${FPB_PROXY}?wp_action=get_equipas&idCompeticao=${cid}`)
                        return r.ok ? parseCompTeams(await r.text()) : []
                    } catch { return [] }
                }))
                if (cancelled) return

                // Deduplicate equipas by ID, keep first photo
                const equipas = new Map<string, { nome: string; photo: string | null }>()
                for (const compTeams of compResults) {
                    for (const t of compTeams) {
                        if (!norm(t.nome).includes(clubNorm) && !clubNorm.includes(norm(t.nome).replace(/\s+/g, ''))) continue
                        if (equipas.has(t.equipaId)) continue
                        equipas.set(t.equipaId, { nome: t.nome, photo: t.photo })
                    }
                }
                if (cancelled) return

                // Step 2: fetch individual pages in parallel batches (5 at a time)
                const ids = Array.from(equipas.keys())
                const dataMap: DataMap = {}
                const BATCH = 5
                for (let i = 0; i < ids.length; i += BATCH) {
                    if (cancelled) return
                    const batch = ids.slice(i, i + BATCH)
                    const batchResults = await fetchBatch(batch)
                    for (const r of batchResults) {
                        const compData = equipas.get(r.equipaId)
                        dataMap[r.equipaId] = {
                            nome: r.nome,
                            escalao: r.escalao || compData?.nome || '',
                            photo: compData?.photo || null,
                        }
                    }
                }

                // Fallback: any equipas not yet fetched keep competition data
                for (const [id, compData] of equipas) {
                    if (!dataMap[id]) {
                        dataMap[id] = { nome: compData.nome, escalao: '', photo: compData.photo }
                    }
                }

                if (!cancelled && Object.keys(dataMap).length > 0) {
                    setCache(key, dataMap)
                    setTeamData(dataMap)
                }
            } catch {} finally { if (!cancelled) setLoading(false) }
        }
        run()
        return () => { cancelled = true }
    }, [clubId, clubName])

    return { teamData, loading }
}
