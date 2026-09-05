# ADR-0001: Fundação técnica do Circuit Router

**Status:** Aceita · **Data:** 2026-09-05 · **Decisor:** arquiteto consultor · **Substitui:** premissas implícitas do protótipo e do `docs/SDD.md` v1

## Contexto

O protótipo (vanilla JS + grid DOM 12×8 + Jest/CJS) prova o conceito de jogo, mas não executa no navegador por incompatibilidade ESM/CJS, não tem suporte a toque, não é responsivo e não tem formato de fase serializável. O produto pretendido é um puzzle mobile-first, completo, com campanha, progressão, editor e polimento visual, instalável como PWA. A implementação será feita por **múltiplos agentes em paralelo, em worktrees git separados, numa janela curta de tempo** — o que torna *fronteiras de arquivo* e *contratos tipados* requisitos de arquitetura, não preferências de estilo.

## Drivers de decisão

1. **D1 — Touch-first.** Interação por dedo em tela de 360–430px é o caso primário; mouse é secundário.
2. **D2 — Paralelismo entre agentes.** Áreas precisam ser editáveis simultaneamente sem sobreposição de arquivos e com merges triviais.
3. **D3 — Contratos verificáveis.** Agentes sem contexto compartilhado erram menos com tipos explícitos e testes rápidos.
4. **D4 — Offline e instalável.** Jogo de puzzle é consumido no metrô, no elevador, sem rede.
5. **D5 — Cabeça de espaço para animação.** Propagação de sinal animada, glow, partículas e grids grandes são do roadmap, não hipotéticos.
6. **D6 — Custo de orquestração de uma noite.** Cada componente da stack precisa pagar seu custo dentro do v1.
7. **D7 — Zero fricção de distribuição.** Sem contas, sem servidor, sem app store para jogar.

## Opções consideradas

### (a) Linguagem: JS puro vs TypeScript

| | Prós | Contras |
|---|---|---|
| JS puro | zero build-step no core; menos setup | contratos entre agentes só existem em prosa; erros de forma de dados (`value: 0` vs `undefined` vs `null` — já presentes no protótipo) só aparecem em runtime; refactor cego |
| **TypeScript** | contrato compilável entre core/UI/content — **é o mecanismo de coordenação entre agentes paralelos (D2/D3)**; schema de fase autodocumentado; autocomplete reduz alucinação de API | tsconfig e build a configurar (custo único, ~30 min) |

### (b) Camada de UI: DOM puro vs React vs Preact vs Svelte vs Solid

| | Prós | Contras |
|---|---|---|
| DOM puro | sem dependência | o protótipo já demonstra a falha: `innerHTML=''` a cada traço; menus, modais, seleção de fases e editor viram spaghetti imperativo |
| React | ecossistema máximo | ~45KB gzip, exagerado para um jogo offline (D4) |
| **Preact + signals** | ~5KB gzip; API React — **maior densidade de treino dos agentes, menos erro de sintaxe (D2/D6)**; `@preact/signals` dá estado reativo granular sem Redux | ecossistema menor (irrelevante aqui) |
| Svelte / Solid | performance excelente, DX ótima | sintaxe menos canônica para agentes; ganho real sobre Preact é marginal quando o tabuleiro **não** é DOM |

### (c) Renderização do tabuleiro: DOM vs Canvas 2D vs WebGL

| | Prós | Contras |
|---|---|---|
| DOM | CSS grátis, inspecionável | 1 nó por célula; grid 20×14 = 280 nós reconstruídos por frame de animação; hit-testing durante arrasto exige `elementFromPoint`; **é a causa raiz do drag quebrado atual (D1/D5)** |
| **Canvas 2D** | 1 elemento; hit-test = `Math.floor(px/cell)`, exato e barato; animação de propagação, glow e pan/zoom pinch são naturais; DPR-aware para nitidez em telas retina | acessibilidade e texto precisam de trabalho manual (mitigado: HUD/menus continuam em DOM) |
| WebGL/PixiJS | milhares de sprites | overkill para um grid; +100KB; complexidade sem retorno no v1 (D6) |

### (d) PWA: sim vs não

Sim — `vite-plugin-pwa` entrega manifest + service worker + precache com **um plugin e um bloco de config**. Sem ele, D4 e D7 ficam sem resposta e "instalar no celular" exige loja.

### (e) Backend: API+DB vs 100% client-side

| | Prós | Contras |
|---|---|---|
| Node + Fastify + SQLite | leaderboard global, save na nuvem, packs dinâmicos | exige contas/auth, hospedagem, CORS, migrations, anti-cheat (num jogo client-side, *todo* score é forjável), e um modo offline **mesmo assim** — porque o jogo tem de funcionar sem rede (D4). Ou seja: paga-se o custo integral do client-side **mais** o do servidor |
| **100% client-side** | zero infra, zero latência, offline por construção, privacidade trivial, distribuição instantânea (D4/D6/D7) | sem ranking global e sem sync entre dispositivos no v1 |

