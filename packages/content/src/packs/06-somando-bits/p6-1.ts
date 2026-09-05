import type { LevelSpec } from '@circuit/core/model'
import { LEVEL_SCHEMA_VERSION } from '@circuit/core/model'

/**
 * Pack 6 — "Somando bits", fase 1: o "ahá" do pack — o XOR não é peça, é
 * composição. S = (A + B) · ¬(A · B): a porta OU responde "pelo menos um",
 * a porta E com o inversor responde "não os dois", e a E final exige as
 * duas condições ao mesmo tempo — exatamente a definição de "diferentes".
 * Cada fonte aparece duas vezes no tabuleiro (A alimenta a OU e a primeira
 * E; B idem) porque o mesmo sinal precisa alimentar dois circuitos
 * paralelos — o fan-out já visto no Pack 5, aqui aplicado à síntese.
 */
export const primeiroXor: LevelSpec = {
  schemaVersion: LEVEL_SCHEMA_VERSION,
  id: 'p6-1',
  name: 'O primeiro XOR',
  grid: { width: 6, height: 5 },
  fixedCells: [
    { coord: { x: 1, y: 1 }, cell: { kind: 'source', value: 1, outputSide: 'E' } },
    { coord: { x: 2, y: 0 }, cell: { kind: 'source', value: 0, outputSide: 'S' } },
    {
      coord: { x: 2, y: 1 },
      cell: { kind: 'gate', gate: 'OR', rotation: 'E', inputSides: ['W', 'N'], outputSide: 'E' },
    },
    { coord: { x: 3, y: 0 }, cell: { kind: 'empty' } },
    { coord: { x: 4, y: 1 }, cell: { kind: 'empty' } },
    { coord: { x: 2, y: 2 }, cell: { kind: 'empty' } },
    { coord: { x: 4, y: 2 }, cell: { kind: 'empty' } },
    { coord: { x: 1, y: 4 }, cell: { kind: 'source', value: 1, outputSide: 'E' } },
    { coord: { x: 2, y: 3 }, cell: { kind: 'source', value: 0, outputSide: 'S' } },
    {
      coord: { x: 2, y: 4 },
      cell: { kind: 'gate', gate: 'AND', rotation: 'E', inputSides: ['W', 'N'], outputSide: 'E' },
    },
    {
      coord: { x: 3, y: 4 },
      cell: { kind: 'gate', gate: 'NOT', rotation: 'N', inputSides: ['W'], outputSide: 'N' },
    },
    {
      coord: { x: 3, y: 3 },
      cell: { kind: 'gate', gate: 'AND', rotation: 'E', inputSides: ['S', 'N'], outputSide: 'E' },
    },
    { coord: { x: 4, y: 4 }, cell: { kind: 'empty' } },
    { coord: { x: 5, y: 3 }, cell: { kind: 'sink', expected: 1, inputSide: 'W' } },
  ],
  inventory: { wires: 5, gates: { AND: 0, OR: 0, NOT: 0 } },
  hints: [
    'O destino acende só quando as fontes são diferentes. Uma OU já responde "pelo menos uma"; falta impedir o caso em que as duas valem 1 ao mesmo tempo.',
    'A saída da OU desce até a entrada de cima da E final; a saída da E-com-inversor (de baixo) já encosta na entrada de baixo dela.',
  ],
  starThresholds: { maxPieces: 3, maxGates: 0 },
  expression: 'S = (A + B) · ¬(A · B)',
}

export default primeiroXor
