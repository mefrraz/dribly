export default function middleware(request: Request) {
    const url = new URL(request.url)
    
    if (url.pathname.startsWith('/api/bounce/')) {
        const key = process.env.BOUNCE_API_KEY
        if (key) {
            const newHeaders = new Headers(request.headers)
            newHeaders.set('X-Bounce-Key', key)
            return new Request(request, { headers: newHeaders })
        }
    }
}
