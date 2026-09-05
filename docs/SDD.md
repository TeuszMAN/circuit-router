# SDD v2 — Circuit Router

> Aceito em 2026-09-05 pelo PO. Decisões técnicas: [ADR-0001](adr/0001-fundacao-tecnica.md).
> Documento final publicado na MI-14, descrevendo o sistema **como implementado** (algoritmo de nets do §4, contrato do §3, comandos do §6, persistência do §10, áudio do §11, PWA do §12).
> A seção de currículo educacional (9.A–9.E, Fase A.5) é incorporada ao §9 e detalhada no fim deste documento.


**1. Visão do produto**

**1.1 Pitch e fantasia.** O jogador é um *roteador de sinais*: fontes fixas emitem 0/1 e ele desenha fios e posiciona portas lógicas até cada destino (sink) receber exatamente o valor que espera. A fantasia é de engenharia — construir um circuito que funciona — e cada erro vira um diagnóstico legível (curto, ciclo, flutuante), não uma punição.

**1.2 Público e plataforma-alvo.** Quem quer aprender Engenharia de Computação jogando, em telas de 360–430px. Mobile web como caso primário; PWA instalável (MI-11) garante funcionamento offline no celular. Mouse/teclado são secundários, nunca o contrário.

**1.3 Loop de jogo.** Observar o nível (fontes, destinos, inventário) → rotear fios e portas → simular → ler o diagnóstico se falhar → otimizar para as 3 estrelas. O ciclo ensina por descoberta: primeiro fazer funcionar, depois fazer com menos.

**1.4 Escopo do v1 e não-objetivos.** Sem backend, sem contas, sem leaderboard global, sem multiplayer. Jogo 100% client-side (ADR-0001): a persistência vive em `localStorage` com envelope versionado, pronta para virar um adaptador de sync remoto no futuro sem reescrita.

---

**2. Arquitetura**

**2.1 Diagrama de camadas.** `content` (fases/textos) → `core` (modelo, simulação, estado, gerador, persistência) → `app` (UI Preact + Canvas). O `core` é headless: roda e é testado em Node, não importa DOM nem Preact. A UI consome o core **apenas pelos tipos e funções exportados**; nunca reimplementa lógica.

**2.2 Regra de dependência unidirecional.** `core` não conhece `content` nem `app`; `content` depende apenas dos tipos de `core`; `app` depende de ambos. Violação de fronteira é erro de arquitetura (verificado por typecheck e por revisão de fronteira por tarefa).

**2.3 Monorepo e workspaces.** npm workspaces nativos: `packages/core` (`@circuit/core`), `packages/content` (`@circuit/content`), `apps/game` (`@circuit/game`). Raiz expõe os scripts `dev`, `build`, `preview`, `test` (Vitest) e `typecheck` (tsc --noEmit nos três projetos). `tsconfig.base.json` em modo strict.

**2.4 Subpath exports.** `@circuit/core` expõe `./model`, `./sim`, `./state`, `./gen`, `./persist`; `@circuit/content` expõe `.` (schema), `./packs` e `./text`. Cada subpath aponta para seu `src/*/index.ts`. **Não há barrel único** — decisão deliberada (ADR-0001) para eliminar o ponto de conflito de merge entre agentes paralelos.

**2.5 Build e ambientes.** Vite dev server para desenvolvimento (SW desligado), `vite build` com `vite-plugin-pwa` para produção, `vite preview` para validar o build offline. Versões atuais: TypeScript ^7, Vite ^8, Vitest ^5, jsdom ^29, Preact ^10 + `@preact/signals`, `vite-plugin-pwa` ^1.3.

---

**3. Modelo de domínio**

**3.1 Geometria e sinal.** `Coord { x, y }`; `Direction = 'N' | 'S' | 'E' | 'W'`; `Signal = 0 | 1 | undefined` — o valor lógico de um fio ou saída, com `undefined` significando "sem valor definido" (flutuante/indeterminado), distinto de 0.

**3.2 Células.** `CellKind = 'empty' | 'source' | 'sink' | 'wire' | 'gate'`. Cada célula declara **quais lados são ativos** (podem formar conexão) — a conexão entre vizinhas só existe quando os lados são complementares (N↔S, E↔W):
- `SourceCell`: produz sinal fixo 0/1 pelo `outputSide`.
- `SinkCell`: espera valor `expected` pelo `inputSide`.
- `WireCell`: transporta sinal; `sides` = lados ativos (fio reto, curva, junção em T/+).
- `GateCell`: porta com `inputSides` **declarados explicitamente** + `outputSide`, ambos já refletindo a rotação.
- `EmptyCell`: célula vazia editável (vira fio/porta) — nunca entra na simulação.

**3.3 Portas.** `GateType = 'AND' | 'OR' | 'NOT'` no v1 (XOR é *construído* com AND/OR/NOT — é conteúdo do Pack 6, não peça). `GATE_ARITY` valida `inputSides` por tipo: NOT tem 1 entrada (oposta à saída); AND/OR têm 2 (a oposta e a vizinha no sentido horário) — regra `inputSidesFor(gate, outputSide)` do core, que autores de fase podem sobrescrever declarando `inputSides` no `LevelSpec`. Rotação é horária (N→E→S→W) via `rotateCw`.

