import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_KEY
const FPB_BASE = 'https://www.fpb.pt'
const USER_AGENT = 'Mozilla/5.0 (compatible; Dribly-Bot/1.0)'

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_KEY in .env')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function fetchClubLogo(clubId) {
    try {
        const url = `${FPB_BASE}/clube/clube_${clubId}/`
        const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
        if (!res.ok) return null
        const html = await res.text()

        // Look for the club logo in the page
        // FPB uses <img> tags in the club header. Common patterns:
        // 1. <img src="https://...logo..." class="..." alt="...">
        // 2. <div class="club-logo"> <img src="...">

        const imgRegex = /<img[^>]+src=["']([^"']*logo[^"']*)["'][^>]*>/i
        const logoMatch = html.match(imgRegex)
        if (logoMatch) {
            let logoUrl = logoMatch[1]
            if (logoUrl.startsWith('/')) logoUrl = FPB_BASE + logoUrl
            return logoUrl
        }

        // Fallback: try finding any image in the club header section
        const clubHeaderRegex = /<div[^>]*club[^>]*logo[^>]*>.*?<img[^>]+src=["']([^"']+)["'][^>]*>/is
        const headerMatch = html.match(clubHeaderRegex)
        if (headerMatch) {
            let logoUrl = headerMatch[1]
            if (logoUrl.startsWith('/')) logoUrl = FPB_BASE + logoUrl
            return logoUrl
        }

        return null
    } catch (err) {
        console.error(`  Error fetching logo for club ${clubId}:`, err.message)
        return null
    }
}

async function main() {
    console.log('Fetching clubs from Supabase...')
    const { data: clubs, error } = await supabase
        .from('clubs')
        .select('id, name, logo_url')
        .order('id')

    if (error) {
        console.error('Error fetching clubs:', error)
        process.exit(1)
    }

    console.log(`Found ${clubs.length} clubs. Scraping logos...\n`)

    let updated = 0
    let failed = 0

    for (const club of clubs) {
        // Skip if already has a logo
        if (club.logo_url && club.logo_url.trim()) {
            continue
        }

        console.log(`[${club.id}] ${club.name}...`)
        const logoUrl = await fetchClubLogo(club.id)

        if (logoUrl) {
            const { error: updateError } = await supabase
                .from('clubs')
                .update({ logo_url: logoUrl })
                .eq('id', club.id)

            if (updateError) {
                console.log(`  ✗ Update error: ${updateError.message}`)
                failed++
            } else {
                console.log(`  ✓ ${logoUrl.substring(0, 80)}`)
                updated++
            }
        } else {
            console.log(`  - No logo found`)
            failed++
        }

        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 200))
    }

    console.log(`\nDone. Updated: ${updated}, No logo: ${failed}`)
}

main()
