// Glossário do jogo (SDD §9.D) — termo → explicação curta em linguagem de
// aprendiz. Consumido pelo painel de conceito (MI-20). Sem dependência de DOM.

export interface GlossaryEntry {
  readonly term: string
  readonly explanation: string
}

export const GLOSSARY: readonly GlossaryEntry[] = [
  { term: 'Sinal', explanation: 'O valor que corre pelo fio. Só existem dois: 0 (desligado) e 1 (ligado).' },
  { term: '0 / 1', explanation: 'Os dois estados possíveis de um sinal. Em eletrônica: sem tensão e com tensão.' },
  { term: 'Fonte (source)', explanation: 'Célula que produz um sinal fixo. É de onde a informação começa.' },
  { term: 'Destino (sink)', explanation: 'Célula que espera receber um valor específico. Acertar todos os destinos vence a fase.' },
  { term: 'Fio', explanation: 'Caminho por onde o sinal anda. O fio não muda o valor — só o transporta.' },
  { term: 'Net', explanation: 'Todos os fios ligados entre si formam uma coisa só: uma net. Uma net tem um único valor no tabuleiro inteiro.' },
  { term: 'Driver', explanation: 'Quem manda o valor numa net (uma fonte ou a saída de uma porta). Uma net precisa de exatamente um.' },
  { term: 'Fan-out', explanation: 'Um mesmo sinal alimentando vários destinos. É permitido e de graça — ler não gasta.' },
  { term: 'Curto-circuito', explanation: 'Dois drivers diferentes na mesma net: um manda 0, o outro manda 1. O fio não pode ser os dois — é um erro.' },
  { term: 'Ciclo', explanation: 'A saída de um circuito volta como a própria entrada, sem nada de fora. O valor fica indefinido.' },
  { term: 'Flutuante', explanation: 'Fio sem nenhum driver. Não vale 0 — não vale nada.' },
  { term: 'Porta lógica', explanation: 'Caixa que recebe sinais e produz um sinal novo, sempre pela mesma regra.' },
  { term: 'NOT (inversor)', explanation: 'Uma entrada. Devolve o oposto: 0 vira 1, 1 vira 0.' },
  { term: 'AND (E)', explanation: 'Duas entradas. Devolve 1 só quando as duas valem 1.' },
  { term: 'OR (OU)', explanation: 'Duas entradas. Devolve 1 quando pelo menos uma vale 1.' },
  { term: 'XOR (OU exclusivo)', explanation: 'Devolve 1 quando as entradas são diferentes. Não é uma peça: você constrói com AND, OR e NOT.' },
  { term: 'Tabela-verdade', explanation: 'Lista de todos os casos possíveis de entrada e o que a porta responde em cada um. Descreve a porta por completo.' },
  { term: 'Expressão booleana', explanation: 'Jeito escrito de dizer o mesmo que o circuito. A·B é AND, A+B é OR, Ā é NOT.' },
  { term: 'Precedência', explanation: 'Ordem de leitura: o · (AND) vem antes do + (OR). A·B+C é (A·B)+C.' },
  { term: 'Combinacional', explanation: 'Circuito cuja saída depende só das entradas de agora — sem memória do passado. Todo circuito deste jogo é assim.' },
  { term: 'Nível de porta', explanation: 'Quantas portas o sinal atravessa da entrada até a saída. Menos níveis = circuito mais raso.' },
  { term: 'Meio-somador', explanation: 'Soma dois bits e devolve duas respostas: a soma e o vai-um.' },
  { term: 'Vai-um (carry)', explanation: 'O "vai um" da soma: quando 1 + 1 dá 10 em binário, o 1 da frente é o vai-um.' },
  { term: 'Somador completo', explanation: 'Meio-somador que também aceita o vai-um vindo da soma anterior. É assim que se somam números de vários bits.' },
  { term: 'Otimizar', explanation: 'Fazer a mesma coisa com menos peças ou menos portas. Circuito menor é mais barato e mais rápido de verdade.' },
]

/** Busca um verbete pelo termo exato. Retorna undefined quando não existe. */
export function glossaryEntry(term: string): GlossaryEntry | undefined {
  return GLOSSARY.find(entry => entry.term === term)
}