**3.4 `LevelSpec`** — especificação imutável e serializável de uma fase: `schemaVersion` (= `LEVEL_SCHEMA_VERSION` 1), `id`, `name`, `grid {width, height}`, `fixedCells` (células fixas ancoradas), `inventory {wires: number|null, gates: Partial<Record<GateType, number|null>>}` (`null` = sem limite), `hints` (tupla [nível 1, nível 2]), `starThresholds {maxPieces, maxGates}` e `expression?` (expressão booleana-alvo para exibição opcional na UI).

**3.5 `BoardState`** — camada editável pelo jogador, separada das células fixas do nível: `{ levelId, placedCells[] }`, onde `PlacedCell` só contém `WireCell | GateCell`. Fontes/sinks/paredes vêm de `fixedCells` e nunca aparecem aqui. Comandos de edição produzem **novas instâncias** (imutabilidade); nada muta o `LevelSpec`.

**3.6 Serialização e compatibilidade.** Fases trafegam como JSON conforme o schema versionado acima; `LevelSpec` e `SaveData` carregam `schemaVersion` e bump exige migração (ver §10). Round-trip save preserva tudo; JSON malformado ou versão futura → save padrão, sem throw.

---

**4. Simulação (motor por nets)**

Implementação real em `packages/core/src/sim/engine.ts` — **é o algoritmo que o v1 do SDD descrevia errado e que esta v2 documenta como implementado**.

**4.1 Construção de nets por union-find.** Fios adjacentes com lados ativos complementares são agrupados em *nets* (union-find): uma net é um **único nó elétrico** — todos os seus fios têm o mesmo valor. Uma junção em T/+ de fios é uma net só; isso é o que torna fan-out possível e curto detectável.

**4.2 Grafo de drivers/leitores.** Para cada net, o motor identifica *drivers* (fonte ou saída de porta conectada à net) e *leitores* (entrada de porta ou sink). Invariante elétrico: **uma net precisa de exatamente um driver**.

**4.3 Avaliação determinística.** O grafo de dependências entre portas (entrada depende da net que a alimenta) é avaliado em **ordem topológica**; portas cujas entradas dependem de saídas ainda não resolvidas esperam sua vez. `evaluateGate(gate, inputs)` implementa as tabelas-verdade de NOT/AND/OR sobre `Signal` (entrada `undefined` ⇒ saída indefinida). Execuções repetidas produzem resultado idêntico.

**4.4 Diagnósticos como dados, nunca exceções.** `simulate(level, board, {trace?})` retorna `SimulationResult { ok, sinks[], issues[] }`; `sinks[]` traz `SinkStatus { coord, expected, actual, satisfied }` por destino, e `issues[]` traz `{ kind, cells[] }` com as células que evidenciam o problema. A UI traduz cada `kind` em texto de aprendiz (§9.C.1). Condição de jogo nunca lança.

**4.5 Distinção formal curto vs ciclo** (correção sobre o protótipo): dois drivers com valores conflitantes na mesma net ⇒ `short`; realimentação combinacional (dependência cíclica entre portas, SCC no grafo) ⇒ `cycle` — **nunca** confundidos. Coberto por testes dedicados (NOT realimentado ⇒ `cycle`, não `short`).

**4.6 Demais diagnósticos.** Net sem driver alimentando leitores ⇒ `floating`; porta com entrada(s) em falta (não conectada, flutuante ou em net com curto) ⇒ `unpowered-gate`. `ok` só é verdadeiro com todos os sinks satisfeitos e zero issues.

**4.7 Traço de propagação.** `simulateWithTrace` devolve, além do resultado, `trace: SimTraceStep[]` — células que receberam sinal a cada passo — consumido pela animação de propagação do renderizador (§8.4). Sem `trace: true` o traço é vazio (zero overhead).

---

**5. Condição de vitória e pontuação**

**5.1 Vitória.** Todos os sinks satisfeitos e nenhum issue ⇒ `ok`. O jogador vence no momento em que simula um circuito `ok`.

**5.2 Três estrelas** (SDD §9.E nomeia cada uma na UI): ★1 **Circuito completo** = resolver; ★2 **Rota limpa** = resolver com ≤ `starThresholds.maxPieces` peças; ★3 **Lógica mínima** = resolver com ≤ `starThresholds.maxGates` portas. Não existe estrela por rapidez — velocidade não é aprendizado.

**5.3 Persistência do melhor resultado.** Para cada fase guarda-se o melhor alcançado (`LevelProgress { stars, bestPieces?, bestGates?, completedWithHint? }`); refazer melhora o registro sem nunca piorá-lo. Limites de estrela são sempre **derivados do solver** (prova de atingibilidade), nunca estimados no olho.

---

**6. Estado do jogador e comandos**

**6.1 Padrão Command sobre `BoardState`.** `LevelEditor` (em `packages/core/src/state/`) expõe as operações `placeWire`, `placeGate`, `rotateGate`, `erase`, `dragWires`, `clear`, além de `undo`/`redo`. Estado imutável: cada transição produz um novo `BoardState`.

