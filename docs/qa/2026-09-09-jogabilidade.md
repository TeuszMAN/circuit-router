# Investigação de bloqueios de jogabilidade

Data de encerramento: 09/09/2026. Base: `d51b71e`. Referência de comportamento: SDD §§3–7 e currículo §9.

O fluxo da fase 1 foi jogado até vencer e avançar no navegador. Também foram vencidas as fases Sinal zero, Desvio e Um sinal, dois destinos. As 24 fases passaram por montagem via eventos de ponteiro em testes de integração da aplicação. Todos os defeitos identificados abaixo foram corrigidos; isso não constitui prova de ausência de qualquer outro bug.

## 1. Bloqueios, causas e reprodução

**N** = observado diretamente no navegador; **A** = reproduzido em teste automatizado; **E** = conclusão por inspeção de código/spec. A coluna de evidência distingue a reprodução do defeito da verificação posterior.

| Defeito e reprodução antes da correção | Causa-raiz e correção | Regressão e evidência |
| --- | --- | --- |
| **Fases com parede travavam.** Abrir Desvio (`p1-3`) e tentar desenhar/simular. | O grafo elétrico tratava `empty` fixo como porta e acessava `DELTA[undefined]`. A exceção também interrompia a composição antes de completar a configuração do input. Paredes agora permanecem na ocupação, mas não entram como drivers elétricos. | **N:** TypeError em `neighbor/buildGraph` na versão inicial; Desvio vencida depois. **A:** `evaluate.test.ts`: parede não lança, não conduz e pode ser contornada; campanha completa. |
| **Obstáculo invisível.** Na mesma fase, a célula bloqueada parecia livre. | O painter de `empty` não desenhava nada. Agora a parede tem preenchimento próprio e marca ×. | **N:** inspeção visual antes/depois em Desvio. **A:** `walls.test.ts` distingue parede de célula livre. |
| **Continuar um fio quebrava o trecho anterior; ramificar desconectava um destino.** Desenhar fonte→célula e depois célula→destino, ou acrescentar um ramo a uma linha. | `dragWires` substituía os lados existentes. Agora faz união dos conectores; repetir o mesmo traço não altera histórico nem descarta redo. | **A:** `editor.test.ts` cobre continuidade, ramificação, undo/redo e repetição. `gameplay.test.tsx` cobre fase 1 em etapas e fan-out. **N após correção:** ambos os fluxos vencidos por arrastos separados. |
| **Conectar uma porta do jogador apagava a própria porta.** Colocar NOT e arrastar fio até/através dela. | O traço substituía qualquer peça editável por fio. Agora preserva portas e edita apenas as células de fio do trajeto. | **A:** `editor.test.ts` e cenário NOT editável em `gameplay.test.tsx`, incluindo vitória. A campanha atual usa portas fixas; esse caso foi exercitado em uma fase de teste. |
| **Arrasto rápido podia perder a célula final.** Soltar em outra célula sem um último `pointermove`. | O controlador encerrava apenas o caminho acumulado nos movimentos. Agora inclui a posição do `pointerup`. | **A:** `pointer-input-controller.test.ts`, caso explícito sem movimento final. |
| **Seleção, rotação e borracha interferiam umas nas outras.** Selecionar uma porta, alternar ferramenta e tocar novamente; selecionar uma porta já orientada podia recriá-la. | A composição fazia edição no callback de seleção, enquanto o controlador interpretava segundo toque como rotação sem considerar a ferramenta. Agora comandos consideram a ferramenta ativa, seleção não coloca peças e borracha emite apagar. | **A:** cenário integrado coloca/rotaciona/conecta/apaga NOT e desfaz a exclusão. A composição também atualiza o destaque de seleção e limpa diagnósticos ao editar; o fluxo da fase 1 verifica a remoção dos issues após corrigir o circuito. |
| **Falha de áudio impedia editar.** API `AudioContext` ausente ou construtor recusado no primeiro gesto. | `unlock()` lançava antes de executar a edição. A criação do contexto agora pode falhar sem interromper o comando. | **A:** `audio-bus.test.ts` simula construtor que lança; integração vence e avança sem AudioContext. Não foi provocada falha de áudio no navegador real. |
| **Storage recusado podia impedir início ou vitória/avanço.** Getter de localStorage lança `SecurityError`, ou gravação de resultado lança por quota/permissão. | O acesso inicial e as gravações propagavam exceções. Adaptador acessa storage dentro das operações protegidas; SaveStore mantém progresso em memória, informa a falha e tenta persistir novamente em próxima gravação. | **A:** `ui/state.test.ts` cobre getter; `persist/save.test.ts` cobre falha e recuperação; integração vence/avança com gravação recusada e aviso de progresso só na sessão. **N:** persistência normal confirmada após recarga. |
| **Inventário não tinha efeito, permitindo circuitos fora das regras.** Selecionar AND com estoque zero ou desenhar mais fios que o limite. | Editor não validava estoque; paleta oferecia todos os tipos sem quantidades. Agora valida o estado final atomicamente, conta só peças do jogador, devolve estoque ao apagar/desfazer e mostra disponibilidade. Tipo omitido significa zero; `null`, ilimitado. | **A:** três casos em `inventory.test.ts` cobrem porta indisponível, excesso sem edição parcial/perda de redo, reposição/rotação/conexão sem peça extra. UI e integração verificam portas desabilitadas. **N após correção:** quantidades e ferramentas indisponíveis visíveis. |
| **Zoom não alterava o tabuleiro.** Pinch modificava o estado interno, mas o desenho permanecia igual. | A composição não encaminhava viewport ao renderer. Agora pintura e conversão de toque usam a mesma transformação; botões +/−/Ajustar complementam pinch. A montagem mede tamanho e DPR antes do primeiro ResizeObserver. | **A:** `canvas-board-renderer.test.ts` cobre inicialização, transformação e hit-test; integração cobre dois ponteiros sem desenhar fios e botões conectados ao renderer. **N após correção:** ampliar e Ajustar conferidos visualmente. Pinch físico não foi testado. |
| **Três estrelas indevidas e explicação do critério errado.** Vencer acima do limite de peças, mas dentro do limite de portas. | O cálculo atribuía 3 ao cumprir portas, sobrescrevendo a estrela de rota perdida. Modal inferia conquistas pelo total e falava de portas mesmo quando faltava otimizar fios. `scoreSolution` agora calcula cada conquista independentemente; modal recebe os critérios reais. | **A:** `scoring.test.ts` cobre as quatro combinações de limites; `result-modal.test.tsx` cobre rota longa e explicação correta. É defeito de pontuação/feedback, não travamento do avanço. |
| **A API de avaliação transformava sinal ausente em bit definido.** Chamar `evaluateGate` com `undefined` ou quantidade incompleta de entradas. | Coerções booleanas na função pública contrariavam SDD §4.3. Agora retorna `undefined` para entrada indefinida/aridade inválida. | **A:** `evaluate.test.ts`, regressão da API pública. A simulação já tinha proteções próprias; não se atribui a esse helper o travamento observado em Desvio. |
| **Diagnóstico de ciclo ausente ou apontando porta inocente.** Realimentar AND deixando outra entrada desconectada; ligar NOT somente a jusante de um laço. | O conjunto de portas não resolvidas era usado como aproximação de ciclo. Isso perdia ciclos com entrada faltante e incluía consumidores externos. Agora usa componentes fortemente conexas reais (Tarjan). | **A:** dois casos em `evaluate.test.ts`, primeiro reproduzidos falhando e depois aprovados: ciclo com entrada desconectada e consumidor externo excluído. Não exercitado diretamente no navegador. |

