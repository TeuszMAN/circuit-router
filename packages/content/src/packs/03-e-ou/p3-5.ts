import type { LevelSpec } from '@circuit/core/model'
import { LEVEL_SCHEMA_VERSION } from '@circuit/core/model'

/**
 * Fase final do pack: OR seguida de NOT. Das 4 combinações possíveis das
 * duas fontes, só UMA (0 e 0) faz o destino acender — obriga o jogador a
 * raciocinar linha a linha em vez de assumir o padrão "acende com qualquer
 * uma em 1" da OR pura.
 */
export const soUmaLinha: LevelSpec = {
  schemaVersion: LEVEL_SCHEMA_VERSION,
  id: 'p3-5',
  name: 'Só uma linha',
  grid: { width: 6, height: 3 },
  fixedCells: [
    { coord: { x: 1, y: 1 }, cell: { kind: 'source', value: 0, outputSide: 'E' } },
    { coord: { x: 2, y: 2 }, cell: { kind: 'source', value: 0, outputSide: 'N' } },
    {
      coord: { x: 2, y: 1 },
      cell: { kind: 'gate', gate: 'OR', rotation: 'E', inputSides: ['W', 'S'], outputSide: 'E' },
    },
    {
      coord: { x: 4, y: 1 },
      cell: { kind: 'gate', gate: 'NOT', rotation: 'E', inputSides: ['W'], outputSide: 'E' },
    },
    { coord: { x: 5, y: 1 }, cell: { kind: 'sink', expected: 1, inputSide: 'W' } },
  ],
  inventory: { wires: 1, gates: { AND: 0, OR: 0, NOT: 0 } },
  hints: [
    'Das quatro combinações possíveis dessas duas fontes, só uma faz o destino acender — pense no que sobra depois de inverter a saída da OU.',
    'Ligue a saída da porta OU à entrada do inversor; a saída dele já toca o destino.',
  ],
  starThresholds: { maxPieces: 1, maxGates: 0 },
  expression: 'S = ¬(A + B)',
}

export default soUmaLinha