**6.2 Undo/redo.** Pilhas de estados com limite configurável. **Um traço inteiro de arrasto é coalescido em UM único passo de undo** (`dragWires(path)`), mesmo com dezenas de células — o jogador desfaz o gesto, não a célula. Nova edição limpa a pilha de redo.

**6.3 Invariante.** Nenhum comando sobrescreve célula fixa do nível (`isFixed`); comando sobre célula fixa é rejeitado sem alterar estado. Property test: 200 comandos aleatórios + 200 undos voltam ao estado inicial.

---

**7. Interface e interação (touch-first)**

**7.1 Contratos.** `app/contracts.ts` define as interfaces que a UI consome — `BoardRenderer` (mount/unmount/resize/render/cellAt sobre um `RenderFrame { level, board, issues, selected }`), `InputController` (attach/detach/onCommand/setZoom) e `AudioBus`. A UI **não instancia nem conhece** as implementações concretas; a composição é do ponto de integração (MI-15).

**7.2 Comandos de entrada.** `InputController` emite `InputCommand`: `drag-path`, `place-gate`, `rotate`, `erase`, `clear-board`, `undo`, `redo` — a entrada nunca muta estado diretamente; o ponto de composição traduz comandos em chamadas do `LevelEditor`.

**7.3 Layout.** Tabuleiro maximizado com HUD em barras seguras (`safe-area-inset-*`); alvos de toque ≥ 44px; usável em 360×640 sem scroll horizontal.

**7.4 Gestos (MI-09).** Pointer Events unificados (dedo/caneta/mouse), `touch-action: none`, captura de ponteiro; drag-to-connect com traço contínuo quantizado para células e **correção de diagonais** (arrasto rápido em diagonal vira caminho ortogonal sem buracos); pinch-zoom e pan com clamp; toque na peça selecionada rotaciona. Nenhum handler de `mouseenter`.

**7.5 Feedback.** Highlight das células do diagnóstico no tabuleiro, haptics opcional (`navigator.vibrate`, respeitando a config), e textos de erro em PT-BR vindos de `@circuit/content/text` — nenhum texto pedagógico hardcoded na UI.

---

**8. Renderização**

**8.1 Canvas 2D único** (`CanvasBoardRenderer implements BoardRenderer`), DPR-aware (nítido em 1x/2x/3x), resize observer. HUD/menus/modais ficam em DOM/Preact; **o Canvas desenha, o DOM não sabe de células** (ADR-0001).

**8.2 Camadas lógicas.** Grade/fundo, células fixas, peças do jogador, sinal animado, overlay de seleção/erro — desenhadas na ordem certa a cada frame.

**8.3 Render sob demanda.** Dirty flag para edições; `requestAnimationFrame` apenas durante animação. Grid 20×14 anima a 60fps em perfil mobile.

**8.4 Animação de propagação.** `buildSignalTimeline(trace)` converte o traço da simulação (§4.7) em `SignalTimeline`; `pulseIntensity`/`signalTotalMs` conduzem o pulso de sinal pelas células. **`prefers-reduced-motion` corta a animação para um corte seco.**

**8.5 Tema.** `BoardTheme` com tokens (paleta, `SignalColors` para 0/1, `IssuePalette` por diagnóstico), `withTheme()` para sobrescrever e `valueColor()` para a cor do sinal — consumidos pelos painters. O renderizador não conhece Preact.

---

**9. Conteúdo e progressão**

**9.1 Formato e packs.** Fases em JSON conforme o `LevelSpec` versionado (§3.4), organizadas em packs por tema em `packages/content/src/packs/` com índice `index.ts`. **9.2 Currículo e progressão didática, 9.A–9.E** (pilares pedagógicos, packs, feedback, glossário, estrelas nomeadas): seção completa e aprovada no fim deste documento — é a especificação consumida por MI-07/MI-17/MI-18 (fases) e MI-19/MI-20/MI-21 (textos, painel de conceito, dicas).

**9.3 Handmade vs gerada.** Campanha principal é handmade com curadoria didática (uma mecânica nova por pack); o gerador produz fases de treino/sandbox ilimitadas com dificuldade parametrizada.

**9.4 Gerador procedural e solver** (`packages/core/src/gen/`, MI-05). Fluxo de `generateLevel({ seed, difficulty })` (dificuldade 1..5):
1. **Sorteio do alvo** com orçamento exato de portas (`sampleTarget`, expressões sobre ≤ 3 variáveis);
2. **Síntese** do circuito de referência e posicionamento no grid com poda por paredes (`buildCandidate`/`buildLevelSpec`; configs `DIFFICULTY_CONFIGS[1..5]`);
3. **Validação obrigatória pelo solver**: a fase só sai "pronta" se `solveLevel` provar solução dentro do inventário — o gerador lança (bug interno) se produzir fase insolúvel;
4. **Estimativa de dificuldade** (`estimateDifficulty` → `gates`, `depth`, `wireLength`, `score`) derivada do circuito, não do olho.
Determinismo: toda a cadeia é dirigida por PRNG semeado (`Rng` + `mixSeed`) — mesma seed ⇒ fase byte-idêntica (testado). O solver (`solveLevel` → `SolveResult { solved, board?, wiresUsed?, reason? }`) resolve por decomposição em regiões livres com um driver por região (BFS determinística) e valida o resultado no motor de simulação; limitações assumidas do v1: regiões com 2+ drivers (`topology-unsupported`) e portas a colocar pelo jogador ficam fora do escopo do solver — fases geradas nunca produzem esses casos.

