import type { LevelSpec } from '@circuit/core/model'
import { LEVEL_SCHEMA_VERSION } from '@circuit/core/model'

/**
 * Primeira porta de 2 entradas: a AND já está fixa no tabuleiro, com as duas
 * fontes encostadas nos lados declarados (oeste e sul). Mecânica nova:
 * alimentar os dois lados de uma porta antes de rotear a saída.
 */
export const eDeVerdade: LevelSpec = {
  schemaVersion: LEVEL_SCHEMA_VERSION,
  id: 'p3-1',
  name: 'E de verdade',
  grid: { width: 5, height: 3 },
  fixedCells: [
    { coord: { x: 1, y: 1 }, cell: { kind: 'source', value: 1, outputSide: 'E' } },
    { coord: { x: 2, y: 2 }, cell: { kind: 'source', value: 1, outputSide: 'N' } },
    {
      coord: { x: 2, y: 1 },
      cell: { kind: 'gate', gate: 'AND', rotation: 'E', inputSides: ['W', 'S'], outputSide: 'E' },
    },
    { coord: { x: 4, y: 0 }, cell: { kind: 'sink', expected: 1, inputSide: 'W' } },
  ],
  inventory: { wires: 2, gates: { AND: 0, OR: 0, NOT: 0 } },
  hints: [
    'O destino só acende quando AS DUAS fontes valem 1 ao mesmo tempo. Que porta exige isso dos dois lados?',
    'A porta E já está ligada às duas fontes; falta só o fio da saída dela até o destino.',
  ],
  starThresholds: { maxPieces: 2, maxGates: 0 },
  expression: 'S = A · B',
}

export default eDeVerdade