Além dos bugs, foi acrescentada orientação curta por ferramenta: como arrastar entre conectores, continuar um fio em outro gesto e simular. Isso torna a interação descobrível sem alterar o objetivo das fases.

## 2. Por que a suíte inicial não flagrou os bloqueios

A base passava **903 testes em 32 arquivos**. Os testes e o solver removiam paredes da especificação antes de simular soluções, mascarando justamente a exceção do motor com fases reais. Essa filtragem foi removida; a validação agora usa o LevelSpec integral.

Também faltava atravessar conjuntamente input, composição, editor, simulação, vitória e navegação. A nova suíte `apps/game/src/app/gameplay.test.tsx` monta a aplicação real e envia `PointerEvent`; não injeta um BoardState resolvido. Desenho Canvas e geometria do ambiente são simulados em jsdom. Há 29 casos nesse arquivo, incluindo um por fase: 21 referências vêm do solver e três são manuais (`p5-2`, `p5-3`, `p6-3`, fora da topologia suportada pelo solver v1). Todos exigem vitória, três estrelas gravadas e ação de próxima fase/saída disponível. O clique de avanço é exercitado pelo fluxo específico da fase 1.

O arrasto contínuo da fase 1 **já funcionava na versão inicial**, e foi jogado até avançar. Não foi possível reproduzir uma impossibilidade universal de jogar a fase 1. Foram encontrados bloqueios concretos em edição incremental, fases com paredes e condições de ambiente, além das violações de regra e feedback acima.