**9.5 Sandbox e editor (MI-13).** Modo livre com grid configurável, colocação de sources/sinks, teste imediato e editor que exporta/importa `LevelSpec` em JSON validado contra o schema; rascunhos persistem via `SaveStore.sandboxDrafts`.

---

**10. Persistência**

**10.1 Envelope versionado.** `SaveStore` (em `packages/core/src/persist/`) grava `SaveData { schemaVersion: SAVE_SCHEMA_VERSION, levels, settings, sandboxDrafts }` sobre uma interface `StorageLike` (`localStorage` no app; memória nos testes). `DEFAULT_SETTINGS` = `{ muted: false, theme: 'auto', haptics: true, reducedMotion: false }`.

**10.2 Conteúdo.** `levels: Record<levelId, LevelProgress>` (estrelas + melhores contagens + `completedWithHint`); `settings` (mute, tema, haptics, reduzir animação); `sandboxDrafts: Record<slot, { label, updatedAt, levelSpec, boardState }>`.

**10.3 Migrações e recuperação.** Pipeline de migração por `schemaVersion` (v1 atual); JSON corrompido, ausente ou de versão desconhecida ⇒ save padrão, **sem throw**. API do store: `levelProgress`, `recordLevelResult`, `updateSettings`, `draft`/`saveDraft`/`deleteDraft`, `reset`.

**10.4 Extensibilidade.** O storage fica atrás de interface (`StorageLike`) — sync remoto futuro é um adaptador novo, não uma reescrita (ADR-0001).

---

**11. Áudio**

**11.1 WebAudio com desbloqueio por gesto.** `WebAudioBus implements AudioBus` (`apps/game/src/audio/`): o `AudioContext` **só é criado no primeiro `unlock()`**, chamado a partir de um gesto do usuário — zero warning de autoplay, nada toca antes de interação.

**11.2 SFX sintetizados.** place/erase/rotate/success/error gerados por oscilador+envelope (sem arquivos pesados).

**11.3 Música ambiente.** Pad de acordes com scheduler; `setMusicEnabled` liga/desliga; fade no bus próprio.

**11.4 Mute e sessão.** `setMuted`/`isMuted` silenciam tudo via gain mestre; o mute **persiste entre recargas** porque o bus recebe `initialMuted` (ex.: `save.settings.muted` do SaveStore) e notifica mudanças por `onMutedChange` — o áudio não conhece persistência (fronteira; a ligação é da integração MI-15). `suspend()`/`resume()` seguram o contexto quando a aba fica oculta (`visibilitychange`) e retomam ao voltar.

---

**12. PWA e distribuição**

**12.1 Manifest e ícones.** `vite-plugin-pwa` com `registerType: 'autoUpdate'`; manifest com `name`/`short_name` **Circuit Router**, `start_url: '/'`, `display: 'standalone'`, `theme_color`/`background_color` e ícones 192/512 + maskable em `apps/game/public/icons`. `<meta name="viewport" content="...viewport-fit=cover">` e `env(safe-area-inset-*)` no CSS.

**12.2 Service worker.** `generateSW` com precache do bundle e `navigateFallback: '/index.html'`; novo SW assume com recarga automática (autoUpdate). SW desligado em dev.

**12.3 Offline.** Segunda visita funciona com a rede desligada — bundle, fontes e assets precacheados; fases JSON de `content` entram no precache quando existirem (campanha).

**12.4 Fontes auto-hospedadas.** Inter Variable (OFL) em `apps/game/public/fonts/` (subsets latin + latin-ext, cobrem pt-BR), injetada via `transformIndexHtml` — **sem CDN externo**, zero requisição a domínio externo em runtime.

---

**13. Estratégia de testes**

**13.1 Vitest com workspace**: `packages/core` e `packages/content` em `environment: 'node'`; `apps/game` em `'jsdom'` (`vitest.workspace.ts`). Mesmo resolver do build — impossível divergir do que o navegador executa.

**13.2 Core.** Tabelas-verdade de AND/OR/NOT; nets/curto/ciclo/flutuante/unpowered-gate com células corretas; determinismo; comandos/undo com property test.

**13.3 Gerador.** Mesma seed ⇒ fase byte-idêntica; 500 fases geradas 100% validadas pelo solver; dificuldade estimada monótona com o parâmetro; geração < 50ms.

**13.4 Persistência.** Round-trip salvar/carregar; migração de versões anteriores; save corrompido ⇒ padrão sem throw; storage em memória.

**13.5 UI (jsdom).** Componentes (seleção de fases, modais, settings, app-shell), áudio com `AudioContext` mockado, renderer Canvas com conversão célula↔pixel e DPR, animação de sinal, quantização de entrada.

