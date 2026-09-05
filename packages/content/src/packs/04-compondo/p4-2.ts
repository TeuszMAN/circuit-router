import type { LevelSpec } from '@circuit/core/model'
import { LEVEL_SCHEMA_VERSION } from '@circuit/core/model'

/**
 * Pack 4 — "Compondo", fase 2: E antes de OU — a precedência vira topologia.
 * S = (A · B) + C. O jogador compõe o AND e depois leva o resultado ao OU,
 * que também recebe a fonte C direto.
 */
export const eAntesDeOu: LevelSpec = {
  schemaVersion: LEVEL_SCHEMA_VERSION,
  id: 'p4-2',
  name: 'E antes de OU',
  grid: { width: 7, height: 2 },
  fixedCells: [
    { coord: { x: 1, y: 1 }, cell: { kind: 'source', value: 1, outputSide: 'E' } },
    { coord: { x: 2, y: 0 }, cell: { kind: 'source', value: 1, outputSide: 'S' } },
    {
      coord: { x: 2, y: 1 },
      cell: {
        kind: 'gate',
        gate: 'AND',
        rotation: 'E',
        inputSides: ['W', 'N'],
        outputSide: 'E',
      },
    },
    { coord: { x: 5, y: 0 }, cell: { kind: 'source', value: 0, outputSide: 'S' } },
    {
      coord: { x: 5, y: 1 },
      cell: {
        kind: 'gate',
        gate: 'OR',
        rotation: 'E',
        inputSides: ['W', 'N'],
        outputSide: 'E',
      },
    },
    { coord: { x: 6, y: 1 }, cell: { kind: 'sink', expected: 1, inputSide: 'W' } },
  ],
  inventory: { wires: 3, gates: { AND: 0, OR: 0, NOT: 0 } },
  hints: [
    'Com A e B em 1, a primeira porta já devolve 1 — falta levá-lo até o destino, que também ouve a fonte C (0).',
    'Ligue a saída do E à entrada esquerda do OU; a fonte de cima do OU já está encostada nele.',
  ],
  starThresholds: { maxPieces: 2, maxGates: 0 },
  expression: 'S = (A · B) + C',
}

export default eAntesDeOu
