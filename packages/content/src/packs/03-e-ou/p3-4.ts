import type { LevelSpec } from '@circuit/core/model'
import { LEVEL_SCHEMA_VERSION } from '@circuit/core/model'

/**
 * Fase gêmea 2/2: mesmo tabuleiro de "Gêmeas: a porta E" (p3-3), porta OR.
 * Mesmas duas fontes (1 e 0) — a OR só precisa de uma em 1, então aqui o
 * destino acende, ao contrário da gêmea com AND.
 */
export const gemeaOr: LevelSpec = {
  schemaVersion: LEVEL_SCHEMA_VERSION,
  id: 'p3-4',
  name: 'Gêmeas: a porta OU',
  grid: { width: 4, height: 2 },
  fixedCells: [
    { coord: { x: 3, y: 1 }, cell: { kind: 'source', value: 1, outputSide: 'W' } },
    { coord: { x: 2, y: 0 }, cell: { kind: 'source', value: 0, outputSide: 'S' } },
    {
      coord: { x: 2, y: 1 },
      cell: { kind: 'gate', gate: 'OR', rotation: 'W', inputSides: ['E', 'N'], outputSide: 'W' },
    },
    { coord: { x: 0, y: 1 }, cell: { kind: 'sink', expected: 1, inputSide: 'E' } },
  ],
  inventory: { wires: 1, gates: { AND: 0, OR: 0, NOT: 0 } },
  hints: [
    'Mesmo tabuleiro da fase anterior, porta diferente: a OU acende com pelo menos uma entrada em 1.',
    'Ligue a saída da porta OU, do lado esquerdo dela, até o destino.',
  ],
  starThresholds: { maxPieces: 1, maxGates: 0 },
  expression: 'S = A + B',
}

export default gemeaOr