**13.6 Fumaça.** Toda fase de `content` é resolvível pelo solver (roda sobre a campanha quando existir).

Estado na noite de 2026-09-05: **652 testes verdes em 19 arquivos** (11/21 tarefas concluídas; ver `docs/SDD` roadmap e board da operação).

---

**14. Qualidade e convenções**

**14.1 TS strict, sem `any` no core.** Typecheck roda sobre os três projetos no gate (`npm run typecheck`).

**14.2 Fronteiras de arquivo por área.** Cada tarefa do board declara sua fronteira (ex.: `packages/core/src/sim/**`, `apps/game/src/board/**`); implementadores só editam os caminhos listados — é o que viabiliza agentes em paralelo com merges triviais.

**14.3 Um commit por tarefa**, mensagens Conventional Commits em PT-BR, sem trailers (proibido `Co-Authored-By`/assinaturas); autor = identidade git local.

**14.4 Orçamentos.** Bundle enxuto (Preact ~5KB gzip, sem React); simulação O(células + arestas) com orçamento por frame; suíte completa roda em segundos.

---

**15. Roadmap pós-v1**

Leaderboard e save na nuvem (exigiriam backend + nova ADR — hoje o storage já é um adaptador); portas XOR/NAND como peças; componentes multi-célula; sinais multi-bit; temporização/atraso real; fases da comunidade; acessibilidade do tabuleiro por teclado + `aria-live` (mitigação já prevista no ADR-0001).

---

## Currículo Educacional (aprovado na Fase A.5 — 2026-09-05)

> Seção do SDD v2. Define **o que o jogador aprende**, **em que ordem**, **como o jogo ensina sem virar aula** e **como o sistema de estrelas recompensa compreensão**, não só conclusão. Consumida por `packages/content` (fases, textos, glossário) e por `apps/game/src/ui` (painel de conceito, dicas, mensagens de diagnóstico).

## 9.A Pilares pedagógicos

O Circuit Router é um jogo primeiro e um material didático depois. O currículo é **emergente das mecânicas**: o jogador nunca lê uma definição antes de precisar dela. Cinco pilares:

**P1 — Sinal binário como objeto manipulável.** O jogador vê 0 e 1 como cores/glow que fluem por um fio, não como abstração numérica. Aprende que um fio tem exatamente um valor, que esse valor vem de alguém (o *driver*) e que sem driver o fio não tem valor (`floating`). Isso ancora o conceito de *nível lógico* antes de qualquer notação.

**P2 — Porta lógica como função, tabela-verdade como sua descrição completa.** Cada porta é apresentada como uma caixa que transforma entradas em saída. A tabela-verdade não é ensinada como teoria: ela é o **registro do que o jogador já observou**, preenchida progressivamente pelo painel de conceito conforme ele testa combinações. Ao fim do Pack 3 o jogador construiu, com as próprias mãos, as tabelas de AND, OR e NOT.

**P3 — Síntese combinacional.** A partir do Pack 4 o objetivo deixa de ser "faça esta porta funcionar" e passa a ser "faça o sink valer 1 quando A e B forem 1 **ou** quando C for 0". O jogador está fazendo síntese de expressão booleana em forma de circuito — o que na disciplina se chama passar de especificação para implementação. A expressão aparece na UI como texto opcional (`S = (A·B) + C̄`) ao lado do objetivo em linguagem natural, criando a ponte notação ↔ comportamento.

**P4 — Roteamento, conflito e integridade elétrica.** Curto-circuito e ciclo combinacional são os dois erros conceituais mais caros na disciplina real e os dois mais fáceis de tornar viscerais num jogo: um fio com dois donos brigando, e um fio que depende de si mesmo. O jogo trata ambos como *estado observável do tabuleiro*, com células destacadas — o jogador aprende a **ler o próprio erro**, não a evitá-lo por decoreba.

**P5 — Otimização como minimização booleana.** A terceira estrela sempre premia fazer o mesmo com menos. Menos portas para o mesmo comportamento é, literalmente, simplificação de expressão booleana. Quando o jogador percebe que `A·B + A·B̄` é só `A`, ele descobriu um teorema de absorção sem que ninguém tenha escrito um axioma na tela.

**Como isso ensina sem virar aula.** Três regras invioláveis de design:

1. **Aprender fazendo, nunca lendo.** Nenhum texto obrigatório antes de uma fase. Todo conceito é introduzido por uma fase tão simples que só existe uma jogada possível — a fase *é* a explicação. O texto (painel de conceito) é sempre **opt-in**, atrás de um botão "?".
2. **Erro como feedback, não como punição.** Não há vidas, tempo nem game-over. Simular um circuito errado devolve um diagnóstico legível e o tabuleiro intacto. O custo de errar é zero; o valor informacional de errar é alto. Isso torna a experimentação a estratégia dominante — que é exatamente o comportamento de laboratório que se quer treinar.
3. **Projetar o "ahá!".** Cada pack tem ao menos uma fase cuja solução parece impossível até o jogador reenquadrar o problema (ex.: precisar de um NOT e só ter NOTs; precisar duplicar um sinal e descobrir que uma net pode ter vários leitores). A dificuldade é colocada na *ideia*, não na destreza manual.

