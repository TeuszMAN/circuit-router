import type { LevelSpec } from '@circuit/core/model'
import { LEVEL_SCHEMA_VERSION } from '@circuit/core/model'

/**
 * Pack 5 — "Caminhos", fase 1: primeira net com fan-out. Uma única fonte
 * precisa alimentar DOIS destinos — o jogador descobre que um sinal pode
 * abastecer vários leitores de graça, sem custo extra nem "gastar" o sinal.
 */
export const umSinalDoisDestinos: LevelSpec = {
  schemaVersion: LEVEL_SCHEMA_VERSION,
  id: 'p5-1',
  name: 'Um sinal, dois destinos',
  grid: { width: 5, height: 3 },
  fixedCells: [
    { coord: { x: 0, y: 1 }, cell: { kind: 'source', value: 1, outputSide: 'E' } },
    { coord: { x: 4, y: 0 }, cell: { kind: 'sink', expected: 1, inputSide: 'W' } },
    { coord: { x: 4, y: 2 }, cell: { kind: 'sink', expected: 1, inputSide: 'W' } },
  ],
  inventory: { wires: 7, gates: { AND: 0, OR: 0, NOT: 0 } },
  hints: [
    'Os dois destinos esperam o mesmo valor da mesma fonte — o sinal não se divide nem se gasta ao alimentar mais de um lugar.',
    'Puxe o fio da fonte até um ponto comum e, dali, ramifique em duas direções — uma para cada destino.',
  ],
  starThresholds: { maxPieces: 5, maxGates: 0 },
  expression: 'S1 = S2 = A',
}

export default umSinalDoisDestinos
