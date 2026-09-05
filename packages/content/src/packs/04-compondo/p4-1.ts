import type { LevelSpec } from '@circuit/core/model'
import { LEVEL_SCHEMA_VERSION } from '@circuit/core/model'

/**
 * Pack 4 — "Compondo", fase 1: um inversor alimentando uma porta E.
 * S = ¬A · B. A única leitura possível do destino vem da saída do AND, então
 * o jogador é obrigado a compor as duas portas — não dá para "burlar" com um
 * caminho direto.
 */
export const primeiroComposto: LevelSpec = {
  schemaVersion: LEVEL_SCHEMA_VERSION,
  id: 'p4-1',
  name: 'Primeiro composto',
  grid: { width: 6, height: 2 },
  fixedCells: [
    { coord: { x: 0, y: 1 }, cell: { kind: 'source', value: 0, outputSide: 'E' } },
    {
      coord: { x: 1, y: 1 },
      cell: { kind: 'gate', gate: 'NOT', rotation: 'E', inputSides: ['W'], outputSide: 'E' },
    },
    { coord: { x: 4, y: 0 }, cell: { kind: 'source', value: 1, outputSide: 'S' } },
    {
      coord: { x: 4, y: 1 },
      cell: {
        kind: 'gate',
        gate: 'AND',
        rotation: 'E',
        inputSides: ['W', 'N'],
        outputSide: 'E',
      },
    },
    { coord: { x: 5, y: 1 }, cell: { kind: 'sink', expected: 1, inputSide: 'W' } },
  ],
  inventory: { wires: 3, gates: { AND: 0, OR: 0, NOT: 0 } },
  hints: [
    'A fonte de cima vale 1; a de baixo vale 0. O destino só acende com 1 — e a porta E exige as duas entradas em 1.',
    'O inversor está à esquerda: ligue a saída dele à entrada da porta E. A fonte de 1 já encosta na porta.',
  ],
  starThresholds: { maxPieces: 2, maxGates: 0 },
  expression: 'S = ¬A · B',
}

export default primeiroComposto
