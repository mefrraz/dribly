# Scripts da Dribly

Coleção de scripts utilitários para manutenção, limpeza e extração de dados. Todos correm com `npx tsx` a partir de `web/` ou `scrapers/`.

---

## 📋 Índice

| Script | Pasta | O que faz |
|---|---|---|
| `clean-pavilion-names.ts` | `web/scripts/` | Limpa nomes de pavilhões com AI (NVIDIA NIM, grátis) |
| `extract-club-colors.ts` | `web/scripts/` | Extrai cor dominante dos logos dos clubes (sharp, dry-run) |
| `apply-club-colors.ts` | `web/scripts/` | Aplica cores extraídas + overrides manuais |
| `generate-sitemap.ts` | `web/scripts/` | Gera `sitemap.xml` a partir dos clubes na DB |
| `geocode-pavilions.ts` | `web/scripts/` | Geocodifica moradas (Nominatim, multi-strategy, batch) |
| `geocode-missing-pavilions.ts` | `web/scripts/` | Geocodifica só pavilhões sem coordenadas (Supabase → Nominatim) |
| `import-pavilions.ts` | `web/scripts/` | Importa pavilhões de JSON para Supabase |
| `scrape-recintos.ts` | `web/scripts/` | Scrape de recintos/pavilhões do site da FPB |
| `dribly-scraper.mjs` | `scrapers/` | CLI interativa para scrape de jogos |
| `discover-competitions.js` | `scrapers/` | Descobre novas competições na FPB |
| `scrape-clubs-full.js` | `scrapers/` | Scraper completo de clubes da FPB |
| `scrape-competitions.js` | `scrapers/` | Scraper de competições + pre-warming de cache |

---

## 🧹 Limpeza de dados

### `clean-pavilion-names.ts`

Usa **NVIDIA NIM** (Llama 3.1 8B, **grátis**) para corrigir nomes de pavilhões:
- ALL CAPS → Title Case (ex: `PAVILHÃO MUNICIPAL DE TONDELA` → `Pavilhão Municipal de Tondela`)
- Abreviaturas expandidas (`Mun.` → `Municipal`, `Pav.` → `Pavilhão`, `Gimn.` → `Ginásio`)
- Acentos corrigidos (`PAVILHAO` → `Pavilhão`)
- Prefixos em falta adicionados
- Conservador: só envia ao AI nomes com problemas detetados

```bash
cd web

# Ver o que vai mudar (sem escrever)
NVIDIA_API_KEY=nvapi-... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  npx tsx scripts/clean-pavilion-names.ts

# Aplicar
NVIDIA_API_KEY=nvapi-... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  npx tsx scripts/clean-pavilion-names.ts --apply
```

- Chave NVIDIA gratuita: https://build.nvidia.com/explore/discover
- Processa ~400 pavilhões em 10 batches de 20
- Custo: $0 (NVIDIA NIM free tier)
- Auto-confirma em modo pipe (CI/CD)

---

## 🎨 Cores dos clubes

### `extract-club-colors.ts`

Extrai a cor dominante do logo de cada clube usando `sharp` (processamento de imagem, sem AI).

**Como funciona:**
1. Descarrega o logo (URL do Supabase)
2. Redimensiona para 50×50
3. Remove branco, preto e cinza (cores de fundo)
4. Quantifica as cores restantes (agrupa por proximidade)
5. Escolhe a cor com maior score = frequência × saturação

```bash
cd web
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  npx tsx scripts/extract-club-colors.ts
```

Modo dry-run — mostra cor extraída vs. cor atual com swatches coloridos, não escreve nada.

### `apply-club-colors.ts`

Aplica as cores extraídas + permite **overrides manuais** para clubes específicos.

