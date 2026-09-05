import type { LevelSpec } from '@circuit/core/model'
import { LEVEL_SCHEMA_VERSION } from '@circuit/core/model'

/**
 * Terceira fase: primeiro obstáculo de rota. Uma parede bloqueia o caminho
 * direto entre fonte e destino, separando "resolver a lógica" (aqui trivial)
 * de "resolver o caminho".
 */
export const desvio: LevelSpec = {
  schemaVersion: LEVEL_SCHEMA_VERSION,
  id: 'p1-3',
  name: 'Desvio',
  grid: { width: 5, height: 3 },
  fixedCells: [
    { coord: { x: 0, y: 1 }, cell: { kind: 'source', value: 1, outputSide: 'E' } },
    { coord: { x: 2, y: 1 }, cell: { kind: 'empty' } },
    { coord: { x: 4, y: 1 }, cell: { kind: 'sink', expected: 1, inputSide: 'W' } },
  ],
  inventory: { wires: null, gates: { AND: 0, OR: 0, NOT: 0 } },
  hints: [
    'Uma parede bloqueia o caminho direto — o sinal ainda chega ao destino, só precisa contornar o obstáculo.',
    'Suba (ou desça) uma linha para passar pela parede e depois volte à linha do destino.',
  ],
  starThresholds: { maxPieces: 5, maxGates: 0 },
}

export default desvio