**Não-objetivos pedagógicos do v1.** Sem lógica sequencial (flip-flops, clock, memória), sem sinais multi-bit, sem temporização/atraso de propagação real, sem mapas de Karnaugh formais. São candidatos de v2 e estão registrados no roadmap (§15).

## 9.B Progressão didática (packs)

Regra estrutural: **um pack introduz no máximo uma mecânica nova e no máximo um conceito novo**, e as três primeiras fases de cada pack são de assimilação (solução quase forçada) antes das fases de aplicação. Total do v1: **6 packs, 24 fases** — alinhado à MI-07.

---

### Pack 1 — "Primeiros sinais" · 3 fases
**Conceito de Eng.:** nível lógico binário; condutor; fonte e carga.
**Mecânica nova:** desenhar fio arrastando o dedo (drag-to-connect).
**O que o jogador descobre:** um sinal sai de uma `source`, percorre o fio e chega ao `sink`; o fio não altera o valor; um sink não alimentado não acende. Fase 3 introduz o primeiro obstáculo de rota (parede), separando "resolver a lógica" de "resolver o caminho".
**Vocabulário liberado:** sinal, 0/1, fonte, destino, fio.

### Pack 2 — "Negações" · 4 fases
**Conceito de Eng.:** inversor; complemento booleano (`Ā`); a primeira tabela-verdade (1 entrada, 2 linhas).
**Mecânica nova:** colocar e **rotacionar** uma porta; lado de entrada vs lado de saída.
**O que o jogador descobre:** a porta NOT troca 0 por 1. Fase final do pack: dois NOTs em série devolvem o valor original — a dupla negação, primeira "lei" booleana descoberta na prática.
**Vocabulário liberado:** porta lógica, entrada, saída, NOT/inversor, tabela-verdade.

### Pack 3 — "E / OU" · 5 fases
**Conceito de Eng.:** conjunção e disjunção; tabela-verdade de 2 entradas (4 linhas); a diferença semântica entre "os dois" e "pelo menos um".
**Mecânica nova:** portas de 2 entradas — o jogador precisa alimentar **dois** lados declarados.
**O que o jogador descobre:** AND só acende com ambas as entradas em 1; OR acende com qualquer uma. Duas fases são gêmeas de propósito (mesmo tabuleiro, alvo diferente) para forçar o contraste AND vs OR. Última fase: alvo que só é satisfeito para **uma** das quatro linhas da tabela, obrigando o jogador a raciocinar por linha.
**Vocabulário liberado:** AND, OR, conjunção, disjunção, linha da tabela-verdade.

### Pack 4 — "Compondo" · 4 fases
**Conceito de Eng.:** composição de funções; expressão booleana com precedência (`·` antes de `+`); circuito de 2 níveis (soma-de-produtos elementar).
**Mecânica nova:** a saída de uma porta alimenta a entrada de outra; a UI passa a exibir a expressão-alvo em notação opcional.
**O que o jogador descobre:** que `(A·B)+C` e `A·(B+C)` são circuitos e resultados diferentes — a precedência deixa de ser regra decorada e vira topologia visível. Fase final exige três portas em dois níveis.
**Vocabulário liberado:** expressão booleana, precedência, nível de porta, composição.

### Pack 5 — "Caminhos" · 5 fases
**Conceito de Eng.:** *net* (nó elétrico) e fan-out; conflito de drivers (curto-circuito); realimentação combinacional (ciclo).
**Mecânica nova:** fios que se encontram formam uma única net; tabuleiros apertados onde a rota é o quebra-cabeça.
**O que o jogador descobre:** (i) um sinal pode alimentar vários destinos — fan-out é de graça; (ii) dois sinais diferentes no mesmo fio é proibido e **por quê**; (iii) um fio que volta para a própria origem não tem valor definido. Uma fase é deliberadamente projetada para o jogador **causar** um curto na primeira tentativa: o erro é o conteúdo da fase.
**Vocabulário liberado:** net, fan-out, curto-circuito, ciclo, sinal flutuante.

### Pack 6 — "Somando bits" · 3 fases
**Conceito de Eng.:** aritmética binária em hardware; meio-somador (soma + vai-um) e somador completo; XOR construído a partir de AND/OR/NOT.
**Mecânica nova:** nenhuma — é o pack de síntese; toda a dificuldade vem da lógica acumulada.
**O que o jogador descobre:** que o mesmo vocabulário de três portas com que ele vinha brincando **constrói uma calculadora**. Fase 1: construir XOR a partir de AND/OR/NOT (o "ahá!" do pack). Fase 2: meio-somador — dois sinks, `Soma` e `Vai-um`. Fase 3 (final da campanha): somador completo com entrada de vem-um, com limite de portas apertado que só é atingível reaproveitando o meio-somador — ensinando **reuso de subcircuito**.
**Vocabulário liberado:** XOR, meio-somador, somador completo, vai-um (carry), soma de bits.

---

