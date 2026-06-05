export const config = {
    runtime: 'edge',
}

export default async function handler(request: Request) {
    const url = new URL(request.url)
    const endpoint = url.searchParams.get('endpoint')

    // Proxy mode: forward to sav2.fpb.pt API or WordPress AJAX
    const wpAction = url.searchParams.get('wp_action')
    if (endpoint || wpAction) {
        let apiUrl: string
        const headers: Record<string, string> = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'Accept': 'application/json',
        }

        if (wpAction) {
            if (wpAction === 'get_equipas') {
                const idCompeticao = url.searchParams.get('idCompeticao')
                const idClube = url.searchParams.get('idClube')
                if (idClube) {
                    const epoca = url.searchParams.get('epoca') || '2025/2026'
                    apiUrl = `https://www.fpb.pt/wp-admin/admin-ajax.php?action=get_equipas&idClube=${idClube}&epoca=${encodeURIComponent(epoca)}`
                } else {
                    apiUrl = `https://www.fpb.pt/wp-admin/admin-ajax.php?action=get_equipas&idCompeticao=${idCompeticao || ''}`
                }
                headers['Referer'] = 'https://www.fpb.pt/'
            } else {
                // WordPress AJAX: get_more_fase_regular
                const competicao = url.searchParams.get('competicao') || ''
                const fase = url.searchParams.get('fase') || '30969'
                apiUrl = `https://www.fpb.pt/wp-admin/admin-ajax.php?action=${wpAction}&competicao%5B%5D=${competicao}&fase=${fase}`
                headers['Referer'] = `https://www.fpb.pt/classificacao/${competicao}`
            }
        } else {
            apiUrl = `https://sav2.fpb.pt/api/${endpoint}`
        }

        const fpbRes = await fetch(apiUrl, { headers })
        const text = await fpbRes.text()

        if (fpbRes.status === 404) {
            return new Response('[]', {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, OPTIONS',
                    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
                },
            })
        }

        const contentType = fpbRes.headers.get('content-type') || 'application/json'
        return new Response(text, {
            status: fpbRes.status,
            headers: {
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
            },
        })
    }

    // HTML scraping mode (calendar, results, standings, stats, game detail)
    const page = url.searchParams.get('page') || 'calendario'
    const clube = url.searchParams.get('clube')
    const competicao = url.searchParams.get('competicao')
    const internalID = url.searchParams.get('internalID')

    let fpbUrl: string

    if (internalID) {
        fpbUrl = `https://www.fpb.pt/ficha-de-jogo?internalID=${internalID}`
    } else if (page === 'equipa') {
        // Individual team page: /equipa/equipa_59060/
        const equipaId = url.searchParams.get('equipa_id') || ''
        fpbUrl = `https://www.fpb.pt/equipa/${equipaId}/`
    } else if (page === 'equipas') {
        // Club teams page: /equipas/clube_127/ (no extra query params)
        const clubId = clube || '127'
        fpbUrl = `https://www.fpb.pt/equipas/clube_${clubId}/`
    } else if (competicao) {
        fpbUrl = `https://www.fpb.pt/${page}/${competicao}`
    } else {
        const clubId = clube || '119'
        const epoca = url.searchParams.get('epoca') || '2025/2026'
        fpbUrl = `https://www.fpb.pt/${page}/clube_${clubId}/?epoca=${epoca}&escalao=S%C3%A9nior&genero=masculino`
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    try {
        const fpbRes = await fetch(fpbUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml',
            },
            signal: controller.signal,
        })

        clearTimeout(timeout)

        if (!fpbRes.ok) {
            return new Response(JSON.stringify({ error: `FPB returned ${fpbRes.status}` }), {
                status: 502,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            })
        }

        const text = await fpbRes.text()

        return new Response(text, {
            status: 200,
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=60',
                'Access-Control-Allow-Origin': '*'
            }
        })
    } catch (err: any) {
        clearTimeout(timeout)
        const message = err?.name === 'AbortError' ? 'FPB request timed out' : 'Failed to fetch FPB'
        return new Response(JSON.stringify({ error: message }), {
            status: 502,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        })
    }
}