```typescript
// Edita no início do ficheiro:
const OVERRIDES: Record<number, string> = {
    127: '#C30000',   // Benfica — vermelho
    704: '#27AE60',   // Brandoense — verde
    866: '#E67E22',   // Queluz — laranja
    3419: '#E67E22',  // LMCB Linces — laranja
}
```

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  npx tsx scripts/apply-club-colors.ts
```

**Backup:** As cores antigas estão em `web/scripts/old-colors-backup.json` (295 clubes).

---

## 🗺️ Pavilhões

### `geocode-missing-pavilions.ts` ★ Novo

Geocodifica pavilhões que estão no Supabase **sem coordenadas** (lat IS NULL).
Usa Nominatim (OpenStreetMap, grátis) com 5 estratégias de fallback.
Opcional: AI (NVIDIA NIM) para limpar abreviaturas nas moradas.

```bash
cd web

# Dry-run (vê quantos consegue resolver)
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  npx tsx scripts/geocode-missing-pavilions.ts

# Com AI (melhores queries)
NVIDIA_API_KEY=nvapi-... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  npx tsx scripts/geocode-missing-pavilions.ts

# Aplicar
... npx tsx scripts/geocode-missing-pavilions.ts --apply
```

- ⚠️ AI (NVIDIA NIM) só limpa o texto da query — **nunca sugere coordenadas**
- Usa `rua`, `código_postal` e `cidade` para queries mais precisas
- 5 estratégias: morada completa → nome+cidade → prefixo "Pavilhão" → cidade → "Pavilhão Municipal"
- Rate limit: 1.2s entre pedidos (respeita termos do Nominatim)

### `geocode-pavilions.ts` (batch)

Geocodifica de ficheiro JSON local (batch). Já não é necessário se usares o script acima.

### `import-pavilions.ts`

Importa pavilhões de JSON para Supabase (upsert por `recinto_id`).

### `scrape-recintos.ts`

Faz scrape dos recintos/pavilhões a partir do site da FPB.

---

## 🏀 Scrapers

### `dribly-scraper.mjs`

CLI interativa com TUI bonita para scrape de jogos. Auto-instala dependências.

```bash
node scrapers/dribly-scraper.mjs
```

### `scrape-clubs-full.js`

Scraper completo de clubes — metadata, logos, cores. Corre diariamente via GitHub Actions.

### `scrape-competitions.js`

Pre-warming de cache de competições. Busca competições ativas e guarda no Supabase.

---

## 📊 Analytics & Tracking

### Page Views (`v10.7`)

Sistema de tracking de visitas sem dependências externas:

| Componente | Localização | Função |
|---|---|---|
| Beacon | `web/src/Layout.tsx` | Dispara 1x/dia por visitante |
| Tabela | `database/migrations/add_page_views.sql` | `page_views (date, count)` |
| RPC | `database/migrations/add_page_view_rpc.sql` | `increment_page_view()` — upsert atómico |
| API | `web/api/admin.ts` → `trackPageView` / `getPageViews` | Endpoints públicos |
| Dashboard | `web/src/pages/admin/Dashboard.tsx` | Gráfico de barras 30 dias + card "Visitas hoje" |

**Para ativar:** Corre as duas migrações SQL no Supabase.

---

## 🔄 GitHub Actions

| Workflow | Frequência | O que faz |
|---|---|---|
| `scrape-daily.yml` | Diário 06:00 UTC | Scrape clubes + competições + sitemap |
| `discover-competitions.yml` | Semanal | Descobre novas competições |
| `e2e-smoke.yml` | Manual | Playwright smoke tests |
| `regenerate-sitemap.yml` | Automático | Regenera sitemap após scrape |

---

## 🛠️ Como criar um novo script

1. Cria em `web/scripts/` (Supabase) ou `scrapers/` (standalone)
2. Usa `npx tsx` — sem compilação
3. `SUPABASE_SERVICE_ROLE_KEY` para writes (nunca a anon key)
4. Dry-run por default, `--apply` para escrever
5. Documenta aqui

### Template:

```typescript
const APPLY = process.argv.includes('--apply')

async function main() {
  const { data } = await supabase.from('tabela').select('*')
  // ... process ...
  if (APPLY) {
    for (const row of processed) {
      await supabase.from('tabela').update(row).eq('id', row.id)
    }
    console.log('✅ Applied!')
  } else {
    console.log('💡 Dry-run. Use --apply to write.')
  }
}

main().catch(err => { console.error(err); process.exit(1) })
```


