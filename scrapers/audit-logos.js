import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_KEY in .env')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function checkUrl(url) {
    try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000) // 5s timeout
        
        const response = await fetch(url, { 
            method: 'HEAD',
            signal: controller.signal 
        })
        clearTimeout(timeoutId)
        return response.ok
    } catch {
        return false
    }
}

async function main() {
    console.log('Fetching clubs with logos from Supabase...')
    const { data: clubs, error } = await supabase
        .from('clubs')
        .select('id, name, logo_url')
        .not('logo_url', 'is', null)

    if (error) {
        console.error('Failed to fetch clubs:', error.message)
        process.exit(1)
    }

    console.log(`Found ${clubs?.length || 0} clubs with logos. Auditing...`)

    let brokenCount = 0
    let fixedCount = 0

    for (const club of clubs || []) {
        if (!club.logo_url) continue

        const isValid = await checkUrl(club.logo_url)
        
        if (!isValid) {
            console.log(`[BROKEN] ${club.name} (${club.id}): ${club.logo_url}`)
            brokenCount++
            
            // Update to null to trigger frontend fallback
            const { error: updateError } = await supabase
                .from('clubs')
                .update({ logo_url: null })
                .eq('id', club.id)

            if (updateError) {
                console.error(`  Failed to update: ${updateError.message}`)
            } else {
                fixedCount++
                console.log(`  [FIXED] Set logo_url to null for fallback`)
            }
            
            // Rate limit friendly delay
            await new Promise(resolve => setTimeout(resolve, 200))
        } else {
            console.log(`[OK] ${club.name}`)
        }
    }

    console.log(`\nAudit complete.`)
    console.log(`Broken logos found: ${brokenCount}`)
    console.log(`Successfully updated to fallback: ${fixedCount}`)
}

main()