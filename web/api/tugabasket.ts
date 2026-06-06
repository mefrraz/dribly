export const config = {
    runtime: 'edge',
}

export default async function handler(request: Request) {
    const url = new URL(request.url)
    const path = url.searchParams.get('path') || '/'

    const tugabasketUrl = new URL(path, 'https://resultados.tugabasket.com')
    url.searchParams.forEach((value, key) => {
        if (key !== 'path') tugabasketUrl.searchParams.set(key, value)
    })

    try {
        const res = await fetch(tugabasketUrl.toString(), {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        })
        const text = await res.text()
        return new Response(text, {
            status: res.status,
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=60'
            }
        })
    } catch {
        return new Response(JSON.stringify({ error: 'Failed to fetch tugabasket' }), {
            status: 502,
            headers: { 'Content-Type': 'application/json' }
        })
    }
}
