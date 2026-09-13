import type { BoardState, LevelInventory, LevelSpec } from '../model'

/** Peças restantes; valores negativos indicam uma edição fora do inventário. */
export function remainingInventory(level: LevelSpec, board: BoardState): LevelInventory {
  const used = { wire: 0, AND: 0, OR: 0, NOT: 0 }
  for (const { cell } of board.placedCells) used[cell.kind === 'wire' ? 'wire' : cell.gate]++
  const remaining = (limit: number | null | undefined, count: number) => limit === null ? null : (limit ?? 0) - count
  return {
    wires: remaining(level.inventory.wires, used.wire),
    gates: {
      AND: remaining(level.inventory.gates.AND, used.AND),
      OR: remaining(level.inventory.gates.OR, used.OR),
      NOT: remaining(level.inventory.gates.NOT, used.NOT),
    },
  }
}
