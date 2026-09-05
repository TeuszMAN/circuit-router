import type { LevelSpec } from '@circuit/core/model'
import { LEVEL_SCHEMA_VERSION } from '@circuit/core/model'

/** Segunda fase: o mesmo conceito com valor 0 e uma curva no fio. */
export const sinalZero: LevelSpec = {
  schemaVersion: LEVEL_SCHEMA_VERSION,
  id: 'p1-2',
  name: 'Sinal zero',
  grid: { width: 3, height: 2 },
  fixedCells: [
    { coord: { x: 0, y: 0 }, cell: { kind: 'source', value: 0, outputSide: 'S' } },
    { coord: { x: 2, y: 1 }, cell: { kind: 'sink', expected: 0, inputSide: 'W' } },
  ],
  inventory: { wires: null, gates: { AND: 0, OR: 0, NOT: 0 } },
  hints: [
    'O sinal também pode valer 0 — o fio carrega o que a fonte manda, seja 0 ou 1, mesmo fazendo uma curva.',
    'Desça a partir da fonte e depois vire até alcançar o destino.',
  ],
  starThresholds: { maxPieces: 2, maxGates: 0 },
}

export default sinalZero
