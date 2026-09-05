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