### (f) Testes: Jest vs Vitest

| | Prós | Contras |
|---|---|---|
| Jest | já instalado; suíte atual verde | **é a origem da divergência ESM/CJS**: força o core a ser CJS enquanto o browser exige ESM; ESM+TS no Jest exige `ts-jest`/babel e flags experimentais; ~11s para 17 testes |
| **Vitest** | mesma API de Jest (migração quase textual); **usa o mesmo `vite.config` e o mesmo resolver do build — impossível divergir do que o navegador executa**; TS nativo; watch em milissegundos (D3) | sai do default histórico (irrelevante) |

## Decisão

1. **Stack:** **TypeScript (strict) + Vite** como build/dev server. Fim do JS solto na raiz.
2. **UI:** **Preact + `@preact/signals`** para shell, menus, HUD, modais e editor.
3. **Renderização do tabuleiro:** **Canvas 2D único**, DPR-aware, com render loop próprio; HUD e telas em Preact por cima. Fronteira dura: **o Canvas desenha, o DOM não sabe de células**.
4. **PWA: sim**, via `vite-plugin-pwa` (`registerType: 'autoUpdate'`, estratégia `generateSW`). Escopo mínimo instalável: manifest (`name`, `short_name`, `start_url`, `display: standalone`, `theme_color`, `background_color`, ícones 192/512 + maskable), service worker com precache de todo o bundle e dos JSONs de fase, **fontes auto-hospedadas** (remover o CDN do Google Fonts), `<meta name="viewport" content="...viewport-fit=cover">` e respeito a `env(safe-area-inset-*)`.
5. **Backend: NÃO no v1.** O jogo é 100% client-side. Persistência de progresso em **`localStorage`** (payload é pequeno: fases concluídas, estrelas, melhor contagem de peças, flags de config) com um **envelope versionado** (`{ schemaVersion, ... }`) e função de migração — para que sync na nuvem no futuro seja um *adaptador*, não uma reescrita.
   **Sobre a divisão "backend/frontend/testes" pedida pelo dono:** neste projeto o "backend" é **`packages/core`** — a engine pura, o gerador de fases, o solver/validador e a camada de persistência. É código sem DOM, roda e é testado em Node, tem API própria e é desenvolvido por um time de agentes separado do time de UI. É exatamente a mesma divisão de trabalho e de commits que um servidor daria, **sem** o custo de infraestrutura. Leaderboard global e save na nuvem ficam explicitamente adiados para v2 (ADR futura), quando houver jogadores para rankear.
6. **Estrutura:** **monorepo com npm workspaces** (nativo do npm 11, sem pnpm/turbo): `packages/core`, `packages/content`, `apps/game`, `docs`, `tools`. Core exposto por **subpath exports** (`@circuit/core/sim`, `/model`, `/gen`, `/persist`, `/state`) — **sem barrel único**, que seria ponto de conflito de merge garantido entre agentes paralelos.
7. **Naming:** **"Circuit Router"** em todos os lugares — `<title>`, `<h1>`, manifest PWA, README, SDD, ADRs. `package.json` raiz já é `circuit-router`; workspaces sob o escopo `@circuit/*`. Qualquer ocorrência do nome antigo do protótipo em docs/código ativo é erro a corrigir (sobra apenas em `legacy/` como referência histórica).
8. **Testes:** **Vitest**, com `environment: 'node'` para `packages/core` e `'jsdom'` para `apps/game`, via `vitest.workspace.ts`. Jest e a pasta `tests/` legada são removidos.

## Consequências

**Positivas**
- O jogo volta a executar (o bug ESM/CJS deixa de ser possível: um único resolver para build, dev e teste).
- Fronteiras de arquivo explícitas permitem 8–10 agentes commitando em paralelo com merges limpos.
- Canvas destrava animação de propagação, pinch-zoom/pan e grids grandes sem reescrever a camada de entrada.
- Sem servidor: nada para provisionar, monitorar, pagar ou proteger na noite de execução.
- `core` continua 100% headless e testável — a mesma engine servirá a um futuro servidor, se ele existir.

**Negativas / custos aceitos**
- Reescrita da UI do zero; do protótipo aproveitam-se apenas as regras de negócio.
- Acessibilidade do tabuleiro exige trabalho manual (mitigação: navegação por teclado + `aria-live` de status no HUD, item do roadmap).
- Sem ranking global nem progresso entre dispositivos no v1.
- Setup inicial (~1 tarefa bloqueante) antes de qualquer paralelismo.

**Riscos e mitigações**
- *Contrato de tipos mal desenhado envenena todos os agentes em paralelo* → a tarefa de contratos (MI-02) é única, curta, bloqueante e revisada antes da abertura das worktrees.
- *Service worker servindo bundle velho* → `autoUpdate` + prompt de recarga; SW desabilitado em dev.
- *Drift entre `packages/content` e o schema de fase* → validador de fases roda em teste de CI sobre todos os JSONs.
