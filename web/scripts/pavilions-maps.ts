/**
 * Generate Google Maps links for all pavilions (from recintos_com_morada.json).
 * Run: npx tsx web/scripts/pavilions-maps.ts > pavilhoes_maps.txt
 */
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const INPUT = path.join(__dirname, '..', '..', 'scripts', 'recintos_com_morada.json')

interface Recinto {
    recinto_id: number
    nome: string
    rua: string | null
    codigo_postal: string | null
    cidade: string | null
}

async function main() {
    if (!fs.existsSync(INPUT)) {
        console.error('recintos_com_morada.json not found. Run scrape-recintos.ts first.')
        process.exit(1)
    }

    const recintos: Recinto[] = JSON.parse(fs.readFileSync(INPUT, 'utf-8'))

    for (const r of recintos) {
        // Build query: name + address
        const parts = [r.nome]
        if (r.rua) parts.push(r.rua)
        if (r.cidade) parts.push(r.cidade)
        const query = parts.join(', ')

        const link = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
        console.log(link)
    }
}
main()
