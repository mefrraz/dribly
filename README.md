<p align="center">
  <img src="web/public/logo.svg" alt="Dribly" width="100" height="100" />
</p>

<h1 align="center">Dribly<span style="color:#7C3AED">.</span></h1>

<p align="center">
  <b>Basquetebol português no teu bolso</b>
  <br />
  App gratuita e open-source para acompanhar todos os clubes e competições da Federação Portuguesa de Basquetebol
</p>

<p align="center">
  <a href="https://dribly.pt"><img src="https://img.shields.io/badge/dribly.pt-7C3AED?style=for-the-badge&logo=vercel&logoColor=white" alt="Website" /></a>
  <a href="https://github.com/mefrraz/dribly/blob/main/LICENSE"><img src="https://img.shields.io/badge/AGPLv3-7C3AED?style=for-the-badge&label=license" alt="AGPLv3" /></a>
  <a href="https://github.com/mefrraz/dribly/stargazers"><img src="https://img.shields.io/github/stars/mefrraz/dribly?style=for-the-badge&color=7C3AED" alt="Stars" /></a>
  <br/>
  <img src="https://img.shields.io/badge/tests-111%20passing-7C3AED" alt="Tests" />
  <img src="https://img.shields.io/badge/ESLint-0%20errors-7C3AED" alt="ESLint" />
  <img src="https://img.shields.io/badge/PRs-welcome-7C3AED" alt="PRs Welcome" />
</p>

