import type { GateCell, WireCell } from './cell'
import type { Coord } from './geometry'

/**
 * Peça colocada pelo jogador. Só fio e porta são editáveis — fontes, sinks e
 * obstáculos vêm de `LevelSpec.fixedCells` e nunca aparecem aqui (SDD §3.5).
 */
export interface PlacedCell {
  readonly coord: Coord
  readonly cell: WireCell | GateCell
}

/**
 * Camada editável do tabuleiro, separada das células fixas do nível
 * (SDD §3.5). Comandos de edição (MI-04) produzem novas instâncias desta
 * estrutura; nunca mutam `LevelSpec`.
 */
export interface BoardState {
  readonly levelId: string
  readonly placedCells: readonly PlacedCell[]
}
