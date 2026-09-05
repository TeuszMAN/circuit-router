import type { LevelSpec } from '@circuit/core/model'
import { LEVEL_SCHEMA_VERSION } from '@circuit/core/model'

/**
 * Pack 5 — "Caminhos", fase 5 (final do pack): corredor em zigue-zague.
 * Duas paredes com uma única brecha cada, em lados opostos, obrigam o fio a
 * descer até o fundo para passar a primeira e depois subir até o topo para
 * passar a segunda — o roteamento em si é o quebra-cabeça, sem margem para
 * desperdício de fio.
 */
export const corredorEmZigueZague: LevelSpec = {
  schemaVersion: LEVEL_SCHEMA_VERSION,
  id: 'p5-5',
  name: 'Corredor em zigue-zague',
  grid: { width: 8, height: 5 },
  fixedCells: [
    { coord: { x: 0, y: 2 }, cell: { kind: 'source', value: 1, outputSide: 'E' } },
    { coord: { x: 1, y: 1 }, cell: { kind: 'source', value: 0, outputSide: 'S' } },
    {
      coord: { x: 1, y: 2 },
      cell: { kind: 'gate', gate: 'OR', rotation: 'E', inputSides: ['W', 'N'], outputSide: 'E' },
    },
    { coord: { x: 3, y: 0 }, cell: { kind: 'empty' } },
    { coord: { x: 3, y: 1 }, cell: { kind: 'empty' } },
    { coord: { x: 3, y: 2 }, cell: { kind: 'empty' } },
    { coord: { x: 3, y: 3 }, cell: { kind: 'empty' } },
    { coord: { x: 5, y: 1 }, cell: { kind: 'empty' } },
    { coord: { x: 5, y: 2 }, cell: { kind: 'empty' } },
    { coord: { x: 5, y: 3 }, cell: { kind: 'empty' } },
    { coord: { x: 5, y: 4 }, cell: { kind: 'empty' } },
    { coord: { x: 7, y: 2 }, cell: { kind: 'sink', expected: 1, inputSide: 'W' } },
  ],
  inventory: { wires: 15, gates: { AND: 0, OR: 0, NOT: 0 } },
  hints: [
    'Duas paredes com uma única brecha cada, em lados opostos: desça até o fundo para passar a primeira e suba até o topo para passar a segunda.',
    'A brecha da primeira parede fica embaixo (linha de baixo); a da segunda fica em cima (linha de cima) — o caminho serpenteia entre as duas.',
  ],
  starThresholds: { maxPieces: 13, maxGates: 0 },
  expression: 'S = A + B',
}

export default corredorEmZigueZague
