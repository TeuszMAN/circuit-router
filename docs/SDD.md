# Software Design Document (SDD) - Logic Router

## 1. Visão Geral
**Logic Router** é um jogo mobile 2D em HTML5/JavaScript baseado em grid. O objetivo do jogador é conectar pinos de saída (Sinais) a atuadores (Destinos) utilizando trilhas e Portas Lógicas (AND, OR, NOT) para garantir que o sinal que chegue ao destino seja o correto. As trilhas não podem se cruzar.

## 2. Arquitetura do Sistema
A arquitetura do jogo é baseada na separação de responsabilidades (Model-View-Controller/Engine):

*   **Core Logic (Engine/Model):** Responsável por toda a parte matemática, estado do grid, propagação de sinais e validação do circuito. Totalmente agnóstico de interface gráfica.
*   **Interface (View):** Renderização gráfica usando HTML5/CSS/Canvas (ou DOM), captação de eventos de touch/drag.
*   **Controller:** Faz a ponte entre as ações do usuário (arrastar portas, desenhar trilhas) e as validações da Engine, atualizando a View conforme necessário.

## 3. Matriz do Grid
O cenário do jogo é representado por uma malha bidimensional (Matriz `M x N`).
Cada célula da matriz pode conter:
*   `Empty`: Espaço vazio.
*   `Source`: Ponto de origem de um sinal (0 ou 1 constante).
*   `Sink`: Ponto de destino (Atuador) que espera um valor específico (0 ou 1).
*   `Wire`: Trilha que conduz o sinal. Possui estado de condutividade (conectado aos vizinhos Cima, Baixo, Esquerda, Direita).
*   `LogicGate`: Um componente que recebe 1 ou 2 sinais de entrada e produz 1 sinal de saída.

### Restrições da Matriz
*   Apenas um componente por célula.
*   Fios não podem se cruzar (uma célula de fio não pode propagar sinais cruzados de forma independente, todos os fios conectados a uma célula formam o mesmo nó elétrico).

## 4. Portas Lógicas (Componentes)
As portas lógicas são classes que estendem um componente base. Elas têm orientações (Norte, Sul, Leste, Oeste) que definem de onde recebem entrada e para onde enviam a saída.

*   **NOT Gate:** 1 entrada, 1 saída. Inverte o sinal (1 -> 0, 0 -> 1).
*   **AND Gate:** 2 entradas, 1 saída. Requer que ambas as entradas sejam 1 para emitir 1.
*   **OR Gate:** 2 entradas, 1 saída. Emite 1 se pelo menos uma entrada for 1.

## 5. Algoritmo de Verificação (Pathfinding & Validação do Circuito)

A avaliação do circuito não é em tempo real, mas "tick-based" ou ativada por um evento "Play/Simulate".
A resolução do circuito segue os seguintes passos:

1.  **Construção do Grafo:**
    *   Percorrer a malha e agrupar células de `Wire` conectadas num único "Nó (Net)".
    *   Identificar as conexões de entradas e saídas entre `Sources`, `Sinks` e `LogicGates` com os Nós formados.
2.  **Identificação de Ciclos e Curto-circuitos:**
    *   Sinais múltiplos diferentes não podem ser conectados no mesmo fio.
3.  **Avaliação Topológica (Propagação):**
    *   Inicializar todos os Sinais com estado `undefined`.
    *   Atribuir valores iniciais a partir dos `Sources`.
    *   Criar uma fila (Queue) de componentes a serem avaliados.
    *   Propagar o sinal pelos fios até as entradas das Portas Lógicas e Destinos.
    *   Sempre que todas as entradas necessárias de uma Porta Lógica receberem sinal, calcular a saída e propagar o resultado para o fio de saída.
    *   Continuar até a fila se esgotar.
4.  **Verificação de Vitória:**
    *   Após a propagação completa, verificar se todos os `Sinks` receberam os sinais esperados estipulados para a fase.
    *   Verificar se nenhum fio sem conexão (solto) inviabiliza o circuito.
