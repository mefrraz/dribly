import React from 'react'
import ReactDOM from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import App from './App.tsx'
import { SpeedInsights } from '@vercel/speed-insights/react'
import './index.css'
import 'leaflet/dist/leaflet.css'

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!clerkPubKey) {
    console.error("Missing VITE_CLERK_PUBLISHABLE_KEY — Clerk auth will not work")
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ClerkProvider
            publishableKey={clerkPubKey || ''}
            routerPush={(to) => {
                // Block clean redirects to our domain (infinite loop on sign-in)
                const isOwnDomain = to.startsWith('https://dribly.pt') || to.startsWith('/')
                if (isOwnDomain && !to.includes('__clerk')) return
                window.location.href = to
            }}
            routerReplace={(to) => {
                const isOwnDomain = to.startsWith('https://dribly.pt') || to.startsWith('/')
                if (isOwnDomain && !to.includes('__clerk')) return
                window.location.href = to
            }}
        >
            <App />
            <SpeedInsights />
        </ClerkProvider>
    </React.StrictMode>,
)
