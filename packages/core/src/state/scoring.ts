import type { BoardState, LevelSpec } from '../model'

/** Pontuação de uma solução já validada pela simulação (SDD §5.2). */
export function scoreSolution(level: LevelSpec, board: BoardState) {
  const pieces = board.placedCells.length
  const gates = board.placedCells.filter(p => p.cell.kind === 'gate').length
  const cleanRoute = pieces <= level.starThresholds.maxPieces
  const minimalLogic = gates <= level.starThresholds.maxGates
  const stars = (1 + Number(cleanRoute) + Number(minimalLogic)) as 1 | 2 | 3
  return { pieces, gates, cleanRoute, minimalLogic, stars }
}