> **v9** — 🛡️ Painel admin · 🔐 Client Trust 2FA · ✉️ Verificação email · ⚡ Speed Insights · CSP completo · [dribly.pt](https://dribly.pt)

---

<!-- TODO: substituir por screenshot real -->
<p align="center">
  <i>📱 Screenshots em breve — visita <a href="https://dribly.pt">dribly.pt</a> para ver a app em ação.</i>
</p>

---

## 🎯 Porquê o Dribly

O basquetebol português tem centenas de clubes e dezenas de competições, mas as plataformas disponíveis ou são pagas, ou desktop-only, ou limitadas a uma competição. O Dribly preenche essa lacuna com uma app 100% gratuita, mobile-first e open source.

| Funcionalidade | Dribly | FPB.pt | Swish | TugaBasket |
|---|---|---|---|---|
| Mobile-first | ✅ | ✅ | ✅ | ❌ |
| App instalável | ✅ | ❌ | ✅ | ❌ |
| **Open source** | ✅ | ❌ | ❌ | ❌ |
| **100% gratuito** | ✅ | ✅ | ❌ | ✅ |
| Multi-clube | ✅ | ✅ | ⚠️ | ❌ |
| Multi-escalão | ✅ | ✅ | ⚠️ | ❌ |
| Offline parcial | ✅ | ❌ | ❌ | ❌ |
| Ficha de jogo detalhada | ✅ | ✅ | ✅ | ❌ |
| Estatísticas individuais | ✅ | ✅ | ✅ | ❌ |
| Contas / Seguir clubes | ✅ | ❌ | ✅ | ❌ |
| Perfil + Segurança | ✅ | ❌ | ✅ | ❌ |
| Mapa de pavilhões | ✅ | ❌ | ❌ | ❌ |
| Pavilhões (detalhe) | ✅ | ✅ | ❌ | ❌ |

---

## ✨ Funcionalidades

### 🏀 Navegação e Clubes
| Funcionalidade | v | Descrição |
|---|---|---|
| 🔍 Pesquisa de clubes | 1.0 | 281 clubes, cores, logos, pesquisa fuzzy com acrónimos |
| ❤️ Seguir clubes/ligas | 3.4 | Página "Seguidos", botão Heart, sync localStorage↔Supabase |
| 🎨 Tema dinâmico por clube | 2.9 | Accent color própria de cada clube |
| 🎯 Tour onboarding | 3.3 | Guiado ao criar conta |
| 💡 Sugestões pós-registo | 3.3 | Clubes e ligas recomendados na 1ª visita |

### 📊 Dados e Estatísticas
| Funcionalidade | v | Descrição |
|---|---|---|
| 📅 Jogos e agenda | 1.0 | Calendário, resultados, fichas de jogo detalhadas |
| 🏆 Classificações | 3.3 | Tabelas com J, V, D, PM, PS, DIF, PTS |
| 📊 Estatísticas individuais | 3.4 | 22 campos — PTS, REB, AST, VAL, %L2, %L3, %LL |
| 🗺️ Mapa de pavilhões | 6.0 | Leaflet interativo com 400+ pavilhões, clustering, geolocalização |
| ⚡ Pre-warming de cache | 7.12 | Dados pré-carregados antes do pico de utilização |
| 🛠️ Scraper automático | 7.2 | GitHub Action diária para dados sempre frescos |

### 🔐 Conta e Personalização
| Funcionalidade | v | Descrição |
|---|---|---|
| 🌓 Modo claro/escuro | 1.0 | Transição suave, segue prefers-color-scheme |
| 📱 App instalável | 1.2 | App nativa no telemóvel (PWA) |
| 🔌 Offline parcial | 3.0 | Service Worker + cache inteligente |
| 🔐 Contas email/password | 5.0 | Login + registo com username único (Clerk) |
| ✉️ Verificação de email | 9.0 | Código de 6 dígitos enviado por email |
| 🔑 Recuperar password | 5.0 | Email com código de 6 dígitos |
| 🔐 Client Trust 2FA | 9.0 | Código email em novos dispositivos (Clerk) |
| 👤 Perfil completo | 5.0 | Editar username, nome, bio, mudar password |
| 🔒 Sessões ativas | 5.0 | Ver e terminar sessões remotas |
| 🗑️ Apagar conta | 5.0 | Auto-remoção com confirmação |
| 🛡️ Painel admin | 9.0 | Gerir clubes, users, jogos e competições |
| 🌍 Domínio próprio | 5.0 | [dribly.pt](https://dribly.pt) |

### 🛡️ Qualidade e Robustez
| Funcionalidade | v | Descrição |
|---|---|---|
| 🧹 ESLint 0 erros | 8.0 | Qualidade de código, zero `any` types |
| 🔒 Content-Security-Policy | 8.0 | Headers CSP no `vercel.json` contra XSS |
| ⚡ Speed Insights | 9.0 | Core Web Vitals reais em produção (Vercel) |
| 🎭 Testes E2E Playwright | 8.0 | Smoke tests: Landing, Clubes, Mapa |
| 🧪 Testes unitários | 7.6 | Vitest, 111 testes, gate no build |
| 🔍 SEO dinâmico | 7.15 | Meta tags por página, Open Graph, sitemap |
| ♿ Acessibilidade | 7.16 | `aria-label`, `role="dialog"`, breadcrumbs |
| 🛡️ ErrorBoundary global | 7.9 | Fallback amigável em vez de ecrã branco |

---

## 🚀 Quick Start

```bash
git clone https://github.com/mefrraz/dribly.git
cd dribly/web
npm install
npm run dev        # → http://localhost:5173
```

Cria um ficheiro `web/.env`:

```env
VITE_SUPABASE_URL=https://[project].supabase.co
VITE_SUPABASE_ANON_KEY=[anon public key]
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...    # clerk.com → API Keys
```

```bash
npm test           # 111 testes
npm run lint:fix   # ESLint auto-fix
npm run build      # tsc + vitest + vite build
```

---

## 🛠️ Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + TypeScript (`strict: true`) |
| Build | Vite 6 |
| Estilos | Tailwind CSS 3 |
| Auth | Clerk (email/password, username único, password recovery) |
| Base de dados | Supabase (PostgreSQL + RLS via Clerk JWT) |
| Deploy | Vercel (Edge Functions, auto-deploy) |
| Cache | localStorage + Service Worker (Workbox) |
| Dados | FPB + TugaBasket (scraping HTML + WordPress AJAX) |
| Testes | Vitest + Playwright + jsdom |

---

## ⚙️ Arquitetura

O Dribly é uma **SPA sem backend próprio**. Toda a lógica vive no browser ou em Edge Functions serverless.

```
Browser (React SPA)
    │
    ├── Clerk SDK ────────────► Clerk (Auth + sessões)
    │
    ├── Supabase SDK ─────────► Supabase (DB + follows + RLS)
    │
    ├── /api/* (Edge Funcs) ──► FPB / TugaBasket (scraping)
    │
    └── Service Worker ───────► Cache local (PWA offline)
```

### Fontes de dados

| Fonte | Método | Conteúdo |
|---|---|---|
| **FPB** (`fpb.pt`) | HTML scraping + WordPress AJAX | Clubes, jogos, classificações, estatísticas |
| **TugaBasket** | HTML scraping | Estatísticas complementares |
| **Supabase** | PostgreSQL + RLS | Follows, cache, pavilhões, logos |
| **Local** | Mapeamento manual | Logos e cores de 281 clubes |

### Autenticação (Clerk)

- Registo com **username único** validado pelo Clerk
- Password recovery com código de 6 dígitos por email
- Perfil completo: editar nome/bio/username, mudar password, ver/terminar sessões, apagar conta
- Tour onboarding só no sign-up (não no login)
- JWT integrado com Supabase RLS (`auth.uid()::text`)

---

## 🏗️ Estrutura do Projeto

```
web/
├── src/
│   ├── lib/                        # Lógica pura: APIs, contexts, utils
│   │   ├── fpbApi.ts               #   Parser HTML FPB (clubes)
│   │   ├── fpbCompetitionsApi.ts   #   Parser WordPress AJAX (competições)
│   │   ├── tugabasketApi.ts        #   Parser TugaBasket
│   │   ├── ClubContext.tsx          #   Estado global dos clubes
│   │   ├── AuthContext.tsx          #   Clerk auth (useAuth, TokenProvider)
│   │   └── supabase.ts             #   Cliente Supabase (DB + RLS via JWT)
│   ├── hooks/                      # Hooks React com cache
│   │   ├── useGames.ts
│   │   ├── useStandings.ts
│   │   └── useFollows.ts
│   ├── components/                 # Componentes reutilizáveis
│   │   ├── AuthModal.tsx           #   Login / Criar conta / Recuperar password
│   │   ├── OnboardingTour.tsx      #   Tour guiado pós-registo
│   │   ├── GameCard.tsx            #   Cartão de jogo
│   │   └── SegmentControl.tsx      #   Navegação por tabs
│   └── pages/                      # Páginas (route-level)
│       ├── Landing.tsx
│       ├── CompetitionDetail.tsx
│       ├── Game.tsx
│       ├── Following.tsx
│       ├── ProfilePage.tsx
│       └── club/                   #   Nested routes: /clube/:slug/*
├── api/                            # Vercel Edge Functions
│   ├── fpb.ts                      #   Proxy FPB
│   ├── tugabasket.ts               #   Proxy TugaBasket
│   └── admin.ts                    #   Painel admin (Clerk + Supabase)
└── public/
    ├── logo.svg
    └── logo.png                    # PWA maskable icon
```

```
database/
└── migrations/                     # 16 migrações numeradas
    ├── 01 create_clubs_table.sql
    ├── 03 create_user_follows.sql
    ├── 04 add_clerk_auth.sql
    ├── 11 add_pavilions.sql
    └── ...
```

```
scrapers/                           # Scripts Node.js independentes
└── (scraper FPB + TugaBasket)
```

```
.github/workflows/                  # 4 workflows
├── scrape-daily.yml                #   Diário: scraper + sitemap
├── discover-competitions.yml       #   Semanal: novas competições
├── e2e-smoke.yml                   #   Manual: Playwright E2E
└── fpb-manual.yml                  #   Manual: seed FPB
```

---

## 🧪 Testes

**111 testes** em 14 ficheiros. Os testes correm em cada build — se falharem, o deploy não publica.

```bash
cd web
npm test                        # unitários (Vitest + jsdom)
npm run test:e2e                # end-to-end (Playwright)
```

| Área | Ficheiros | Testes |
|---|---|---|
| Parsers FPB/TugaBasket | `fpbApi.test.ts`, `fpbCompetitionsApi.test.ts`, `tugabasketApi.test.ts`, `fetchStandings.test.ts` | 33 |
| Utilitários | `fpbUtils.test.ts`, `matchUtils.test.ts`, `clubSearch.test.ts` | 46 |
| Hooks React | `useGames.test.ts`, `useFollows.test.ts` | 7 |
| Componentes | `GameCard.test.tsx`, `ErrorBoundary.test.tsx`, `StandingsTable.test.tsx`, `Toast.test.tsx` | 20 |
| Contexto | `ClubContext.test.tsx` | 5 |

---

## 🤝 Contribuir

PRs são bem-vindos! Lê o [CONTRIBUTING.md](CONTRIBUTING.md) para um guia completo (explica o que são PRs, issues, forks — mesmo que nunca tenhas contribuído para open source).

Resumo rápido:
1. **Escolhe uma [issue](https://github.com/mefrraz/dribly/issues)** ou cria uma nova
2. **Faz fork, clone, branch** — mexe no que quiseres
3. **`npm run lint:fix`** para alinhar com ESLint
4. **Adiciona testes** se mexeres em lógica de parsing, hooks ou componentes
5. **`npm run build`** tem de passar — faz tsc + testes + build
6. **Abre o PR** — eu revejo em 1-2 dias

Não sabes o que é um PR? Sem stress — o [CONTRIBUTING.md](CONTRIBUTING.md) explica tudo, com glossário e passo a passo.

---

## 📜 Licença

GNU **AGPLv3** — código aberto, copyleft para serviços web. Vê o ficheiro [LICENSE](LICENSE).

---

<p align="center">
  <a href="https://dribly.pt">🌐 dribly.pt</a>
  &nbsp;·&nbsp;
  <a href="https://github.com/mefrraz/dribly">📦 GitHub</a>
  &nbsp;·&nbsp;
  <a href="CHANGELOG.md">📋 Changelog</a>
</p>
