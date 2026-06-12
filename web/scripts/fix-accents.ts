/**
 * Fix UTF-8 double-encoded characters in recintos_com_morada.json.
 * The scraper wrote garbled chars like "PÃ³voa" instead of "Póvoa".
 * 
 * Run: npx tsx web/scripts/fix-accents.ts
 */
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const INPUT = path.join(__dirname, '..', '..', 'scripts', 'recintos_com_morada.json')
const OUTPUT = path.join(__dirname, '..', '..', 'scripts', 'recintos_com_morada.json')

// Common Windows-1252 → UTF-8 double-encoding patterns
const FIXES: [string, string][] = [
    ['Ã¡', 'á'], ['Ã ', 'à'], ['Ã£', 'ã'], ['Ã³', 'ó'],
    ['Ãµ', 'õ'], ['Ã©', 'é'], ['Ãª', 'ê'], ['Ã§', 'ç'],
    ['Ãº', 'ú'], ['Ã', 'Á'], ['Ã€', 'À'], ['Ã"', 'Â'],
    ['Ã', 'í'], ['Ã', 'Í'], ['Ã³', 'ó'], ['Ã"', 'Ô'],
    ['Ã¼', 'ü'], ['Ã¹', 'ù'], ['Ã±', 'ñ'],
    // Specific city names
    ['GuifÃµes', 'Guifões'],
    ['PÃ³voa', 'Póvoa'],
    ['PortimÃ£o', 'Portimão'],
    ['SetÃºbal', 'Setúbal'],
    ['TÃ¡bua', 'Tábua'],
    ['BraganÃ§a', 'Bragança'],
    ['Ãbidos', 'Óbidos'],
    ['BaiÃ£o', 'Baião'],
    ['ApÃºlia', 'Apúlia'],
    ['RibeirÃ£o', 'Ribeirão'],
    ['GrijÃ³', 'Grijó'],
    ['Oliveira de AzemÃ©is', 'Oliveira de Azeméis'],
    ['LeÃ§a', 'Leça'],
    ['ArdegÃ£es', 'Ardegães'],
]

function fixText(s: string | null): string | null {
    if (!s) return s
    let result = s
    for (const [bad, good] of FIXES) {
        result = result.replaceAll(bad, good)
    }
    return result
}

async function main() {
    const data = JSON.parse(fs.readFileSync(INPUT, 'utf-8'))
    let fixed = 0

    for (const r of data) {
        const origNome = r.nome
        const origRua = r.rua
        const origCidade = r.cidade

        r.nome = fixText(r.nome)
        r.rua = fixText(r.rua)
        r.cidade = fixText(r.cidade)

        if (r.nome !== origNome || r.rua !== origRua || r.cidade !== origCidade) {
            fixed++
            console.log(`  Fixed: ${origNome} → ${r.nome}`)
        }
    }

    fs.writeFileSync(OUTPUT, JSON.stringify(data, null, 2), 'utf-8')
    console.log(`\n✅ Fixed ${fixed} entries. Saved to ${OUTPUT}`)
}
main()
