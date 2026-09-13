import { expect, it } from 'vitest'
import type { BoardState } from '../model'
import { exampleLevelSpec } from '../model/fixtures'
import { scoreSolution } from './scoring'

const board: BoardState = { levelId: 'score', placedCells: [
  { coord: { x: 0, y: 0 }, cell: { kind: 'wire', sides: ['W', 'E'] } },
  { coord: { x: 1, y: 0 }, cell: { kind: 'gate', gate: 'NOT', rotation: 'E', inputSides: ['W'], outputSide: 'E' } },
] }

it.each([
  [2, 1, 3, true, true],
  [1, 1, 2, false, true],
  [2, 0, 2, true, false],
  [1, 0, 1, false, false],
] as const)('pontua limites de %i peças e %i portas independentemente', (maxPieces, maxGates, stars, cleanRoute, minimalLogic) => {
  expect(scoreSolution({ ...exampleLevelSpec, starThresholds: { maxPieces, maxGates } }, board))
    .toMatchObject({ stars, cleanRoute, minimalLogic })
})