**Curva de estrelas por pack (orientação para MI-07):** packs 1–2 com limites generosos (3 estrelas quase automáticas — a recompensa é a fluência); packs 3–4 com o limite de peças exigindo rota enxuta; packs 5–6 com o limite de **portas** apertado, obrigando simplificação real. Nenhum limite pode ser fixado no olho: todos são derivados do solver (aceite da MI-07).

## 9.C Feedback pedagógico

### 9.C.1 Regras de mensagem de erro

O core devolve `issues[]` tipados (§4.4); a UI traduz cada `kind` em **três camadas**: título curto, explicação de aprendiz e ação sugerida. Regras invioláveis:

- **Nunca vocabulário de implementação** ("SCC detectado", "union-find", "driver conflict") na primeira camada. O termo técnico aparece só no painel de conceito, depois da metáfora.
- **Sempre apontar no tabuleiro**: toda mensagem destaca as `cells[]` do diagnóstico. Texto sem highlight é proibido.
- **Nunca dizer o que fazer na primeira mensagem** — descreve o que *está acontecendo*, não a correção. Corrigir é papel da dica (nível 2).
- **Tom neutro-curioso**, nunca de reprovação. "Olha só o que aconteceu", não "Você errou".

| `kind` | Título | Explicação de aprendiz | Ação sugerida |
|---|---|---|---|
| `short` | Dois donos no mesmo fio | "Dois sinais diferentes estão brigando no mesmo fio: um manda 0, o outro manda 1, e o fio não consegue ser os dois. Na eletrônica de verdade, isso é um **curto-circuito**." | "Separe os caminhos ou faça os dois passarem por uma porta." |
| `cycle` | Um fio que depende de si mesmo | "Esta saída volta como sua própria entrada. Para saber o valor, ele precisaria já saber o valor — a pergunta se morde." | "Quebre o laço: alguma entrada precisa vir de fora." |
| `floating` | Fio sem ninguém falando | "Este fio não está ligado a nenhuma fonte. Ele não vale 0 — ele simplesmente não tem valor ainda." | "Ligue este trecho a uma fonte ou à saída de uma porta." |
| `unpowered-gate` | Porta com entrada faltando | "Esta porta espera 2 entradas e só recebeu 1. Sem as duas, ela não sabe o que responder." | "Alimente o lado destacado da porta." |
| *sinks insatisfeitos* | Quase lá | "O circuito funciona, mas o destino esperava **{esperado}** e recebeu **{obtido}**." | "Confira a tabela-verdade da porta no painel **?**." |

Mensagens de sucesso também ensinam: ao vencer, o modal mostra a **linha da tabela-verdade que o jogador acabou de satisfazer** e, quando aplicável, a expressão do circuito construído.

### 9.C.2 Dicas em dois níveis

Todo `LevelSpec` carrega `hints: [nivel1, nivel2]` (campo já previsto em §3.4). Contrato pedagógico:

- **Nível 1 — empurrão conceitual.** Reformula o objetivo ou nomeia o conceito necessário, **sem** referenciar células. Ex.: *"Você precisa que o destino acenda só quando as duas fontes valem 1. Que porta responde 'sim' apenas nesse caso?"*
- **Nível 2 — solução parcial.** Revela **uma** decisão concreta (que porta, onde, com que rotação), nunca o traçado completo. Ex.: *"Coloque um AND na coluna do meio, com as entradas voltadas para as duas fontes. O resto do caminho é fio."*
- Nunca existe nível 3 / "resolver por mim" no v1: a fase precisa ser vencível pelo jogador.
- **Custo:** usar dica não bloqueia a 1ª estrela (resolver); marca a fase com um selo "resolvida com dica" no seletor de fases, que some se o jogador refizer sem dica. Estímulo sem punição.
- Nível 2 só desbloqueia após 1 simulação falha **ou** 60s na fase — para não virar botão de pular.

### 9.C.3 Painel de conceito ("?")

Acessível **a qualquer momento**, dentro e fora de fase, sem pausar nem penalizar. Conteúdo contextual ao que a fase usa:

- **Cabeçalho:** nome do componente/termo em foco (porta atual selecionada, ou o conceito do pack).
- **Corpo:** definição em uma frase + desenho do símbolo + **tabela-verdade interativa** (o jogador toca numa linha e o mini-diagrama mostra aquele caso animado).
- **Rodapé:** "onde isso aparece de verdade" — uma linha ligando o conceito à Engenharia de Computação real (ex.: "somadores como este estão dentro da ULA de qualquer processador").
- **Índice:** o painel sempre oferece acesso ao glossário completo (§9.D), independente do contexto.
- Registro de tabelas-verdade: linhas que o jogador já observou em jogo aparecem **preenchidas e destacadas**; as não observadas ficam em cinza. Cria coleção sem gamificação artificial.

## 9.D Glossário do jogo

Fonte única em `packages/content`, consumida pelo painel de conceito. Termo → explicação curta, linguagem de aprendiz, sem pressupor a próxima linha.

