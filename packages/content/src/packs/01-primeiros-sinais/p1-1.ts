import type { LevelSpec } from '@circuit/core/model'
import { LEVEL_SCHEMA_VERSION } from '@circuit/core/model'

/** Primeira fase do jogo: fonte -> fio -> destino, em linha reta. */
export const primeiroSinal: LevelSpec = {
  schemaVersion: LEVEL_SCHEMA_VERSION,
  id: 'p1-1',
  name: 'Primeiro sinal',
  grid: { width: 3, height: 1 },
  fixedCells: [
    { coord: { x: 0, y: 0 }, cell: { kind: 'source', value: 1, outputSide: 'E' } },
    { coord: { x: 2, y: 0 }, cell: { kind: 'sink', expected: 1, inputSide: 'W' } },
  ],
  inventory: { wires: null, gates: { AND: 0, OR: 0, NOT: 0 } },
  hints: [
    'Um sinal sai da fonte e chega ao destino sem mudar de valor — ele só precisa de um caminho contínuo até lá.',
    'Puxe um fio reto ligando a fonte ao destino.',
  ],
  starThresholds: { maxPieces: 1, maxGates: 0 },
}

export default primeiroSinal
