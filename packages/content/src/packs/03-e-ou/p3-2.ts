import type { LevelSpec } from '@circuit/core/model'
import { LEVEL_SCHEMA_VERSION } from '@circuit/core/model'

/**
 * Introduz a OR: acende com pelo menos uma entrada em 1 — a fonte oeste
 * está em 0 e mesmo assim o destino deve acender, contrastando com a AND.
 */
export const ouDeVerdade: LevelSpec = {
  schemaVersion: LEVEL_SCHEMA_VERSION,
  id: 'p3-2',
  name: 'Ou de verdade',
  grid: { width: 3, height: 4 },
  fixedCells: [
    { coord: { x: 1, y: 0 }, cell: { kind: 'source', value: 0, outputSide: 'S' } },
    { coord: { x: 0, y: 1 }, cell: { kind: 'source', value: 1, outputSide: 'E' } },
    {
      coord: { x: 1, y: 1 },
      cell: { kind: 'gate', gate: 'OR', rotation: 'S', inputSides: ['N', 'W'], outputSide: 'S' },
    },
    { coord: { x: 1, y: 3 }, cell: { kind: 'sink', expected: 1, inputSide: 'N' } },
  ],
  inventory: { wires: 1, gates: { AND: 0, OR: 0, NOT: 0 } },
  hints: [
    'Desta vez o destino acende se PELO MENOS uma das fontes valer 1 — não precisa das duas.',
    'A porta OU já recebe as duas fontes; ligue a saída dela ao destino.',
  ],
  starThresholds: { maxPieces: 1, maxGates: 0 },
  expression: 'S = A + B',
}

export default ouDeVerdade
