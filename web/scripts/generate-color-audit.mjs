/**
 * Generates a static HTML page showing all clubs with logo + accent color.
 * Open in browser to visually verify which colors are wrong.
 *
 * Usage: node scripts/generate-color-audit.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'public', 'color-audit.html')

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
)

const { data } = await supabase
    .from('clubs')
    .select('id, name, slug, logo_url, primary_color')
    .order('name')

if (!data) { console.error('No clubs found'); process.exit(1) }

const cards = data.map(c => {
    const color = c.primary_color || '#7C3AED'
    // Compute luminance to pick white/black text
    const hex = color.replace('#', '')
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    const textColor = lum > 0.55 ? '#111' : '#fff'

    return `<div class="card" style="background:${color};color:${textColor}">
    <div class="logo-wrap">
        ${c.logo_url ? `<img src="${c.logo_url}" alt="" loading="lazy" onerror="this.style.display='none'">` : ''}
    </div>
    <div class="info">
        <div class="name">${c.name}</div>
        <div class="hex">${color}</div>
    </div>
</div>`
}).join('\n')

const html = `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Dribly — Color Audit (${data.length} clubes)</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;background:#0d0d14;color:#eee;padding:16px}
h1{font-size:20px;margin-bottom:4px}
.sub{font-size:12px;color:#888;margin-bottom:16px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}
.card{border-radius:12px;padding:16px;display:flex;flex-direction:column;align-items:center;gap:10px;min-height:160px;justify-content:center;transition:transform .15s,box-shadow .15s}
.card:hover{transform:scale(1.03);box-shadow:0 8px 30px rgba(0,0,0,.5);z-index:1}
.logo-wrap{width:64px;height:64px;border-radius:12px;background:rgba(255,255,255,.12);display:flex;align-items:center;justify-content:center;overflow:hidden}
.logo-wrap img{max-width:100%;max-height:100%;object-fit:contain}
.info{text-align:center}
.name{font-size:12px;font-weight:600;line-height:1.3;opacity:.9}
.hex{font-size:11px;font-family:monospace;opacity:.7;margin-top:2px}
</style>
</head>
<body>
<h1>🎨 Dribly Color Audit</h1>
<div class="sub">${data.length} clubes — cada card usa a <code>primary_color</code> como fundo</div>
<div class="grid">
${cards}
</div>
</body>
</html>`

writeFileSync(OUT, html, 'utf-8')
console.log(`✅ Written ${data.length} clubs to ${OUT}`)
