# Contribuir para o Dribly 🏀

Antes de mais: **obrigado por quereres ajudar!** Este projeto foi feito por uma pessoa de 14 anos em 3 semanas com menos de 25€ em APIs de IA. Se eu consegui, tu também consegues contribuir.

---

## 📖 Glossário rápido (se nunca contribuíste para open source)

| Palavra | O que significa |
|---|---|
| **Repo** (repositório) | O projeto no GitHub — todos os ficheiros, histórico, etc. |
| **Fork** | A tua cópia pessoal do repo. Carregas no botão "Fork" no GitHub e ele cria uma cópia na tua conta. |
| **Clone** | Descarregar o repo para o teu PC. `git clone https://github.com/TEU_USER/dribly.git` |
| **Branch** | Um "ramo" separado onde fazes as tuas alterações sem estragar o código principal. |
| **Commit** | Guardar as tuas alterações com uma mensagem a explicar o que fizeste. |
| **Push** | Enviar os teus commits para o GitHub. |
| **PR** (Pull Request) | Um pedido para juntares o teu código ao projeto principal. Tu dizes "olha, fiz isto, queres juntar?" e eu revejo e aceito (ou peço alterações). |
| **Issue** | Um ticket no GitHub onde se reportam bugs ou se sugerem ideias. |
| **Merge** | Juntar o código do PR no projeto principal. |

---

## 🚀 Como contribuir (passo a passo)

### 1. Encontra algo para fazer

Vê os [issues abertos](https://github.com/mefrraz/dribly/issues). Se não souberes por onde começar, procura os que têm a tag `good first issue`.

Se tiveres uma ideia que não está nos issues, **abre um issue primeiro** para discutirmos antes de escreveres código. Assim não perdes tempo se a ideia não fizer sentido para o projeto.

### 2. Faz fork e clone

No GitHub, carrega no botão **Fork** (canto superior direito). Depois no teu PC:

```bash
git clone https://github.com/TEU_USER/dribly.git
cd dribly
git checkout -b minha-alteracao    # cria um branch novo
```

### 3. Instala e corre

```bash
cd web
npm install
npm run dev        # abre http://localhost:5173
```

### 4. Faz as tuas alterações

- O código está em `web/src/`
- Segue o estilo que já existe — se tiveres dúvidas, `npm run lint:fix` corrige automaticamente
- Se a tua alteração mexe em lógica (parsing, hooks, utilitários), **adiciona testes**
- Testes estão em ficheiros `*.test.ts` ou `*.test.tsx` ao lado do código que testam

### 5. Verifica que nada partiu

```bash
npm run build      # faz TypeScript + testes + build
npm run lint:fix   # ESLint auto-fix
```

Se `npm run build` passar, está pronto.

### 6. Commit e push

```bash
git add .
git commit -m "tipo: descrição curta do que mudaste"
git push origin minha-alteracao
```

Usa um destes prefixos no commit:
- `feat:` — nova funcionalidade
- `fix:` — correção de bug
- `refactor:` — melhorar código sem mudar comportamento
- `docs:` — documentação
- `test:` — testes
- `chore:` — tarefas chatas (dependências, configs)

Exemplo: `feat: adicionar filtro por escalão na página de jogos`

### 7. Abre o PR

Vai ao teu fork no GitHub e carrega em **"Compare & pull request"**. Escreve:
- O que fizeste
- Porquê
- Como testar

Eu revejo e respondo — normalmente em 1-2 dias.

---

## 🧪 Testes

O projeto tem 111 testes. Eles correm automaticamente em cada build.

```bash
npm test                 # todos os testes
npm run test:e2e         # testes end-to-end com Playwright
```

Se vais mexer em:
- **Parsers da FPB** → adiciona testes em `fpbApi.test.ts` ou `fpbCompetitionsApi.test.ts`
- **Hooks React** → `useGames.test.ts`, `useFollows.test.ts`
- **Componentes** → `GameCard.test.tsx`, `ErrorBoundary.test.tsx`, etc.

Não compliques — vê os testes que já existem e copia o estilo.

---

## 📁 Estrutura rápida

Se quiseres saber onde está cada coisa:

| O que queres mudar | Onde está |
|---|---|
| Página inicial | `web/src/pages/Landing.tsx` |
| Página de um clube | `web/src/pages/club/ClubHome.tsx` |
| Ficha de jogo | `web/src/pages/Game.tsx` |
| Mapa de pavilhões | `web/src/pages/MapPage.tsx` |
| Cartão de jogo (usado em vários sítios) | `web/src/components/GameCard.tsx` |
| Pesquisa de clubes | `web/src/lib/clubSearch.ts` |
| Dados da FPB | `web/src/lib/fpbApi.ts` |
| Classificações | `web/src/lib/fpbCompetitionsApi.ts` |
| Cores e estilos | `web/tailwind.config.js` |

---

## 🐛 Reportar um bug

Se encontraste um bug mas não sabes programar (ou não tens tempo), abre um [issue](https://github.com/mefrraz/dribly/issues) e diz:

1. O que fizeste (passos para reproduzir)
2. O que esperavas que acontecesse
3. O que aconteceu em vez disso
4. Que telemóvel / browser estás a usar

Screenshots ajudam imenso.

---

## 💡 Sugerir uma feature

Abre um [issue](https://github.com/mefrraz/dribly/issues) com a tag `enhancement` e descreve:
- O que queres que a app faça
- Porquê (como é que ajudaria os utilizadores)
- Exemplos de apps que já fazem isso (se houver)

---

## 📞 Dúvidas?

Se estiveres perdido com Git, PRs, ou qualquer coisa técnica — abre um issue à mesma com a tag `question`. Não há perguntas estúpidas. Toda a gente começa em algum lado.

---

## 📜 Regras simples

1. **Sê respeitador.** Este projeto é feito por uma pessoa. Trata os outros como gostarias de ser tratado.
2. **Testa antes de enviar.** `npm run build` tem de passar.
3. **Commits em português ou inglês** — o que for mais confortável para ti.
4. **Diverte-te.** Isto é basquetebol, não é cirurgia cardíaca.

---

*Feito com ❤️ e basquetebol por um miúdo de 14 anos que não sabia o que era um PR há 3 semanas.*