| Termo | Explicação |
|---|---|
| **Sinal** | O valor que corre pelo fio. Só existem dois: **0** (desligado) e **1** (ligado). |
| **0 / 1** | Os dois estados possíveis de um sinal. Em eletrônica: sem tensão e com tensão. |
| **Fonte (source)** | Célula que **produz** um sinal fixo. É de onde a informação começa. |
| **Destino (sink)** | Célula que **espera** receber um valor específico. Acertar todos os destinos vence a fase. |
| **Fio** | Caminho por onde o sinal anda. O fio não muda o valor — só o transporta. |
| **Net** | Todos os fios ligados entre si formam **uma coisa só**: uma net. Uma net tem um único valor no tabuleiro inteiro. |
| **Driver** | Quem manda o valor numa net (uma fonte ou a saída de uma porta). Uma net precisa de exatamente um. |
| **Fan-out** | Um mesmo sinal alimentando vários destinos. É permitido e de graça — ler não gasta. |
| **Curto-circuito** | Dois drivers diferentes na mesma net: um manda 0, o outro manda 1. O fio não pode ser os dois — é um erro. |
| **Ciclo** | A saída de um circuito volta como a própria entrada, sem nada de fora. O valor fica indefinido. |
| **Flutuante** | Fio sem nenhum driver. Não vale 0 — não vale nada. |
| **Porta lógica** | Caixa que recebe sinais e produz um sinal novo, sempre pela mesma regra. |
| **NOT (inversor)** | Uma entrada. Devolve o oposto: 0 vira 1, 1 vira 0. |
| **AND (E)** | Duas entradas. Devolve 1 **só** quando as duas valem 1. |
| **OR (OU)** | Duas entradas. Devolve 1 quando **pelo menos uma** vale 1. |
| **XOR (OU exclusivo)** | Devolve 1 quando as entradas são **diferentes**. Não é uma peça: você constrói com AND, OR e NOT. |
| **Tabela-verdade** | Lista de **todos** os casos possíveis de entrada e o que a porta responde em cada um. Descreve a porta por completo. |
| **Expressão booleana** | Jeito escrito de dizer o mesmo que o circuito. `A·B` é AND, `A+B` é OR, `Ā` é NOT. |
| **Precedência** | Ordem de leitura: o `·` (AND) vem antes do `+` (OR). `A·B+C` é `(A·B)+C`. |
| **Combinacional** | Circuito cuja saída depende **só** das entradas de agora — sem memória do passado. Todo circuito deste jogo é assim. |
| **Nível de porta** | Quantas portas o sinal atravessa da entrada até a saída. Menos níveis = circuito mais raso. |
| **Meio-somador** | Soma dois bits e devolve duas respostas: a **soma** e o **vai-um**. |
| **Vai-um (carry)** | O "vai um" da soma: quando 1 + 1 dá 10 em binário, o 1 da frente é o vai-um. |
| **Somador completo** | Meio-somador que também aceita o vai-um vindo da soma anterior. É assim que se somam números de vários bits. |
| **Otimizar** | Fazer a mesma coisa com menos peças ou menos portas. Circuito menor é mais barato e mais rápido de verdade. |

## 9.E Integração com o sistema de estrelas

O esquema de 3 estrelas (§5.2) é reinterpretado como **três níveis de compreensão**, e a UI nomeia cada estrela — a estrela sem nome não ensina nada:

| Estrela | Critério técnico | Nome na UI | O que atesta pedagogicamente |
|---|---|---|---|
| ★1 **Funciona** | todos os sinks satisfeitos | "Circuito completo" | O jogador **produziu** o comportamento pedido: síntese bem-sucedida. |
| ★2 **Enxuto** | ≤ limite de peças (fios+portas) | "Rota limpa" | Entendeu a topologia: sabe rotear sem desperdício. Ataca o hábito de resolver por tentativa e ruído. |
| ★3 **Mínimo** | ≤ limite de **portas** | "Lógica mínima" | **Minimização booleana.** Só se atinge percebendo uma equivalência lógica (dupla negação, absorção, reuso de subcircuito). É a estrela do entendimento. |

Regras de integração:

- **★3 é sempre a estrela conceitual**, nunca de destreza ou tempo. Não existe estrela por rapidez no v1 — velocidade não é aprendizado e penaliza quem pensa.
- **Explicar a estrela perdida.** O modal de vitória com 2/3 estrelas mostra: *"Você usou 4 portas; dá para fazer com 3. Existe uma simplificação escondida aqui."* — e oferece **Tentar de novo** ao lado de **Próxima fase**. Nunca revela qual é a simplificação.
- **★3 obtida abre o "porquê".** Ao fechar a terceira estrela, o painel de conceito abre (opt-in, um toque) mostrando a identidade booleana que o jogador acabou de usar — o momento em que a prática vira nome: *"O que você fez tem nome: `A·B + A·B̄ = A`."* Ensinar a teoria **depois** da descoberta, nunca antes.
- **Progressão não é bloqueada por estrelas.** Avançar exige apenas ★1. Estrelas destravam conteúdo lateral (fases-desafio bônus por pack), nunca a campanha principal — quem não otimiza não fica preso, e quem otimiza tem mais jogo.
- **Selo de pack** ao fechar todas as ★3 de um pack, com o nome do conceito dominado ("Álgebra de duas entradas", "Aritmética binária") — reconhecimento em vocabulário de engenharia.

---
