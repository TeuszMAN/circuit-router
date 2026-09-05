import type { LevelSpec } from '@circuit/core/model'
import { LEVEL_SCHEMA_VERSION } from '@circuit/core/model'

/**
 * Pack 4 — "Compondo", fase final: três portas em dois níveis.
 * S = (A · B) + ¬C. Nível 1: o E (A,B) e o inversor de C; nível 2: o OU que
 * junta os dois resultados. A saída do inversor alimenta o OU por cima,
 * enquanto o E chega pela esquerda — dois níveis, uma composição.
 */
export const doisNiveis: LevelSpec = {
  schemaVersion: LEVEL_SCHEMA_VERSION,
  id: 'p4-4',
  name: 'Dois níveis',
  grid: { width: 7, height: 3 },
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
      cell: { kind: 'gate', gate: 'NOT', rotation: 'S', inputSides: ['N'], outputSide: 'S' },
    },
    {
      coord: { x: 5, y: 2 },
      cell: {
        kind: 'gate',
        gate: 'OR',
        rotation: 'E',
        inputSides: ['W', 'N'],
        outputSide: 'E',
      },
    },
    { coord: { x: 6, y: 2 }, cell: { kind: 'sink', expected: 1, inputSide: 'W' } },
  ],
  inventory: { wires: 4, gates: { AND: 0, OR: 0, NOT: 0 } },
  hints: [
    'Dois caminhos independentes convergem no destino: o E (A e B) e o inversor de C. O destino acende se qualquer um deles chegar em 1.',
    'Desça a saída do E até a entrada esquerda do OU de baixo; o inversor já encosta no OU por cima.',
  ],
  starThresholds: { maxPieces: 3, maxGates: 0 },
  expression: 'S = (A · B) + ¬C',
}

export default doisNiveis
