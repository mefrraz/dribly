/**
 * Generates a full sitemap.xml including all clubs and competitions from Supabase.
 *
 * Usage:  npx tsx scripts/generate-sitemap.ts
 *
 * Requires: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in web/.env
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

interface Club { slug: string; name: string; priority: number | null }
interface Competition { competition_id: number; competition_name: string }

const BASE = 'https://dribly.pt'

function url(loc: string, changefreq: string, priority: string): string {
    return `  <url>
    <loc>${loc}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`
}

async function main() {
    // Static pages
    const staticUrls = [
        url(`${BASE}/`, 'daily', '1.0'),
        url(`${BASE}/clubes`, 'weekly', '0.8'),
        url(`${BASE}/ligas`, 'weekly', '0.8'),
        url(`${BASE}/classificacoes`, 'daily', '0.7'),
        url(`${BASE}/mapa`, 'weekly', '0.6'),
        url(`${BASE}/pesquisa`, 'weekly', '0.5'),
        url(`${BASE}/sobre`, 'monthly', '0.4'),
        url(`${BASE}/instalar`, 'monthly', '0.3'),
    ]

    // Fetch clubs
    const { data: clubs } = await supabase
        .from('clubs')
        .select('slug, name, priority')
        .order('priority', { ascending: true, nullsFirst: false })

    const clubUrls = (clubs || []).map((c: Club) =>
        url(`${BASE}/clube/${c.slug}/home`, 'weekly', c.priority ? '0.7' : '0.5')
    )

    // Fetch competitions
    const { data: comps } = await supabase
        .from('competitions')
        .select('competition_id, competition_name')
        .eq('season', '2025/2026')

    const compUrls = (comps || []).map((c: Competition) =>
        url(`${BASE}/competicao/${c.competition_id}`, 'daily', '0.6')
    )

    const allUrls = [...staticUrls, ...clubUrls, ...compUrls]

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.join('\n')}
</urlset>
`

    const outPath = join(__dirname, '..', 'public', 'sitemap.xml')
    writeFileSync(outPath, xml, 'utf-8')
    console.log(`✅ Sitemap written to public/sitemap.xml (${allUrls.length} URLs)`)
}

main().catch(err => {
    console.error('Failed to generate sitemap:', err)
    process.exit(1)
})
