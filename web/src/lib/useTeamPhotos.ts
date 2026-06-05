import { useState, useEffect } from 'react'

const FPB_PROXY = '/api/fpb'
const norm = (s: string) => s.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()

export interface TeamData {
    nome: string
    escalao: string
    photo: string | null
}

interface DataMap { [key: string]: TeamData }

/** Parse WP AJAX: return ALL equipa IDs */
function parseCompTeams(html: string): string[] {
    const ids: string[] = []
    const re = /<a href="\/equipa\/(equipa_\d+)">/g
    let m
    while ((m = re.exec(html)) !== null) ids.push(m[1])
    return [...new Set(ids)]
}

/** Parse individual equipa page */
function parseEquipa(html: string): { nome: string; escalao: string; photo: string | null } | null {
    const nomeMatch = html.match(/<div class="team-nome">\s*([^<]+)\s*<\/div>/)
    const levelMatch = html.match(/<div class="team-level">\s*([^<]+)\s*<\/div>/)
    const photoMatch = html.match(/<div class="team-right[^"]*">\s*<img\s+src="([^"]+)"\s*\/>/)

    const nome = nomeMatch?.[1]?.trim()
    if (!nome) return null

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

                // Step 1: Get ALL unique equipa IDs from all competitions
                const allIds = new Set<string>()
                for (const cid of topComps) {
                    if (cancelled) return
                    try {
                        const r = await fetch(`${FPB_PROXY}?wp_action=get_equipas&idCompeticao=${cid}`)
                        if (r.ok) parseCompTeams(await r.text()).forEach(id => allIds.add(id))
                    } catch {}
                }
                if (cancelled || allIds.size === 0) { setLoading(false); return }

                const ids = Array.from(allIds)
                console.log(`📸 ${clubName}: ${ids.length} equipa IDs to check`)

                // Step 2: Fetch individual pages in batches, filter by club name
                const dataMap: DataMap = {}
                for (let i = 0; i < ids.length; i += 5) {
                    if (cancelled) return
                    const results = await fetchBatch(ids.slice(i, i + 5))
                    for (const r of results) {
                        // Filter: team name must contain club name (fuzzy)
                        const tn = norm(r.nome)
                        const cn = norm(clubName)
                        if (!tn.includes(cn) && !cn.split(/\s+/).some(w => w.length > 2 && tn.includes(w))) continue

                        dataMap[r.equipaId] = { nome: r.nome, escalao: r.escalao, photo: r.photo }
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
