# Circuit Router

Jogo educativo mobile-first de **lógica digital e circuitos combinacionais**: roteie sinais, posicione portas lógicas (NOT, AND, OR) e descubra — jogando — como um computador pensa. Feito para aprender Engenharia de Computação de forma divertida: sinal binário, tabelas-verdade, expressões booleanas, curto-circuito, fan-out e até um somador completo no fim da campanha.

> **Stack:** TypeScript strict · Vite · Preact + signals · Vitest · Canvas 2D · WebAudio · PWA offline.
> **Docs:** [SDD v2](docs/SDD.md) (spec completa) · [ADR-0001](docs/adr/0001-fundacao-tecnica.md) (decisões de arquitetura).

## Setup

Requisitos: Node.js 20+ e npm (workspaces nativos).

```bash
npm install     # instala os workspaces (core, content, game)
npm run dev     # sobe o dev server do jogo (http://localhost:5173)
```

## Scripts

| Script | O que faz |
|---|---|
| `npm run dev` | Dev server Vite (service worker desligado em dev) |
| `npm run build` | Build de produção do `apps/game` (gera PWA: manifest + service worker) |
| `npm run preview` | Serve o build localmente para validar o offline |
| `npm test` | Vitest sobre o workspace (core/content em node, game em jsdom) |
| `npm run typecheck` | `tsc --noEmit` nos três projetos |

## Mapa do monorepo

```
├── apps/game          # @circuit/game — o jogo (UI Preact + Canvas 2D)
│   └── src/
│       ├── app/       # contratos (BoardRenderer/InputController/AudioBus) e composição
│       ├── audio/     # WebAudioBus: SFX sintetizados + música, mute persistido
│       ├── board/     # CanvasBoardRenderer: canvas DPR-aware, camadas, animação de sinal
│       ├── input/     # entrada touch: drag-to-connect, pinch-zoom, rotação
│       ├── editor/    # sandbox e editor de fases (export/import JSON)
│       ├── ui/        # shell, telas, HUD, modais, painel de conceito, dicas
│       ├── pwa/       # fontes auto-hospedadas e suporte PWA
│       ├── styles/    # tokens e CSS do app
│       └── main.tsx   # entry
├── packages/core      # @circuit/core — a "engine" headless (roda em Node, sem DOM)
│   └── src/
│       ├── model/     # Coord/Direction/Signal, células, LevelSpec, BoardState
│       ├── sim/       # simulação por nets (union-find) + diagnósticos como dados
│       ├── state/     # LevelEditor: comandos de edição com undo/redo
│       ├── gen/       # gerador procedural de fases + solver/validador
│       └── persist/   # SaveStore: envelope versionado sobre localStorage
├── packages/content   # @circuit/content — fases (JSON) e textos PT-BR
│   └── src/
│       ├── packs/     # campanha em packs (currículo progressivo)
│       └── text/      # glossário, catálogo de diagnósticos, textos de resultado
├── legacy/            # protótipo vanilla (referência histórica — não é buildado)
└── docs/              # SDD v2 + ADRs
```

## Fronteiras por área (quem edita o quê)

Cada área tem fronteira de arquivos própria — é o que permite implementação paralela com merges limpos:

| Área | Caminhos |
|---|---|
| **core — modelo** | `packages/core/src/model/**` |
| **core — simulação** | `packages/core/src/sim/**` |
| **core — comandos/undo** | `packages/core/src/state/**` |
| **core — gerador/solver** | `packages/core/src/gen/**` |
| **core — persistência** | `packages/core/src/persist/**` |
| **content — packs** | `packages/content/src/packs/**` |
| **content — textos** | `packages/content/src/text/**` |
| **game — renderização** | `apps/game/src/board/**` |
| **game — entrada touch** | `apps/game/src/input/**` |
| **game — áudio** | `apps/game/src/audio/**` |
| **game — editor/sandbox** | `apps/game/src/editor/**` |
| **game — UI/HUD/telas** | `apps/game/src/ui/**`, `index.html`, `styles/**` |
| **game — PWA** | `apps/game/public/**`, `apps/game/src/pwa/**`, seção `VitePWA` do `vite.config.ts` |
| **game — integração** | `apps/game/src/app/**`, `main.tsx` |
| **docs** | `docs/**`, `README.md` |

Regras de arquitetura (ADR-0001): `core` nunca importa DOM/Preact; a UI consome o core apenas pelos tipos exportados (subpath exports `@circuit/core/*`); **não há barrel único**.

## Convenções

- Commits: Conventional Commits em **PT-BR**, 1 tarefa = 1 commit, sem trailers (`Co-Authored-By` etc.).
- Documentação: decisões em `docs/adr/`, spec do sistema em `docs/SDD.md` — siga o SDD e atualize-o se o design mudar.
- Testes antes de commitar: `npm run typecheck` + `npm test`.

## Testes

```bash
npm test           # suíte completa
npm test -- workspace packages/core    # só o core
npm run typecheck  # tipos dos três projetos
```

A suíte cobre: tabelas-verdade das portas, simulação por nets (curto vs ciclo, flutuante, porta sem alimentação), comandos/undo (property test), gerador (mesma seed → mesma fase; 500 fases 100% solucionáveis pelo solver), round-trip de save/migração, componentes da UI em jsdom, áudio com `AudioContext` mockado e renderer Canvas (conversão célula↔pixel, DPR, animação de sinal).
