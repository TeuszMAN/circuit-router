// Alvo lógico das fases geradas (MI-05): sorteio de expressão/estrutura de
// referência e avaliação determinística.
//
// Família de funções suportada: single-output sobre m <= 3 variáveis,
// realizada como um "comb" — dobra (fold) sobre uma permutação das variáveis
// com merges AND/OR, mais cadeias de NOT injetadas nas folhas e na raiz.
// Cadeias de comprimento par são no-ops lógicos (dupla negação), mas contam
// como portas fixas: é o mecanismo que permite *orçar exatamente* o nº de
// portas de cada fase sem trocar a função-alvo (SDD §9.4 — dificuldade por
// nº de portas, profundidade e rota, não por tabela-verdade maior).
//
// A expressão exibida na UI é a forma reduzida (por paridade das cadeias);
// o circuito físico de referência, não — ele carrega as portas exatas.

import type { Rng } from './rng'

export type MergeOp = 'AND' | 'OR'

export interface CircuitSpec {
  /** Nº de variáveis de entrada. */
  readonly inputs: number
  /** Ordem das variáveis (índices 0..inputs-1) no comb. */
  readonly order: readonly number[]
  /** Merge entre o acumulador e a i-ésima variável da ordem (length = inputs-1). */
  readonly ops: readonly MergeOp[]
  /** NOTs fixos na folha de cada posição da ordem (length = inputs). */
  readonly leafChains: readonly number[]
  /** NOTs fixos na saída (raiz). */
  readonly rootChain: number
}

/** Conta todas as portas fixas do circuito de referência. */
export function countGates(spec: CircuitSpec): number {
  let total = spec.inputs - 1 // merges
  for (const chain of spec.leafChains) total += chain
  total += spec.rootChain
  return total
}

/** Valor da função-alvo para uma atribuição (um bit por variável, índice 0..inputs-1). */
export function evaluateSpec(spec: CircuitSpec, bits: readonly (0 | 1)[]): 0 | 1 {
  let acc: 0 | 1 = applyChain(bits[spec.order[0] as number] as 0 | 1, spec.leafChains[0] as number)
  for (let i = 1; i < spec.inputs; i++) {
    const operand = applyChain(bits[spec.order[i] as number] as 0 | 1, spec.leafChains[i] as number)
    acc = merge(spec.ops[i - 1] as MergeOp, acc, operand)
  }
  return applyChain(acc, spec.rootChain)
}

function merge(op: MergeOp, a: 0 | 1, b: 0 | 1): 0 | 1 {
  if (op === 'AND') return a === 1 && b === 1 ? 1 : 0
  return a === 1 || b === 1 ? 1 : 0
}

function applyChain(value: 0 | 1, length: number): 0 | 1 {
  return length % 2 === 1 ? (value === 0 ? 1 : 0) : value
}

const LETTERS = ['A', 'B', 'C', 'D'] as const

/**
 * Expressão infixa reduzida para `LevelSpec.expression`, ex.: "S = A·(B̄+C)".
 * NOT tem precedência máxima, · antes de +; parênteses só onde necessário.
 */
export function expressionText(spec: CircuitSpec): string {
  // Reduz cadeias a paridade para o texto (forma didática).
  const parity = spec.leafChains.map(n => n % 2)
  const rootFlip = spec.rootChain % 2 === 1

  // node é (sub)expressão sem parênteses externos; paren() adiciona se a
  // precedência do nó exigir quando usado como operando.
  let accText = leafText(spec.order[0] as number, parity[0] as number)
  let accPrec = leafPrec(parity[0] as number)
  const opPrec: Record<MergeOp, number> = { AND: 2, OR: 1 }

  for (let i = 1; i < spec.inputs; i++) {
    const op = spec.ops[i - 1] as MergeOp
    const text = leafText(spec.order[i] as number, parity[i] as number)
    const prec = opPrec[op] as number
    const rhs = leafPrec(parity[i] as number) < prec ? `(${text})` : text
    const lhs = accPrec < prec ? `(${accText})` : accText
    accText = `${lhs} ${op === 'AND' ? '·' : '+'} ${rhs}`
    accPrec = prec
  }

  if (rootFlip) accText = `(${accText})‾`
  return `S = ${accText}`
}

function leafText(letterIndex: number, negated: number): string {
  const letter = LETTERS[letterIndex] ?? `x${letterIndex}`
  return negated === 1 ? `${letter}‾` : letter
}

function leafPrec(negated: number): number {
  // NOT (sufixo) liga mais forte que · e +.
  return negated === 1 ? 3 : 4
}

/**
 * Sorteia um alvo com EXATAMENTE `gateBudget` portas fixas. `inputs` <= 3.
 * Retorna o spec + uma atribuição (linha da tabela-verdade) sorteada.
 */
export function sampleTarget(
  rng: Rng,
  inputs: number,
  gateBudget: number,
): { spec: CircuitSpec; row: (0 | 1)[] } {
  const order = rng.shuffle(Array.from({ length: inputs }, (_, i) => i))
  const ops: MergeOp[] = []
  for (let i = 0; i < inputs - 1; i++) {
    ops.push(rng.chance(0.5) ? 'AND' : 'OR')
  }

  const leafChains = distributeNots(rng, inputs, gateBudget - (inputs - 1))
  const rootChain = leafChains.pop() as number
  const spec: CircuitSpec = { inputs, order, ops, leafChains, rootChain }

  const row: (0 | 1)[] = []
  for (let i = 0; i < inputs; i++) row.push(rng.chance(0.5) ? 1 : 0)
  return { spec, row }
}

/**
 * Distribui `budget` NOTs entre `inputCount` folhas + 1 raiz, com limites por
 * folha (para a geometria do tabuleiro caber). Determinístico dado o rng.
 */
function distributeNots(rng: Rng, inputCount: number, budget: number): number[] {
  const slots = inputCount + 1
  const chains: number[] = new Array(slots).fill(0)
  const leafCap = 4
  const rootCap = 8
  let placed = 0
  let attempts = 0
  while (placed < budget && attempts < budget * 8) {
    attempts++
    const slot = rng.int(slots)
    const cap = slot === slots - 1 ? rootCap : leafCap
    if ((chains[slot] as number) >= cap) continue
    chains[slot] = (chains[slot] as number) + 1
    placed++
  }
  // Sobra apenas em casos extremos de orçamento + caps; despeja na raiz.
  if (placed < budget) {
    chains[slots - 1] = (chains[slots - 1] as number) + (budget - placed)
  }
  return chains
}
