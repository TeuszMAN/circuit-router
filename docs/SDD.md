# SDD v2 — Circuit Router

> Aceito em 2026-09-05 pelo PO. Decisões técnicas: [ADR-0001](adr/0001-fundacao-tecnica.md).
> Este documento é o esqueleto aprovado; o detalhamento completo acontece na MI-14.
> A seção de currículo educacional (aprender Eng. de Computação) é incorporada em etapa dedicada (Fase A.5).


**1. Visão do produto** — 1.1 Pitch e fantasia (roteador de sinais); 1.2 Público e plataforma-alvo (mobile web, PWA instalável); 1.3 Loop de jogo (observar → rotear → simular → otimizar por estrelas); 1.4 Escopo do v1 e não-objetivos explícitos (sem backend, sem multiplayer, sem contas).

**2. Arquitetura** — 2.1 Diagrama de camadas: `content` → `core` → `app` (UI); 2.2 Regra de dependência unidirecional (core nunca importa DOM, UI nunca reimplementa lógica); 2.3 Monorepo e workspaces; 2.4 Subpath exports do core e por que não há barrel; 2.5 Build e ambientes (dev / preview / build PWA).

**3. Modelo de domínio** — 3.1 `Coord`, `Direction`, `Signal = 0 | 1 | undefined`; 3.2 Tipos de célula (`Empty`, `Source`, `Sink`, `Wire`, `Gate`); 3.3 Portas: aridade, lados de entrada **declarados explicitamente** (fim da regra "todos os lados menos a saída"), rotação; 3.4 `LevelSpec` (grid, células fixas, inventário de peças, alvos de estrela, dicas) — schema versionado; 3.5 `BoardState` (camada editável pelo jogador, separada da imutável do nível); 3.6 Serialização e regras de compatibilidade.

**4. Simulação** — 4.1 Construção de *nets* por union-find sobre fios adjacentes; 4.2 Grafo de drivers/leitores por net; 4.3 Ordenação topológica e avaliação; 4.4 **Diagnósticos como dados, não exceções**: `{ ok, sinks[], issues: [{ kind: 'short'|'cycle'|'floating'|'unpowered-gate', cells[] }] }`; 4.5 Distinção formal entre curto (dois drivers conflitantes na mesma net) e ciclo combinacional (SCC no grafo de portas); 4.6 Complexidade alvo O(células + arestas) e orçamento por frame; 4.7 Traço de propagação em passos, consumido pela animação.

**5. Condição de vitória e pontuação** — 5.1 Satisfação de todos os sinks; 5.2 Três estrelas: resolver / abaixo do limite de peças / abaixo do limite de portas; 5.3 Persistência do melhor resultado por fase.

**6. Estado do jogador e comandos** — 6.1 Padrão Command (`PlaceWire`, `PlaceGate`, `Rotate`, `Erase`, `DragPath`, `Clear`); 6.2 Pilhas de undo/redo e coalescência de um traço inteiro em um comando; 6.3 Invariantes (nunca sobrescrever célula fixa do nível).

**7. Interface e interação (touch-first)** — 7.1 Layout responsivo (tabuleiro maximizado, HUD em barras seguras com `safe-area-inset`); 7.2 Pointer Events unificados, `touch-action: none`, alvos ≥44px; 7.3 Drag-to-connect: traço contínuo com quantização e correção de diagonais; 7.4 Pinch-zoom e pan com clamp; 7.5 Rotação de porta por toque na peça selecionada; 7.6 Undo/redo, hint e limpar no HUD; 7.7 Feedback: highlight de erro, tooltip de diagnóstico, haptics (`navigator.vibrate`) opcional.

**8. Renderização** — 8.1 Canvas 2D único, `devicePixelRatio`, resize observer; 8.2 Camadas lógicas (fundo/grade, células fixas, peças do jogador, sinal animado, overlay de seleção); 8.3 Render sob demanda (dirty flag) vs `requestAnimationFrame` durante animação; 8.4 Animação de propagação a partir do traço da simulação; 8.5 Tokens de tema (paleta, glow de sinal 0/1, estados de erro) e `prefers-reduced-motion`.

**9. Conteúdo e progressão** — 9.1 Formato `LevelSpec` em JSON e organização em packs; 9.2 Currículo da campanha: tutorial implícito → NOT → OR → AND → composição → curto/roteamento → otimização; 9.3 Fases handmade vs geradas; 9.4 Gerador procedural: sorteio de alvo, síntese de circuito de referência, poda, **validação obrigatória pelo solver** e estimativa de dificuldade; 9.5 Modo sandbox e editor de fases (export/import de JSON).

**10. Persistência** — 10.1 Envelope versionado em `localStorage`; 10.2 Conteúdo (progresso, estrelas, config, mute, tema, rascunhos do sandbox); 10.3 Migrações e recuperação de save corrompido; 10.4 Ponto de extensão para sync remoto (interface de repositório, sem implementação no v1).

**11. Áudio** — 11.1 WebAudio com desbloqueio no primeiro gesto; 11.2 SFX curtos sintetizados (colocar, apagar, sucesso, erro); 11.3 Música ambiente opcional; 11.4 Mute persistido e respeito à sessão silenciosa.

**12. PWA e distribuição** — 12.1 Manifest e ícones; 12.2 Estratégia de service worker e atualização; 12.3 Garantias offline; 12.4 Fontes e assets auto-hospedados.

**13. Estratégia de testes** — 13.1 Vitest e workspace; 13.2 Unitários do core (tabelas-verdade, nets, curto, ciclo, flutuante); 13.3 Property-based no gerador (toda fase gerada tem solução); 13.4 Round-trip de serialização e migração de save; 13.5 Testes de comandos/undo; 13.6 Testes de componentes do HUD em jsdom; 13.7 Fumaça: toda fase de `content` é resolvível pelo solver.

**14. Qualidade e convenções** — 14.1 TS strict, sem `any` no core; 14.2 Fronteiras de arquivo por área e um commit por tarefa; 14.3 Conventional Commits em PT-BR; 14.4 Orçamentos de bundle e de tempo de simulação.

**15. Roadmap pós-v1** — leaderboard e save na nuvem (exigiria backend e nova ADR), portas XOR/NAND, componentes multi-célula, sinais multi-bit, fases da comunidade.
