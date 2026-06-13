import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'
import * as fs from 'fs'
import * as cheerio from 'cheerio'
import { z } from 'zod'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_KEY
const USER_AGENT = 'Mozilla/5.0 (compatible; Dribly-Bot/1.0)'

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_KEY in .env')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const clubSchema = z.object({
    id: z.number(),
    name: z.string().min(1),
    short_name: z.string(),
    color: z.string().regex(/^#[0-9a-fA-F]{3,6}$/),
    logo_url: z.string().nullable(),
    local: z.string(),
    region: z.string(),
})

async function main() {
    console.log('Fetching https://www.fpb.pt/clubes/ ...')
    const res = await fetch('https://www.fpb.pt/clubes/', {
        headers: { 'User-Agent': USER_AGENT }
    })
    if (!res.ok) {
        console.error('Failed to fetch clubs page:', res.status)
        process.exit(1)
    }
    const html = await res.text()
    const $ = cheerio.load(html)

    const rawClubs = []
    $('div.clube').each((_, el) => {
        const $el = $(el)
        const a = $el.find('a').first()
        const href = a.attr('href')
        const idMatch = href?.match(/\/calendario\/clube_(\d+)/)
        if (!idMatch) return
        
        const id = parseInt(idMatch[1], 10)
        const body = $el.find('.clube-body')
        const style = body.attr('style') || ''
        const colorMatch = style.match(/background-color:\s*(#[0-9a-fA-F]+)/)
        const color = colorMatch ? colorMatch[1] : '#000000'
        
        const img = body.find('img')
        const logo_url = img.attr('src') ? img.attr('src').trim() : null
        
        const short_name = body.find('.clube-shortname').text().trim()
        const name = body.find('.clube-name').text().trim()
        const local = body.find('.clube-local').text().trim()
        const region = body.find('.clube-region').text().trim()
        
        rawClubs.push({ id, name, short_name, color, logo_url, local, region })
    })

    console.log('Found ' + rawClubs.length + ' raw clubs')

    const clubs = []
    let validationErrors = 0
    for (const raw of rawClubs) {
        const result = clubSchema.safeParse(raw)
        if (result.success) {
            clubs.push(result.data)
        } else {
            validationErrors++
            if (validationErrors <= 3) {
                console.error('Validation error for club', raw.id, result.error.errors)
            }
        }
    }

    console.log('Validated ' + clubs.length + ' clubs (' + validationErrors + ' invalid)')

    const colorCounts = {}
    clubs.forEach(c => {
        colorCounts[c.color] = (colorCounts[c.color] || 0) + 1
    })
    console.log('Color distribution:')
    Object.entries(colorCounts).sort((a, b) => b[1] - a[1]).forEach(([color, count]) => {
        console.log('  ' + color + ': ' + count + ' clubs')
    })

    fs.writeFileSync('scraped_clubs.json', JSON.stringify(clubs, null, 2), 'utf8')
    console.log('Saved to scraped_clubs.json')

    // Fetch existing clubs to know which already have primary_color set
    const { data: existing } = await supabase.from('clubs').select('id, primary_color')
    const existingMap = new Map((existing || []).map(c => [c.id, c.primary_color]))
    console.log(`Found ${existingMap.size} existing clubs in Supabase`)

    let updated = 0
    let errors = 0
    let colorPreserved = 0
    for (const club of clubs) {
        const color = club.color
        const isBlack = color === '#000000' || color === '#000'
        const existingColor = existingMap.get(club.id)

        const updateData = {
            id: club.id,
            name: club.name,
            search_name: club.name.toLowerCase().replace(/[^a-z0-9]/g, ''),
            slug: club.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        }

        // Only set primary_color for NEW clubs or clubs with black/null color
        if (existingColor && existingColor !== '#7C3AED') {
            // Club already has a good extracted color — preserve it
            updateData.primary_color = existingColor
            colorPreserved++
        } else if (!existingColor || existingColor === '#7C3AED') {
            // New club or fallback-purple — set from FPB (or purple for black)
            updateData.primary_color = isBlack ? '#7C3AED' : color
        }

        // Always update logo_url from FPB
        updateData.logo_url = club.logo_url

        const result = await supabase.from('clubs').upsert(updateData, { onConflict: 'id' })
        if (result.error) {
            errors++
            if (errors <= 3) console.error('  Error upserting ' + club.id + ': ' + result.error.message)
        } else {
            updated++
        }
    }

    console.log(`Supabase update: ${updated} upserted, ${errors} errors, ${colorPreserved} colors preserved`)
}

main()