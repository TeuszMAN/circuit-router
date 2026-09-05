import type { LevelSpec } from '@circuit/core/model'
import { LEVEL_SCHEMA_VERSION } from '@circuit/core/model'

/**
 * Primeira fase com porta: o inversor já está no tabuleiro (imutável),
 * virado com entrada a oeste e saída a leste. Mecânica nova: entender que
 * uma porta tem um lado de entrada e um lado de saída declarados.
 */
export const primeiraNegacao: LevelSpec = {
  schemaVersion: LEVEL_SCHEMA_VERSION,
  id: 'p2-1',
  name: 'Primeira negação',
  grid: { width: 4, height: 1 },
  fixedCells: [
    { coord: { x: 0, y: 0 }, cell: { kind: 'source', value: 0, outputSide: 'E' } },
    {
      coord: { x: 2, y: 0 },
      cell: { kind: 'gate', gate: 'NOT', rotation: 'E', inputSides: ['W'], outputSide: 'E' },
    },
    { coord: { x: 3, y: 0 }, cell: { kind: 'sink', expected: 1, inputSide: 'W' } },
  ],
  inventory: { wires: null, gates: { AND: 0, OR: 0, NOT: 0 } },
  hints: [
    'A fonte manda 0, mas o destino espera 1. Que peça troca um valor pelo seu oposto?',
    'O inversor (NOT) já está no tabuleiro; ligue a fonte a ele com um fio.',
  ],
  starThresholds: { maxPieces: 1, maxGates: 0 },
  expression: 'S = ¬A',
}

export default primeiraNegacao
