<p align="center">
  <img src="web/public/logo.svg" alt="Dribly" width="120" height="120" />
</p>

<h1 align="center">Dribly<span style="color:#7C3AED">.</span></h1>

<p align="center">
  <b>Basquetebol português no teu bolso</b>
  <br />
  App web (PWA) gratuita e open-source para acompanhar todos os clubes de basquetebol registados na Federação Portuguesa de Basquetebol (FPB)
</p>

<p align="center">
  <a href="https://dribly.pt">
    <img src="https://img.shields.io/badge/dribly.pt-7C3AED?style=for-the-badge&logo=vercel&logoColor=white" alt="Website" />
  </a>
  <a href="https://github.com/mefrraz/dribly">
    <img src="https://img.shields.io/badge/AGPLv3-7C3AED?style=for-the-badge&label=license" alt="AGPLv3" />
  </a>
  <a href="https://github.com/mefrraz/dribly/stargazers">
    <img src="https://img.shields.io/github/stars/mefrraz/dribly?style=for-the-badge&color=7C3AED" alt="Stars" />
  </a>
</p>

> **v7.18.0** — 🛠️ Estabilização: backend, scraper, SEO, a11y, CI/CD · [dribly.pt](https://dribly.pt)

---

## 🎯 Objetivo

O Dribly nasceu da frustração de não existir uma plataforma única, rápida e mobile-first para acompanhar o basquetebol português.

| Problema | Solução Dribly |
|---|---|
| Site da FPB pesado e sem otimização mobile | App PWA leve e responsiva |
| Swish pago e focado numa competição | **100% gratuito**, multi-competição |
| TugaBasket desktop-only | **Mobile-first**, instalável como app |

---

## ✨ Funcionalidades

| Funcionalidade | Versão | Detalhes |
|---|---|---|
| 🔍 **Pesquisa de clubes** | v1.0 | 281 clubes com cores, logos, pesquisa fuzzy |
| 📅 **Jogos e agenda** | v1.0 | Calendário, resultados, fichas de jogo detalhadas |
| 🏆 **Classificações** | v3.3 | Tabelas via WordPress AJAX com J, V, D, PM, PS, DIF, PTS |
| 📊 **Estatísticas individuais** | v3.4 | 22 campos — PTS, REB, AST, VAL, %L2, %L3, %LL |
| ❤️ **Seguir clubes/ligas** | v3.4 | Página dedicada "Seguidos", botão Heart nos clubes |
| 🌓 **Modo claro/escuro** | v1.0 | Transição suave |
| 📱 **PWA instalável** | v1.2 | Instala como app nativa |
| 🔌 **Offline parcial** | v3.0 | Service Worker + cache inteligente |
| 🗺️ **Mapa de pavilhões** | v6.0 | Mapa interativo com 400+ pavilhões, jogos perto de ti |
| 🛠️ **CI/CD scraper automático** | v7.2 | GitHub Action diária para manter dados frescos |
| 🧪 **Testes unitários** | v7.6 | Vitest com lógica de parsing testável |
| 🔍 **SEO dinâmico** | v7.15 | Meta tags por página, robots.txt, sitemap |
| ♿ **Acessibilidade** | v7.16 | Alt text, breadcrumbs, indicadores de scroll acessíveis |
| 🛡️ **ErrorBoundary global** | v7.9 | Fallback amigável em vez de ecrã branco |
| ⚡ **Pre-warming de cache** | v7.12 | Dados pré-carregados antes do pico de utilização |
| 🎨 **Tema dinâmico** | v2.9 | Cada clube com accent color própria |
| 🎯 **Tour onboarding** | v3.3 | Tour guiado ao criar conta |
| 💡 **Sugestões pós-registo** | v3.3 | Sugestões de clubes/ligas na 1ª vez |
| 🔐 **Contas email/password** | v5.0 | Login + registo com username único (Clerk) |
| 🔑 **Recuperar palavra-passe** | v5.0 | Email com código de 6 dígitos |
| 👤 **Perfil completo** | v5.0 | Editar username, nome, bio, mudar password |
| 🔒 **Sessões ativas** | v5.0 | Ver e terminar sessões remotas |
| 🗑️ **Apagar conta** | v5.0 | Auto-remoção com confirmação |
| 🌍 **Domínio próprio** | v5.0 | [dribly.pt](https://dribly.pt) |
| 🎨 **Novo logo** | v5.0 | Logo Dribly atualizado |

---

## 📊 Comparação

<table>
  <thead>
    <tr>
      <th>Funcionalidade</th>
      <th align="center">Dribly</th>
      <th align="center">FPB</th>
      <th align="center">Swish</th>
      <th align="center">TugaBasket</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>Mobile-first</td><td align="center">✅</td><td align="center">✅</td><td align="center">✅</td><td align="center">❌</td></tr>
    <tr><td>PWA instalável</td><td align="center">✅</td><td align="center">❌</td><td align="center">✅</td><td align="center">❌</td></tr>
    <tr><td>Open Source</td><td align="center">✅</td><td align="center">❌</td><td align="center">❌</td><td align="center">❌</td></tr>
    <tr><td>Gratuito</td><td align="center">✅</td><td align="center">✅</td><td align="center">❌</td><td align="center">✅</td></tr>
    <tr><td>Multi-clube</td><td align="center">✅</td><td align="center">✅</td><td align="center">⚠️</td><td align="center">❌</td></tr>
    <tr><td>Multi-escalão</td><td align="center">✅</td><td align="center">✅</td><td align="center">⚠️</td><td align="center">❌</td></tr>
    <tr><td>Offline parcial</td><td align="center">✅</td><td align="center">❌</td><td align="center">❌</td><td align="center">❌</td></tr>
    <tr><td>Ficha de jogo detalhada</td><td align="center">✅</td><td align="center">✅</td><td align="center">✅</td><td align="center">❌</td></tr>
    <tr><td>Estatísticas individuais</td><td align="center">✅</td><td align="center">✅</td><td align="center">✅</td><td align="center">❌</td></tr>
    <tr><td>Contas / Seguir clubes</td><td align="center">✅</td><td align="center">❌</td><td align="center">✅</td><td align="center">❌</td></tr>
    <tr><td>Perfil + Segurança</td><td align="center">✅</td><td align="center">❌</td><td align="center">❌</td><td align="center">❌</td></tr>
  </tbody>
</table>

## 📈 Rate Limits

Testámos os limites das fontes externas com 1000+ pedidos consecutivos para planear a frequência do scraping:

| Fonte | Rate Limit? | Latência média | Pedidos seguros/dia |
|---|---|---|---|
| **FPB `/clubes/`** | ❌ Nenhum | ~0.06s | Ilimitados |
| **FPB `/calendario/`** | ❌ Nenhum | ~0.30s | Ilimitados |
| **TugaBasket** | ❌ Nenhum | ~0.02s | Ilimitados |

**Conclusão:** Nenhuma das fontes impõe rate limits. O scraper atual faz ~7 pedidos/dia — bem abaixo de qualquer limite que pudesse existir.

Para testares tu próprio:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/rate-limit-test.ps1
powershell -ExecutionPolicy Bypass -File scripts/rate-limit-test.ps1 -RequestsPerSecond 10 -TotalRequests 100
```

---

## 🛠️ Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + TypeScript |
| Build | Vite 5 |
| Estilos | Tailwind CSS 3 |
| Auth | Clerk (email/password, username único, recuperação de password) |
| Base de dados | Supabase (PostgreSQL) |
| Deploy | Vercel (Edge Functions) |
| Cache local | localStorage + Service Worker |
| API externa | FPB + TugaBasket (scraping HTML + WordPress AJAX) |
| PWA | vite-plugin-pwa (Workbox) |

---

## 🏗️ Estrutura

```
web/
├── src/
│   ├── lib/
│   │   ├── fpbApi.ts               # Parser HTML FPB (clubes)
│   │   ├── fpbCompetitionsApi.ts   # Parser HTML + WordPress AJAX (competições)
│   │   ├── tugabasketApi.ts        # Parser TugaBasket
│   │   ├── ClubContext.tsx          # Estado global clubes
│   │   ├── AuthContext.tsx          # Autenticação Clerk (useAuth, TokenProvider)
│   │   └── supabase.ts             # Cliente Supabase (DB + RLS via Clerk JWT)
│   ├── hooks/
│   │   ├── useGames.ts             # Jogos com cache
│   │   ├── useStandings.ts         # Classificações com cache
│   │   └── useFollows.ts           # Seguir clubes/liga (DB + RLS)
│   ├── components/
│   │   ├── AuthModal.tsx           # Login / Criar conta / Recuperar password
│   │   ├── OnboardingTour.tsx       # Tour guiado pós-registo
│   │   ├── PostOnboardingSuggestions.tsx # Sugestões iniciais
│   │   ├── GameCard.tsx             # Cartão de jogo reutilizável
│   │   └── SegmentControl.tsx       # Navegação por tabs
│   └── pages/
│       ├── Landing.tsx              # Página inicial
│       ├── CompetitionDetail.tsx    # Detalhe competição (classif/jogos/stats)
│       ├── club/ClubHome.tsx        # Página do clube
│       ├── club/ClubGames.tsx       # Jogos do clube
│       ├── Game.tsx                 # Ficha de jogo detalhada
│       ├── Following.tsx           # Seguidos (clubes + ligas)
│       └── ProfilePage.tsx         # Perfil, password, sessões, apagar conta
├── api/
│   ├── fpb.ts                      # Edge Function (proxy FPB)
│   └── tugabasket.ts               # Edge Function (proxy TugaBasket)
└── public/
    ├── logo.svg                    # Logo Dribly
    └── logo.png                    # Logo PWA
```

---

## ⚙️ Arquitetura Técnica

O Dribly é uma **SPA (Single Page Application)** sem backend próprio. Toda a lógica vive no browser ou em Edge Functions serverless na Vercel.

### Visão geral

```
Browser (React SPA)
    │
    ├── Clerk SDK ────────────► Clerk (Auth + sessões)
    │
    ├── Supabase SDK ─────────► Supabase (DB + follows)
    │
    ├── /api/* (Edge Funcs) ──► FPB / TugaBasket (scraping)
    │
    └── Service Worker ───────► Cache local (PWA offline)
```

### Autenticação (Clerk v4)

- **Email/password** — registo com username único validado pelo Clerk
- **Recuperação de password** — email com código de 6 dígitos + nova password
- **Perfil** — editar username, nome, bio, mudar password, ver sessões ativas, apagar conta
- **Tour onboarding** — guiado apenas ao criar conta

### Fontes de dados

- **FPB (www.fpb.pt)** — scraping HTML + WordPress AJAX
- **TugaBasket** — scraping HTML para estatísticas
- **Logos e cores** — mapeamento manual de 281 clubes

---

## 🚀 Setup Local

```bash
git clone https://github.com/mefrraz/dribly.git
cd dribly/web
npm install
npm run dev
```

Variáveis de ambiente (`web/.env`):

```env
VITE_SUPABASE_URL=https://[project].supabase.co
VITE_SUPABASE_ANON_KEY=[anon public key]
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...  # clerk.com → API Keys
```

---

## 📦 Deploy

```bash
git push origin main
```

A Vercel faz auto-deploy. Domínio: **[dribly.pt](https://dribly.pt)**.

---

## 🧪 Testes

O projeto tem **111 testes** em 14 ficheiros, cobrindo lógica de parsing, hooks, componentes React e utilitários.

```bash
cd web
npm test
```

Os testes correm automaticamente em cada deploy na Vercel. Se algum falhar, o build não publica.

### Cobertura

| Área | Ficheiros | Testes |
|---|---|---|
| Parsers FPB/TugaBasket | `fpbApi.test.ts`, `fpbCompetitionsApi.test.ts`, `tugabasketApi.test.ts`, `fetchStandings.test.ts` | 33 |
| Utilitários | `fpbUtils.test.ts`, `matchUtils.test.ts`, `clubSearch.test.ts` | 46 |
| Hooks React | `useGames.test.ts`, `useFollows.test.ts` | 7 |
| Componentes | `GameCard.test.tsx`, `ErrorBoundary.test.tsx`, `StandingsTable.test.tsx`, `Toast.test.tsx` | 20 |
| Contexto | `ClubContext.test.tsx` | 5 |

---

## 📜 Licença

GNU AGPLv3 — código aberto, copyleft para serviços web. [LICENSE](LICENSE)

---

<p align="center">
  <a href="https://dribly.pt">Abrir Dribly →</a>
  &nbsp;&nbsp;&nbsp;
  <a href="https://github.com/mefrraz/dribly">Código Fonte →</a>
</p>
