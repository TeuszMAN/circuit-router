import type { Direction } from './geometry'

/** Discriminante de célula do tabuleiro. */
export type CellKind = 'empty' | 'source' | 'sink' | 'wire' | 'gate'

/**
 * Portas do v1 (SDD §9.D): XOR não é peça própria, é composição de
 * AND/OR/NOT (Pack 6) — por isso fica fora deste union.
 */
export type GateType = 'AND' | 'OR' | 'NOT'

/** Aridade declarada de cada tipo de porta — usada para validar `inputSides`. */
export const GATE_ARITY: Readonly<Record<GateType, number>> = {
  NOT: 1,
  AND: 2,
  OR: 2,
}

export interface EmptyCell {
  readonly kind: 'empty'
}

/** Célula que produz um sinal fixo, ligado a um único lado de saída. */
export interface SourceCell {
  readonly kind: 'source'
  readonly value: 0 | 1
  readonly outputSide: Direction
}

/** Célula que espera um valor específico para considerar a fase vencida. */
export interface SinkCell {
  readonly kind: 'sink'
  readonly expected: 0 | 1
  readonly inputSide: Direction
}

/**
 * Fio: conecta dois ou mais lados da própria célula. `sides` tem no mínimo 2
 * entradas para representar reto/curva/T/cruzamento; uma única entrada não
 * forma caminho e não é um fio válido.
 */
export interface WireCell {
  readonly kind: 'wire'
  readonly sides: readonly Direction[]
}

/**
 * Porta lógica. `inputSides` é **declarado explicitamente** — nunca inferido
 * como "todos os lados menos a saída" (regra do SDD §3.3). `rotation` é a
 * orientação da peça; `outputSide` e `inputSides` já refletem essa rotação,
 * não precisam ser recalculados por quem consome o tipo.
 */
export interface GateCell {
  readonly kind: 'gate'
  readonly gate: GateType
  readonly rotation: Direction
  readonly inputSides: readonly Direction[]
  readonly outputSide: Direction
}

export type Cell = EmptyCell | SourceCell | SinkCell | WireCell | GateCell
