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
| `geocode-pavilions.ts` | `web/scripts/` | Geocodifica moradas de pavilhões (Google Maps API) |
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
- ALL CAPS → Title Case
- Abreviaturas expandidas (`Mun.` → `Municipal`, `Pav.` → `Pavilhão`)
- Acentos e erros ortográficos corrigidos
- Prefixos em falta adicionados

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
- Processa ~400 pavilhões em 10 batches
- Só envia ao AI nomes com problemas detetados (ALL CAPS, abreviaturas, etc.)

---

## 🎨 Cores dos clubes

### `extract-club-colors.ts`

Extrai a cor dominante do logo de cada clube usando `sharp` (processamento de imagem, sem AI).

```bash
cd web
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  npx tsx scripts/extract-club-colors.ts
```

Modo dry-run — mostra a cor extraída vs. a cor atual, mas não escreve nada.

### `apply-club-colors.ts`

Versão que aplica as cores + permite **overrides manuais** para clubes específicos.

Edita o objeto `OVERRIDES` no início do ficheiro para forçar cores específicas:

```typescript
const OVERRIDES: Record<number, string> = {
    127: '#C30000',   // Benfica — vermelho
    866: '#E67E22',   // Queluz — laranja
}
```

Depois corre:
```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  npx tsx scripts/apply-club-colors.ts
```

**Backup:** As cores antigas estão guardadas em `web/scripts/old-colors-backup.json`.

---

## 🗺️ Pavilhões

### `import-pavilions.ts`

Importa pavilhões de um ficheiro JSON para a tabela `pavilions`.

```bash
cd web
SUPABASE_URL=... SUPABASE_KEY=... \
  npx tsx scripts/import-pavilions.ts
```

Input: `scripts/pavilions_enriched.json` (gerado pelo `scrape-recintos.ts` + geocoding).

### `geocode-pavilions.ts`

Geocodifica moradas (rua + cidade) para coordenadas lat/lng usando Google Maps Geocoding API.

### `scrape-recintos.ts`

Faz scrape dos recintos/pavilhões a partir do site da FPB.

---

## 🏀 Scrapers principais

Estão na pasta `scrapers/` e são executados via GitHub Actions ou manualmente.

### `dribly-scraper.mjs`

CLI interativa com TUI para scrape de jogos. Abre um menu bonito no terminal.

```bash
node scrapers/dribly-scraper.mjs
```

Pede credenciais do Supabase (service_role key) e guia o utilizador.

### `scrape-clubs-full.js`

Scraper completo de clubes — metadata, logos, cores. Corre diariamente via GitHub Actions.

### `scrape-competitions.js`

Faz pre-warming de cache de competições — busca todas as competições ativas e guarda no Supabase.

---

## 🔄 GitHub Actions

Os scrapers correm automaticamente:

| Workflow | Frequência | Script |
|---|---|---|
| `scrape-daily.yml` | Diário (06:00 UTC) | `scrape-clubs-full.js` + `scrape-competitions.js` |
| `discover-competitions.yml` | Semanal | `discover-competitions.js` |
| `e2e-smoke.yml` | Manual | Playwright E2E |
| `regenerate-sitemap.yml` | Após scrape diário | `generate-sitemap.ts` |

---

## 🛠️ Como criar um novo script

1. Cria o ficheiro em `web/scripts/` (se usa Supabase/React) ou `scrapers/` (se é scraper standalone)
2. Usa `npx tsx` para Node.js/TypeScript — não precisa de compilação
3. Para scripts que escrevem na DB, usa sempre `SUPABASE_SERVICE_ROLE_KEY` (nunca a anon key)
4. Adiciona dry-run por default, `--apply` para escrever
5. Adiciona documentação aqui neste ficheiro

### Template rápido:

```typescript
const APPLY = process.argv.includes('--apply')

async function main() {
  // 1. Fetch data
  // 2. Process
  // 3. If APPLY → write to Supabase; else → print preview
  console.log(APPLY ? 'Applying...' : 'Dry-run. Use --apply to write.')
}

main().catch(err => { console.error(err); process.exit(1) })
```
