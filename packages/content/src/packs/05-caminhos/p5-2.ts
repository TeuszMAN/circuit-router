import type { LevelSpec } from '@circuit/core/model'
import { LEVEL_SCHEMA_VERSION } from '@circuit/core/model'

/**
 * Pack 5 — "Caminhos", fase 2: curto-circuito induzido. Duas fontes com
 * valores diferentes ficam à mesma distância de um único destino — o
 * primeiro instinto de quem vê "duas fontes, um destino" é ligar as duas ao
 * mesmo fio. Isso funde as duas nets numa só, com dois donos brigando
 * (`short`). A solução correta liga **só** a fonte de cima (valor 1, igual
 * ao esperado) e deixa a de baixo sem uso — nada obriga a "gastar" toda
 * fonte do tabuleiro.
 *
 * Geometria fora do alcance do solver v1 (nota do PO, MI-18): a região livre
 * tem os dois pinos de fonte (dois drivers) e o pino do destino — o solver
 * recusa com `topology-unsupported` por construção, então esta fase é
 * validada com solução explícita + `simulate` (ver packs.test.ts).
 */
export const duasFontesUmDestino: LevelSpec = {
  schemaVersion: LEVEL_SCHEMA_VERSION,
  id: 'p5-2',
  name: 'Duas fontes, um destino',
  grid: { width: 5, height: 3 },
  fixedCells: [
    { coord: { x: 0, y: 0 }, cell: { kind: 'source', value: 1, outputSide: 'E' } },
    { coord: { x: 0, y: 2 }, cell: { kind: 'source', value: 0, outputSide: 'E' } },
    { coord: { x: 4, y: 1 }, cell: { kind: 'sink', expected: 1, inputSide: 'W' } },
  ],
  inventory: { wires: 6, gates: { AND: 0, OR: 0, NOT: 0 } },
  hints: [
    'Duas fontes, um só destino — mas o destino só quer um valor. O que acontece se você ligar as duas ao mesmo fio?',
    'Ligue apenas a fonte de cima (valor 1) ao destino; a de baixo não precisa ser usada.',
  ],
  starThresholds: { maxPieces: 4, maxGates: 0 },
  expression: 'S = A',
}

export default duasFontesUmDestino
