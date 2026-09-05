import type { LevelSpec } from '@circuit/core/model'
import { LEVEL_SCHEMA_VERSION } from '@circuit/core/model'

/**
 * Terceira fase de assimilação: a fonte fica à direita e a porta manda o
 * sinal para a esquerda — o sinal nem sempre flui da esquerda para a
 * direita. Também exige um fio com uma curva antes da porta.
 */
export const contraCorrente: LevelSpec = {
  schemaVersion: LEVEL_SCHEMA_VERSION,
  id: 'p2-3',
  name: 'Contracorrente',
  grid: { width: 4, height: 2 },
  fixedCells: [
    { coord: { x: 3, y: 1 }, cell: { kind: 'source', value: 0, outputSide: 'N' } },
    {
      coord: { x: 1, y: 0 },
      cell: { kind: 'gate', gate: 'NOT', rotation: 'W', inputSides: ['E'], outputSide: 'W' },
    },
    { coord: { x: 0, y: 0 }, cell: { kind: 'sink', expected: 1, inputSide: 'E' } },
  ],
  inventory: { wires: null, gates: { AND: 0, OR: 0, NOT: 0 } },
  hints: [
    'Nem toda fase corre da esquerda para a direita — siga o lado de saída da fonte para descobrir por onde o sinal sai.',
    'Suba a partir da fonte e depois vá até a entrada do inversor, do lado direito dele.',
  ],
  starThresholds: { maxPieces: 2, maxGates: 0 },
  expression: 'S = ¬A',
}

export default contraCorrente
