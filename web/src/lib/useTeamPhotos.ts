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

/** Parse individual equipa page — extracts from .team-nome, .team-level, .team-right img */
function parseEquipa(html: string): { nome: string; escalao: string; photo: string | null } | null {
    const nomeMatch = html.match(/<div class="team-nome">\s*([^<]+)\s*<\/div>/)
    const levelMatch = html.match(/<div class="team-level">\s*([^<]+)\s*<\/div>/)
    const photoMatch = html.match(/<div class="team-right[^"]*">\s*<img\s+src="([^"]+)"\s*\/>/)

    const nome = nomeMatch?.[1]?.trim()
    if (!nome) return null

    // team-level format: "Sénior Masculino | CN 1.ª Divisão" → take first part as escalão
    const levelRaw = levelMatch?.[1]?.trim() || ''
    const escalao = levelRaw.split('|')[0]?.trim() || ''

    const photo = photoMatch?.[1]?.trim() || null
    return { nome, escalao, photo }
}

async function fetchBatch(ids: string[]): Promise<{ equipaId: string; nome: string; escalao: string; photo: string | null }[]> {
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
                        // Photo: prefer from individual page, fallback to WP AJAX
                        dataMap[r.equipaId] = { nome: r.nome, escalao: r.escalao, photo: r.photo || idToPhoto.get(r.equipaId) || null }
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
