import type { LevelSpec } from '@circuit/core/model'
import { LEVEL_SCHEMA_VERSION } from '@circuit/core/model'

/**
 * Pack 6 — "Somando bits", fase 2: meio-somador com dois sinks — Soma e Vai-um.
 * A soma binária de 1 + 1 resulta em 10₂: o bit da Soma vale 0 e o bit do
 * Vai-um (carry) vale 1. A porta E que calcula A · B alimenta o inversor do
 * circuito XOR (Soma) e, simultaneamente, alimenta o destino Vai-um por
 * fan-out — ensinando o reaproveitamento de subexpressão.
 */
export const meioSomador: LevelSpec = {
  schemaVersion: LEVEL_SCHEMA_VERSION,
  id: 'p6-2',
  name: 'Meio-somador',
  grid: { width: 6, height: 5 },
  fixedCells: [
    { coord: { x: 3, y: 0 }, cell: { kind: 'empty' } },
    { coord: { x: 4, y: 0 }, cell: { kind: 'empty' } },
    { coord: { x: 2, y: 2 }, cell: { kind: 'empty' } },
    { coord: { x: 5, y: 1 }, cell: { kind: 'empty' } },

    // OR (A + B)
    { coord: { x: 1, y: 1 }, cell: { kind: 'source', value: 1, outputSide: 'E' } },
    { coord: { x: 2, y: 0 }, cell: { kind: 'source', value: 1, outputSide: 'S' } },
    { coord: { x: 2, y: 1 }, cell: { kind: 'gate', gate: 'OR', rotation: 'E', inputSides: ['W', 'N'], outputSide: 'E' } },

    // NOT da negação de (A · B)
    { coord: { x: 3, y: 2 }, cell: { kind: 'gate', gate: 'NOT', rotation: 'E', inputSides: ['S'], outputSide: 'E' } },
    // AND final da Soma (XOR = (A + B) · ¬(A · B))
    { coord: { x: 4, y: 2 }, cell: { kind: 'gate', gate: 'AND', rotation: 'E', inputSides: ['W', 'N'], outputSide: 'E' } },
    // Destino Soma (1 + 1 -> 0)
    { coord: { x: 5, y: 2 }, cell: { kind: 'sink', expected: 0, inputSide: 'W' } },

    // AND do Vai-um (A · B)
    { coord: { x: 1, y: 3 }, cell: { kind: 'source', value: 1, outputSide: 'E' } },
    { coord: { x: 2, y: 4 }, cell: { kind: 'source', value: 1, outputSide: 'N' } },
    { coord: { x: 2, y: 3 }, cell: { kind: 'gate', gate: 'AND', rotation: 'E', inputSides: ['W', 'S'], outputSide: 'E' } },

    // Destino Vai-um (1 + 1 -> 1)
    { coord: { x: 5, y: 3 }, cell: { kind: 'sink', expected: 1, inputSide: 'W' } },
  ],
  inventory: { wires: 6, gates: { AND: 0, OR: 0, NOT: 0 } },
  hints: [
    'Na soma de dois bits 1 + 1, o resultado é 10 em binário: a Soma vale 0 e o Vai-um (carry) vale 1.',
    'A saída da porta E de baixo calcula o Vai-um: ramifique-a para alimentar o inversor acima e o destino Vai-um à direita.',
  ],
  starThresholds: { maxPieces: 4, maxGates: 0 },
  expression: 'Soma = (A + B) · ¬(A · B), Vai-um = A · B',
}

export default meioSomador