## 3. Evidências de verificação final

| Verificação | Resultado |
| --- | --- |
| `npm test` | **979/979 testes; 37/37 arquivos; exit 0.** Execução final: 17,53 s. |
| `npm run typecheck` | **Limpo**, os três projetos; exit 0. |
| `npm run build` | **Sucesso**, bundle e service worker gerados; precache de 17 entradas. Isso não prova funcionamento offline. |
| `git diff --check` | Sem erros de whitespace. |
| Navegador real, servidor Vite local | Fluxos abaixo concluídos; consulta final ao log de erros retornou `[]`. |

Partidas realizadas no navegador integrado, com viewport **360×640** na conferência final:

1. **Primeiro sinal:** menu → seleção → simular vazio → diagnóstico → continuar → montar em dois arrastos → desfazer/refazer → simular → vitória com três estrelas → próxima fase Sinal zero.
2. **Sinal zero:** montar rota com curva → simular → três estrelas → avançar para Desvio. Isso também confirma visualmente propagação de zero como sinal válido.
3. **Desvio:** ver parede × → contornar por cima com cinco arrastos → simular → três estrelas → avançar para Primeira negação.
4. **Um sinal, dois destinos:** ampliar pelo botão → conferir mudança visual → Ajustar → montar tronco e dois ramos em gestos separados → simular → ambos os destinos satisfeitos e três estrelas.
5. **Persistência:** recarregar a página → Jogar → as quatro fases acima exibem três estrelas. Sinal zero, Desvio e Um sinal, dois destinos tinham zero antes dessas partidas.

Os screenshots e estados de acessibilidade foram inspecionados durante a sessão; este relatório não inclui arquivos de captura exportados. As outras 20 fases foram verificadas por integração automatizada, não jogadas individualmente no navegador.

## 4. Commits locais

| Commit | Tarefa |
| --- | --- |
| `1a92e45` | Corrigir simulação e visibilidade de paredes. |
| `5ab4335` | Preservar circuitos em gestos e corrigir ferramentas de edição. |
| `377d595` | Manter jogabilidade quando áudio ou save falham. |
| `6bedf42` | Respeitar inventário e orientar montagem. |
| `fb12c66` | Conectar zoom à pintura e ao toque. |
| `965a4f7` | Corrigir critérios e explicações de estrelas. |
| `c351d6a` | Preservar sinais indefinidos e identificar ciclos reais. |
| `cc61ed9` | Validar as 24 fases por gestos de ponteiro. |

O relatório é registrado em commit documental separado. Commits seguem Conventional Commits em português, identidade local e sem trailers. Nenhum push foi executado.

## 5. Observações fora do escopo concluído

- **Design/currículo:** os dados atuais da campanha oferecem zero portas para colocar; as portas são fixas. O jogador predominantemente roteia circuitos já estruturados. Isso limita a promessa de descobrir simplificações escolhendo/removendo portas, especialmente a recompensa “Lógica mínima”. É uma divergência pedagógica observada no conteúdo frente ao pitch/§9 do SDD, não uma conclusão de pesquisa com jogadores. A investigação corrigiu jogabilidade e orientação visual; não redesenhou a campanha nem produziu nova direção artística. Fases com escolha de portas demandam autoria e validação adequadas às limitações documentadas do solver.
- Não foram testados dispositivos Android/iOS físicos, pinch físico, instalação PWA, modo offline ou desempenho sustentado de animação. Viewport reduzido em navegador desktop não substitui esses testes.
- Falhas de storage/áudio, detalhes de ciclo, aridade e combinações de estrelas têm evidência automatizada, não reprodução dessas condições em um celular real.
- Saves antigos não foram migrados para retirar estrelas eventualmente concedidas pelo cálculo anterior; a política de preservar o melhor resultado continua valendo.
