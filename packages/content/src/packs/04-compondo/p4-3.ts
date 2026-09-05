import type { LevelSpec } from '@circuit/core/model'
import { LEVEL_SCHEMA_VERSION } from '@circuit/core/model'

/**
 * Pack 4 — "Compondo", fase 3: par didático da p4-2. Mesmo tabuleiro lógico,
 * mas com os parênteses do outro lado: S = A · (B + C). A precedência deixa
 * de ser regra decorada e vira topologia visível — o OU agora alimenta o E.
 */
export const ouDentroDoE: LevelSpec = {
  schemaVersion: LEVEL_SCHEMA_VERSION,
  id: 'p4-3',
  name: 'OU dentro do E',
  grid: { width: 7, height: 2 },
  fixedCells: [
    { coord: { x: 1, y: 1 }, cell: { kind: 'source', value: 1, outputSide: 'E' } },
    { coord: { x: 2, y: 0 }, cell: { kind: 'source', value: 0, outputSide: 'S' } },
    {
      coord: { x: 2, y: 1 },
      cell: {
        kind: 'gate',
        gate: 'OR',
        rotation: 'E',
        inputSides: ['W', 'N'],
        outputSide: 'E',
      },
    },
    { coord: { x: 5, y: 0 }, cell: { kind: 'source', value: 1, outputSide: 'S' } },
    {
      coord: { x: 5, y: 1 },
      cell: {
        kind: 'gate',
        gate: 'AND',
        rotation: 'E',
        inputSides: ['W', 'N'],
        outputSide: 'E',
      },
    },
    { coord: { x: 6, y: 1 }, cell: { kind: 'sink', expected: 1, inputSide: 'W' } },
  ],
  inventory: { wires: 3, gates: { AND: 0, OR: 0, NOT: 0 } },
  hints: [
    'Agora a fonte C (0) vale 1? Não — ela vale 0, mas B vale 1, então o OU interno acende. O E de fora só passa 1 se a fonte A também for 1.',
    'Leve a saída do OU (porta do meio) até a entrada do E à direita; a fonte A já encosta na porta.',
  ],
  starThresholds: { maxPieces: 2, maxGates: 0 },
  expression: 'S = A · (B + C)',
}

export default ouDentroDoE
