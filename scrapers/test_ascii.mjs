// Test script: convert a PNG logo to ASCII
// Usage: node test_ascii.mjs <url>
import { createRequire } from 'module'
import { resolve, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
const __dirname = dirname(fileURLToPath(import.meta.url))
const req = createRequire(pathToFileURL(resolve(__dirname, '..', '.dribly-deps', 'package.json')).href)
const { execSync } = req('child_process')
try {
    req.resolve('pngjs')
} catch {
    console.log('Installing pngjs...')
    execSync('npm install pngjs', { cwd: resolve(__dirname, '..', '.dribly-deps'), stdio: 'inherit' })
}

const { PNG } = req('pngjs')

const url = process.argv[2] || 'https://sav2.fpb.pt/uploads/clubes/logotipo/2010_Odisseia_Basket_Clube1639588149.png'
console.log('Fetching:', url)
const res = await fetch(url)
if (!res.ok) { console.error('Fetch failed:', res.status); process.exit(1) }
const buffer = Buffer.from(await res.arrayBuffer())

const png = PNG.sync.read(buffer)
console.log(`Image: ${png.width}x${png.height}`)

// Resize to ~40 chars wide
const w = 40
const h = Math.round(w * (png.height / png.width) * 0.5)
const chars = ' .:-=+*#%@'

// Sample pixels
const result = []
for (let y = 0; y < h; y++) {
    let line = ''
    for (let x = 0; x < w; x++) {
        const srcX = Math.floor(x * png.width / w)
        const srcY = Math.floor(y * png.height / h)
        const idx = (png.width * srcY + srcX) << 2
        const r = png.data[idx]
        const g = png.data[idx + 1]
        const b = png.data[idx + 2]
        const a = png.data[idx + 3]
        if (a < 128) {
            line += ' '
        } else {
            const brightness = 0.299 * r + 0.587 * g + 0.114 * b
            const ci = Math.floor(brightness / 255 * (chars.length - 1))
            line += chars[Math.min(ci, chars.length - 1)]
        }
    }
    result.push(line)
}

console.log('\nASCII output:')
console.log('\x1b[35m' + result.join('\n') + '\x1b[0m')
console.log('\n✅ PNG parsed OK!')
