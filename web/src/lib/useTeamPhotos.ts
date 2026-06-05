import { useState, useEffect } from 'react'

const FPB_PROXY = '/api/fpb'

export interface TeamData {
    nome: string
    escalao: string
    photo: string | null
}

interface DataMap { [teamId: string]: TeamData }
const norm = (s: string) => s.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()

/** Parse WP AJAX for ALL equipa IDs + photos (no club filter) */
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

/** Parse individual equipa page for: team name, escalão, club name */
function parseEquipaPage(html: string): { nome: string; escalao: string; clube: string } | null {
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

    // Escalão
    const escRe = /\b(S(é|e)nior|Sub\s*\d+|Mini\s*\d+|SUB\s*\d+|MINI\s*\d+)\b/i
    let escalao = ''
    for (const l of lines) {
        if (escRe.test(l) && l.length < 30) { escalao = l; break }
    }

    // Club name: find the first line that looks like a full club name (longer, multiple words)
    const clubNameRe = /^(Futebol Clube|Sporting Clube|Clube Desportivo|Grupo Desportivo|Associação|União Desportiva|Atletico Clube|Ginasio Clube|Basquete Clube)/i
    let clube = ''
    for (const l of lines) {
        if (clubNameRe.test(l) && l.length > 10 && l.length < 80) {
            clube = l; break
        }
    }

    if (!nome) return null
    return { nome, escalao, clube }
}

async function fetchBatch(ids: string[]): Promise<{ equipaId: string; nome: string; escalao: string; clube: string }[]> {
    const results = await Promise.all(ids.map(async (id) => {
        try {
            const r = await fetch(`${FPB_PROXY}?page=equipa&equipa_id=${id}`)
            if (!r.ok) return null
            const info = parseEquipaPage(await r.text())
            return info ? { equipaId: id, ...info } : null
        } catch { return null }
    }))
    return results.filter(Boolean) as { equipaId: string; nome: string; escalao: string; clube: string }[]
}

/** Check if equipa belongs to the club (using data FROM the equipa page, no DB) */
function matchesClub(info: { nome: string; clube: string }, clubName: string): boolean {
    const cn = norm(clubName)
    // Club name from page
    if (info.clube && norm(info.clube).includes(cn)) return true
    // Team name
    if (norm(info.nome).includes(cn)) return true
    // Word-level
    for (const w of cn.split(/\s+/)) {
        if (w.length > 2 && norm(info.nome).includes(w)) return true
    }
    return false
}

export function useTeamPhotos(clubId: number, clubName: string): { teamData: DataMap; loading: boolean } {
    const [teamData, setTeamData] = useState<DataMap>({})
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!clubId || !clubName) return
        setLoading(true)
        let cancelled = false

        async function run() {
            try {
                const topComps = [10902, 10903, 10904, 10906, 10907, 10908]

                // Step 1: fetch ALL teams from all competitions (no filter)
                const compResults = await Promise.all(topComps.map(async (cid) => {
                    try {
                        const r = await fetch(`${FPB_PROXY}?wp_action=get_equipas&idCompeticao=${cid}`)
                        return r.ok ? parseCompTeams(await r.text()) : []
                    } catch { return [] }
                }))
                if (cancelled) return

                // Deduplicate ALL equipa IDs
                const allEquipas = new Map<string, { nome: string; photo: string | null }>()
                for (const compTeams of compResults) {
                    for (const t of compTeams) {
                        if (!allEquipas.has(t.equipaId)) {
                            allEquipas.set(t.equipaId, { nome: t.nome, photo: t.photo })
                        }
                    }
                }
                if (cancelled) return

                console.log(`📸 ${clubName}: ${allEquipas.size} equipas únicas encontradas`)

                // Step 2: fetch individual pages in batches (5 at a time)
                const ids = Array.from(allEquipas.keys())
                const dataMap: DataMap = {}
                const BATCH = 5
                for (let i = 0; i < ids.length; i += BATCH) {
                    if (cancelled) return
                    const batch = ids.slice(i, i + BATCH)
                    const batchResults = await fetchBatch(batch)
                    for (const r of batchResults) {
                        // Filter: only keep equipas matching THIS club
                        if (!matchesClub(r, clubName)) continue
                        const compData = allEquipas.get(r.equipaId)
                        dataMap[r.equipaId] = {
                            nome: r.nome,
                            escalao: r.escalao || compData?.nome || '',
                            photo: compData?.photo || null,
                        }
                        const esc = norm(r.escalao)
                        if (esc && !dataMap[esc]) dataMap[esc] = dataMap[r.equipaId]
                    }
                }

                if (!cancelled) {
                    console.log(`📸 ${clubName} final: ${Object.keys(dataMap).length} equipas do clube`)
                    setTeamData(dataMap)
                }
            } catch {} finally { if (!cancelled) setLoading(false) }
        }
        run()
        return () => { cancelled = true }
    }, [clubId, clubName])

    return { teamData, loading }
}
