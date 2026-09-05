import type { LevelSpec } from '@circuit/core/model'
import { LEVEL_SCHEMA_VERSION } from '@circuit/core/model'

/**
 * Pack 5 — "Caminhos", fase 4: roteamento apertado com fan-out. A saída da
 * porta E precisa alimentar dois destinos, mas uma parede bloqueia o
 * caminho direto — o jogador precisa contornar (por cima ou por baixo) e
 * ainda ramificar o sinal, sem fio sobrando.
 */
export const doisCaminhosUmaSaida: LevelSpec = {
  schemaVersion: LEVEL_SCHEMA_VERSION,
  id: 'p5-4',
  name: 'Dois caminhos, uma saída',
  grid: { width: 6, height: 3 },
  fixedCells: [
    { coord: { x: 1, y: 0 }, cell: { kind: 'source', value: 1, outputSide: 'S' } },
    { coord: { x: 0, y: 1 }, cell: { kind: 'source', value: 1, outputSide: 'E' } },
    {
      coord: { x: 1, y: 1 },
      cell: { kind: 'gate', gate: 'AND', rotation: 'E', inputSides: ['W', 'N'], outputSide: 'E' },
    },
    { coord: { x: 3, y: 1 }, cell: { kind: 'empty' } },
    { coord: { x: 5, y: 0 }, cell: { kind: 'sink', expected: 1, inputSide: 'W' } },
    { coord: { x: 5, y: 2 }, cell: { kind: 'sink', expected: 1, inputSide: 'W' } },
  ],
  inventory: { wires: 8, gates: { AND: 0, OR: 0, NOT: 0 } },
  hints: [
    'A saída da porta E precisa chegar aos dois destinos, mas a parede não deixa seguir direto — contorne por cima ou por baixo.',
    'Depois de contornar a parede, ramifique o fio: uma ponta sobe até o destino de cima, a outra desce até o de baixo.',
  ],
  starThresholds: { maxPieces: 6, maxGates: 0 },
  expression: 'S1 = S2 = A · B',
}

export default doisCaminhosUmaSaida
