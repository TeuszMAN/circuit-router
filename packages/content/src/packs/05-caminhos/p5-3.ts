import type { LevelSpec } from '@circuit/core/model'
import { LEVEL_SCHEMA_VERSION } from '@circuit/core/model'

/**
 * Pack 5 — "Caminhos", fase 3: ciclo combinacional. Um único NOT, com a
 * fonte à esquerda e o destino à direita — mas o tabuleiro aberto (sem
 * paredes) deixa espaço de sobra por cima/por baixo da porta, o que também
 * permite ligar a saída do NOT de volta à própria entrada, dando a volta por
 * fora. Esse "atalho" nunca funciona: a porta passaria a depender do próprio
 * resultado para calcular o próprio resultado, e o valor nunca se resolve
 * (`cycle`). A solução correta é o caminho direto e curto: fonte → entrada,
 * saída → destino, sem dar a volta.
 *
 * Geometria fora do alcance do solver v1 (nota do PO, MI-18): a entrada e a
 * saída do NOT ficam na mesma região livre (o espaço aberto acima/abaixo da
 * porta as conecta), então a região tem dois drivers (fonte e a própria
 * saída da porta) — o solver recusa com `topology-unsupported` por
 * construção. Validada com solução explícita + `simulate` (packs.test.ts).
 */
export const lacoQueNaoFecha: LevelSpec = {
  schemaVersion: LEVEL_SCHEMA_VERSION,
  id: 'p5-3',
  name: 'O laço que não fecha',
  grid: { width: 5, height: 3 },
  fixedCells: [
    { coord: { x: 0, y: 1 }, cell: { kind: 'source', value: 0, outputSide: 'E' } },
    {
      coord: { x: 2, y: 1 },
      cell: { kind: 'gate', gate: 'NOT', rotation: 'E', inputSides: ['W'], outputSide: 'E' },
    },
    { coord: { x: 4, y: 1 }, cell: { kind: 'sink', expected: 1, inputSide: 'W' } },
  ],
  inventory: { wires: 6, gates: { AND: 0, OR: 0, NOT: 0 } },
  hints: [
    'O inversor tem espaço de sobra ao redor — dá até para ligar a saída dele de volta na própria entrada. Mas, se ele depende do próprio resultado para calcular o resultado, ele nunca descobre o valor.',
    'O caminho é só o direto: fonte até a entrada do NOT, saída do NOT até o destino — sem voltar.',
  ],
  starThresholds: { maxPieces: 2, maxGates: 0 },
  expression: 'S = ¬A',
}

export default lacoQueNaoFecha
