import { useState, useEffect } from 'react'

const FPB_PROXY = '/api/fpb'
const norm = (s: string) => s.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()

export interface TeamData {
    nome: string
    escalao: string
    photo: string | null
}

interface DataMap { [key: string]: TeamData }

/** Parse WP AJAX: return ALL equipa IDs + names + photos */
function parseCompTeams(html: string): { equipaId: string; nome: string; photo: string | null }[] {
    const r: { equipaId: string; nome: string; photo: string | null }[] = []
    const re = /<div class="equipa">\s*<a href="\/equipa\/(equipa_\d+)">([\s\S]*?)<\/a>\s*<\/div>/g
    let m
    while ((m = re.exec(html)) !== null) {
        const nm = m[2].match(/<div class="equipa-name">([^<]+)<\/div>/)
        const bg = m[2].match(/background-image:\s*url\(['"]?([^'")]+)['"]?\)/)
        const nome = nm?.[1]?.trim() || ''
        const photo = bg?.[1] || null
        r.push({ equipaId: m[1], nome, photo: photo && !/ass_highlight_default/i.test(photo) ? photo : null })
    }
    return r
}

/** Parse individual equipa page */
function parseEquipa(html: string): { nome: string; escalao: string } | null {
    const lines = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '')
        .replace(/<[^>]+>/g, '\n').split('\n').map(l => l.trim())
        .filter(l => l.length > 2 && l.length < 60 && !l.includes('Cookie') && !l.startsWith('{'))
    const clubRe = /\b(FC|SL|SC|CD|GD|UD|AD|GS|CP|CF|ABC|AJ|AA)\b/i
    let nome = ''; for (const l of lines) { if (clubRe.test(l) && !l.includes('FPB') && !l.includes('Newsletter')) { nome = l; break } }
    const escRe = /\b(S(é|e)nior|Sub\s*\d+|Mini\s*\d+)\b/i
    let esc = ''; for (const l of lines) { if (escRe.test(l) && l.length < 30) { esc = l; break } }
    return nome ? { nome, escalao: esc } : null
}

async function fetchBatch(ids: string[]): Promise<{ equipaId: string; nome: string; escalao: string }[]> {
    return (await Promise.all(ids.map(async id => {
        try { const r = await fetch(`${FPB_PROXY}?page=equipa&equipa_id=${id}`); if (!r.ok) return null; const p = parseEquipa(await r.text()); return p ? { equipaId: id, ...p } : null } catch { return null }
    }))).filter(Boolean) as any[]
}

export function useTeamPhotos(clubId: number, clubName: string, gameTeamIds: string[]): { teamData: DataMap; loading: boolean } {
    const [teamData, setTeamData] = useState<DataMap>({})
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!clubId || gameTeamIds.length === 0) { setLoading(false); return }
        setLoading(true)
        let cancelled = false

        async function run() {
            try {
                const topComps = [10902, 10903, 10904, 10906, 10907, 10908]

                // Step 1: get ALL equipa IDs from all competitions
                const allTeams = (await Promise.all(topComps.map(async cid => {
                    try { const r = await fetch(`${FPB_PROXY}?wp_action=get_equipas&idCompeticao=${cid}`); return r.ok ? parseCompTeams(await r.text()) : [] } catch { return [] }
                }))).flat()
                if (cancelled) return

                // Build lookup: normalized comp name → equipaId
                const nameToId = new Map<string, string>()
                const idToPhoto = new Map<string, string | null>()
                for (const t of allTeams) {
                    nameToId.set(norm(t.nome), t.equipaId)
                    idToPhoto.set(t.equipaId, t.photo)
                }

                // Step 2: match game team IDs to equipa IDs
                const matchedIds = new Set<string>()
                for (const tid of gameTeamIds) {
                    const n = norm(tid)
                    // Try direct match
                    if (nameToId.has(n)) { matchedIds.add(nameToId.get(n)!); continue }
                    // Try partial: each word of teamId against comp names
                    for (const [compName, eqId] of nameToId) {
                        if (compName.includes(n) || n.includes(compName)) {
                            matchedIds.add(eqId); break
                        }
                    }
                }
                if (cancelled || matchedIds.size === 0) { setLoading(false); return }

                // Step 3: fetch individual pages for matched equipas
                const ids = Array.from(matchedIds)
                const dataMap: DataMap = {}
                for (let i = 0; i < ids.length; i += 5) {
                    if (cancelled) return
                    for (const r of await fetchBatch(ids.slice(i, i + 5))) {
                        dataMap[r.equipaId] = { nome: r.nome, escalao: r.escalao, photo: idToPhoto.get(r.equipaId) || null }
                        const esc = norm(r.escalao); if (esc && !dataMap[esc]) dataMap[esc] = dataMap[r.equipaId]
                    }
                }

                if (!cancelled) setTeamData(dataMap)
            } catch {} finally { if (!cancelled) setLoading(false) }
        }
        run()
        return () => { cancelled = true }
    }, [clubId, clubName, gameTeamIds.join(',')])

    return { teamData, loading }
}
