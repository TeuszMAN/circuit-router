import type { Cell, GateType } from './cell'
import type { Coord } from './geometry'

/** Versão atual do schema de `LevelSpec` — bump exige migração (SDD §3.6). */
export const LEVEL_SCHEMA_VERSION = 1

export interface GridSize {
  readonly width: number
  readonly height: number
}

/** Célula fixa do nível (imutável pelo jogador), ancorada a uma coordenada. */
export interface FixedCell {
  readonly coord: Coord
  readonly cell: Cell
}

/**
 * Quantidade de peças disponível ao jogador para montar a solução.
 * `null` significa "sem limite" (usado em fases de assimilação, SDD §9.B).
 */
export interface LevelInventory {
  readonly wires: number | null
  readonly gates: Readonly<Partial<Record<GateType, number | null>>>
}

/** Dicas em dois níveis (SDD §9.C.2): [empurrão conceitual, solução parcial]. */
export type LevelHints = readonly [level1: string, level2: string]

/**
 * Limites que definem ★2 (peças) e ★3 (portas). Sempre derivados do solver
 * (SDD §9.B) — este tipo só carrega o valor já validado, não o calcula.
 */
export interface StarThresholds {
  readonly maxPieces: number
  readonly maxGates: number
}

/**
 * Especificação completa e imutável de uma fase. Serializável em JSON
 * (SDD §3.4/§3.6) e consumida por `packages/content`, pelo gerador (MI-05) e
 * pelo solver.
 */
export interface LevelSpec {
  readonly schemaVersion: number
  readonly id: string
  readonly name: string
  readonly grid: GridSize
  readonly fixedCells: readonly FixedCell[]
  readonly inventory: LevelInventory
  readonly hints: LevelHints
  readonly starThresholds: StarThresholds
  /** Expressão booleana-alvo opcional para exibição na UI (SDD §9.A P3). */
  readonly expression?: string
}
