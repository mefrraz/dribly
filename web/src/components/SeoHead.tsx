import { Helmet } from 'react-helmet-async'

interface SeoHeadProps {
    title: string
    description?: string
    image?: string
    url?: string
}

export function SeoHead({ title, description, image, url }: SeoHeadProps) {
    const fullTitle = title ? `${title} · Dribly` : 'Dribly — Basquetebol Português'
    const defaultDesc = 'Resultados, jogos e classificações de todos os clubes de basquetebol em Portugal. Grátis, rápido e sempre atualizado.'
    const baseUrl = 'https://dribly.pt'

    return (
        <Helmet>
            <title>{fullTitle}</title>
            <meta name="description" content={description || defaultDesc} />
            
            {/* Open Graph */}
            <meta property="og:title" content={fullTitle} />
            <meta property="og:description" content={description || defaultDesc} />
            <meta property="og:image" content={`${baseUrl}${image || '/logo.png'}`} />
            <meta property="og:url" content={`${baseUrl}${url || '/'}`} />
            
            {/* Twitter */}
            <meta name="twitter:title" content={fullTitle} />
            <meta name="twitter:description" content={description || defaultDesc} />
            <meta name="twitter:image" content={`${baseUrl}${image || '/logo.png'}`} />
        </Helmet>
    )
}