import { useState, useEffect } from 'react'

const FPB_PROXY = '/api/fpb'

export interface TeamData { nome: string; escalao: string; photo: string | null }
interface DataMap { [key: string]: TeamData }
const norm = (s: string) => s.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()

function parseClubTeams(html: string): string[] {
    const ids: string[] = []
    const re = /<a href="\/equipa\/(equipa_\d+)">/g
    let m; while ((m = re.exec(html)) !== null) ids.push(m[1])
    return [...new Set(ids)]
}

function parseEquipa(html: string): { nome: string; escalao: string; photo: string | null } | null {
    const nm = html.match(/<div class="team-nome">\s*([^<]+)\s*<\/div>/)
    const lv = html.match(/<div class="team-level">\s*([^<]+)\s*<\/div>/)
    const ph = html.match(/<div class="team-right[^"]*">\s*<img\s+src="([^"]+)"\s*\/>/)
    const nome = nm?.[1]?.trim(); if (!nome) return null
    return { nome, escalao: (lv?.[1]?.trim() || '').split('|')[0]?.trim() || '', photo: ph?.[1]?.trim() || null }
}

async function fetchBatch(ids: string[]): Promise<{ id: string; nome: string; escalao: string; photo: string | null }[]> {
    return (await Promise.all(ids.map(async id => {
        try { const r = await fetch(`${FPB_PROXY}?page=equipa&equipa_id=${id}`); if (!r.ok) return null; const p = parseEquipa(await r.text()); return p ? { id, ...p } : null } catch { return null }
    }))).filter(Boolean) as any[]
}

export function useTeamPhotos(clubId: number, clubName: string): { teamData: DataMap; loading: boolean } {
    const [teamData, setTeamData] = useState<DataMap>({})
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!clubId) return
        setLoading(true)
        let cancelled = false

        async function run() {
            try {
                // 1 call to get ALL equipa IDs for this club
                const r = await fetch(`${FPB_PROXY}?wp_action=get_equipas&idClube=${clubId}&epoca=2025/2026`)
                if (!r.ok || cancelled) { setLoading(false); return }
                const ids = parseClubTeams(await r.text())
                if (cancelled || ids.length === 0) { setLoading(false); return }

                console.log(`📸 ${clubName}: ${ids.length} equipas do clube, IDs:`, ids)

                // 2. Fetch individual pages in batches of 5
                const dataMap: DataMap = {}
                for (let i = 0; i < ids.length; i += 5) {
                    if (cancelled) return
                    for (const r of await fetchBatch(ids.slice(i, i + 5))) {
                        dataMap[r.id] = { nome: r.nome, escalao: r.escalao, photo: r.photo }
                        const esc = norm(r.escalao)
                        if (esc && !dataMap[esc]) dataMap[esc] = dataMap[r.id]
                    }
                }

                if (!cancelled) setTeamData(dataMap)
            } catch {} finally { if (!cancelled) setLoading(false) }
        }
        run()
        return () => { cancelled = true }
    }, [clubId, clubName])

    return { teamData, loading }
}
