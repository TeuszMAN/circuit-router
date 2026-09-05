import type { LevelSpec } from '@circuit/core/model'
import { LEVEL_SCHEMA_VERSION } from '@circuit/core/model'

/**
 * Fase gêmea 1/2: mesmo tabuleiro de "Ou, não os dois" (p3-4), porta AND.
 * As fontes têm valores diferentes (1 e 0) de propósito — só a AND exige os
 * dois em 1, então aqui o destino fica apagado.
 */
export const gemeaAnd: LevelSpec = {
  schemaVersion: LEVEL_SCHEMA_VERSION,
  id: 'p3-3',
  name: 'Gêmeas: a porta E',
  grid: { width: 4, height: 2 },
  fixedCells: [
    { coord: { x: 3, y: 1 }, cell: { kind: 'source', value: 1, outputSide: 'W' } },
    { coord: { x: 2, y: 0 }, cell: { kind: 'source', value: 0, outputSide: 'S' } },
    {
      coord: { x: 2, y: 1 },
      cell: { kind: 'gate', gate: 'AND', rotation: 'W', inputSides: ['E', 'N'], outputSide: 'W' },
    },
    { coord: { x: 0, y: 1 }, cell: { kind: 'sink', expected: 0, inputSide: 'E' } },
  ],
  inventory: { wires: 1, gates: { AND: 0, OR: 0, NOT: 0 } },
  hints: [
    'As duas fontes têm valores diferentes desta vez — a porta E só acende quando as duas entradas valem 1 ao mesmo tempo.',
    'Ligue a saída da porta E, do lado esquerdo dela, até o destino.',
  ],
  starThresholds: { maxPieces: 1, maxGates: 0 },
  expression: 'S = A · B',
}

export default gemeaAnd
