/**
 * Generates a full sitemap.xml including ALL discoverable pages from Supabase.
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

const BASE = 'https://dribly.pt'

function url(loc: string, changefreq: string, priority: string): string {
    return `  <url>
    <loc>${loc}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`
}

async function main() {
    console.log('🔍 Fetching data from Supabase...')

    // ── Static pages ──
    const staticUrls = [
        url(`${BASE}/`, 'daily', '1.0'),
        url(`${BASE}/clubes`, 'weekly', '0.8'),
        url(`${BASE}/ligas`, 'weekly', '0.8'),
        url(`${BASE}/classificacoes`, 'daily', '0.7'),
        url(`${BASE}/mapa`, 'weekly', '0.6'),
        url(`${BASE}/pesquisa`, 'weekly', '0.5'),
        url(`${BASE}/sobre`, 'monthly', '0.4'),
        url(`${BASE}/privacidade`, 'monthly', '0.3'),
        url(`${BASE}/instalar`, 'monthly', '0.3'),
    ]

    // ── Clubs (281+) ──
    const { data: clubs } = await supabase
        .from('clubs')
        .select('slug, priority')
        .order('priority', { ascending: true, nullsFirst: false })

    const clubUrls = (clubs || []).map((c: { slug: string; priority: number | null }) =>
        url(`${BASE}/clube/${c.slug}/home`, 'weekly', c.priority ? '0.7' : '0.5')
    )
    console.log(`  ✅ ${clubUrls.length} clubes`)

    // ── Competitions (50+) ──
    const { data: comps } = await supabase
        .from('competitions')
        .select('competition_id, association_id')
        .eq('season', '2025/2026')

    const compUrls = (comps || []).map((c: { competition_id: number }) =>
        url(`${BASE}/competicao/${c.competition_id}`, 'daily', '0.6')
    )
    console.log(`  ✅ ${compUrls.length} competições`)

    // ── Games (current season) ──
    const { data: games } = await supabase
        .from('games_2025_2026')
        .select('slug')
        .limit(5000)

    const gameUrls = (games || []).map((g: { slug: string }) =>
        url(`${BASE}/jogo/${g.slug}`, 'weekly', '0.5')
    )
    console.log(`  ✅ ${gameUrls.length} jogos`)

    // ── Pavilions (400+) ──
    const { data: pavs } = await supabase
        .from('pavilions')
        .select('recinto_id')
        .not('recinto_id', 'is', null)
        .order('recinto_id')

    // Deduplicate recinto_id
    const seenPav = new Set<number>()
    const pavUrls: string[] = []
    for (const p of (pavs || []) as { recinto_id: number }[]) {
        if (!seenPav.has(p.recinto_id)) {
            seenPav.add(p.recinto_id)
            pavUrls.push(url(`${BASE}/pavilhao/${p.recinto_id}`, 'monthly', '0.4'))
        }
    }
    console.log(`  ✅ ${pavUrls.length} pavilhões`)

    // ── Associations + phases ──
    const assocIds = new Set<number>()
    const phaseUrls: string[] = []
    for (const c of (comps || []) as { competition_id: number; association_id: number }[]) {
        if (c.association_id && !assocIds.has(c.association_id)) {
            assocIds.add(c.association_id)
            phaseUrls.push(url(`${BASE}/classificacoes/${c.association_id}`, 'weekly', '0.6'))
        }
        if (c.association_id) {
            phaseUrls.push(url(`${BASE}/classificacoes/${c.association_id}/${c.competition_id}`, 'daily', '0.6'))
        }
    }
    console.log(`  ✅ ${assocIds.size} associações com ${phaseUrls.length} fases`)

    // ── Athletes — from game detail internal IDs (top 100 recent games) ──
    // Athlete IDs come from FPB scraping, not stored in Supabase.
    // We include a note that athlete pages are discoverable via game pages.
    const athleteUrls: string[] = []
    console.log(`  ⚠️  ${athleteUrls.length} atletas (não disponíveis no Supabase — descobertos via páginas de jogos)`)

    // ── Assemble ──
    const allUrls = [
        ...staticUrls,
        ...clubUrls,
        ...compUrls,
        ...gameUrls,
        ...pavUrls,
        ...phaseUrls,
        ...athleteUrls,
    ]

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.join('\n')}
</urlset>
`

    const outPath = join(__dirname, '..', 'public', 'sitemap.xml')
    writeFileSync(outPath, xml, 'utf-8')
    console.log(`\n📄 Sitemap written to public/sitemap.xml (${allUrls.length} total URLs)`)
}

main().catch(err => {
    console.error('Failed to generate sitemap:', err)
    process.exit(1)
})
