import type { Coord } from './geometry'
import type { Signal } from './signal'

/**
 * Categoria de diagnóstico (SDD §4.4). Diagnósticos são sempre dados, nunca
 * exceções — a UI traduz cada `kind` em texto de aprendiz (SDD §9.C.1).
 */
export type IssueKind = 'short' | 'cycle' | 'floating' | 'unpowered-gate'

/** Um diagnóstico e as células do tabuleiro que o evidenciam. */
export interface SimulationIssue {
  readonly kind: IssueKind
  readonly cells: readonly Coord[]
}

/** Resultado da avaliação de um sink específico. */
export interface SinkStatus {
  readonly coord: Coord
  readonly expected: 0 | 1
  readonly actual: Signal
  readonly satisfied: boolean
}

/**
 * Resultado completo de uma simulação (SDD §4.4). `ok` é verdadeiro somente
 * quando todos os sinks estão satisfeitos e não há `issues`.
 */
export interface SimulationResult {
  readonly ok: boolean
  readonly sinks: readonly SinkStatus[]
  readonly issues: readonly SimulationIssue[]
}
