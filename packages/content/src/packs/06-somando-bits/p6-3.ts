import type { LevelSpec } from '@circuit/core/model'
import { LEVEL_SCHEMA_VERSION } from '@circuit/core/model'

/**
 * Pack 6 — "Somando bits", fase 3 (final da campanha): o somador completo.
 * Soma três bits de entrada — A (1), B (0) e o Vem-um / Cin (1) — produzindo
 * Soma = 0 e Vai-um / Cout = 1 (1 + 0 + 1 = 10₂).
 *
 * Arquitetura por reuso de meio-somadores:
 * - O primeiro meio-somador (HA1) calcula Soma1 = A ⊕ B e Vai-um1 = A · B.
 * - O segundo meio-somador (HA2) combina Soma1 com o Vem-um, produzindo a
 *   Soma final (Soma1 ⊕ Cin) e Vai-um2 (Soma1 · Cin).
 * - Uma porta OU final junta Vai-um1 e Vai-um2 para produzir o Vai-um final.
 *
 * Geometria com múltiplos drivers convergindo na mesma região livre (os dois
 * sinais de vai-um alimentando a porta OU final), fora do alcance do solver v1
 * por construção (nota do PO, MI-18). Validada com solução explícita + simulate.
 */
export const somadorCompleto: LevelSpec = {
  schemaVersion: LEVEL_SCHEMA_VERSION,
  id: 'p6-3',
  name: 'Somador completo',
  grid: { width: 9, height: 6 },
  fixedCells: [
    // --- Meio-somador 1 (HA1: entradas A e B) ---
    // OR1 (A + B)
    { coord: { x: 1, y: 1 }, cell: { kind: 'source', value: 1, outputSide: 'E' } },
    { coord: { x: 2, y: 0 }, cell: { kind: 'source', value: 0, outputSide: 'S' } },
    { coord: { x: 2, y: 1 }, cell: { kind: 'gate', gate: 'OR', rotation: 'E', inputSides: ['W', 'N'], outputSide: 'E' } },

    // NOT1 e AND2 (Soma1 = A ⊕ B)
    { coord: { x: 3, y: 2 }, cell: { kind: 'gate', gate: 'NOT', rotation: 'E', inputSides: ['S'], outputSide: 'E' } },
    { coord: { x: 4, y: 2 }, cell: { kind: 'gate', gate: 'AND', rotation: 'E', inputSides: ['W', 'N'], outputSide: 'E' } },

    // AND1 (Vai-um 1 = A · B)
    { coord: { x: 1, y: 3 }, cell: { kind: 'source', value: 1, outputSide: 'E' } },
    { coord: { x: 2, y: 4 }, cell: { kind: 'source', value: 0, outputSide: 'N' } },
    { coord: { x: 2, y: 3 }, cell: { kind: 'gate', gate: 'AND', rotation: 'E', inputSides: ['W', 'S'], outputSide: 'E' } },

    // --- Meio-somador 2 (HA2: entradas Soma1 e Cin) ---
    // Fontes de Cin (Vem-um = 1)
    { coord: { x: 6, y: 0 }, cell: { kind: 'source', value: 1, outputSide: 'S' } },
    { coord: { x: 6, y: 4 }, cell: { kind: 'source', value: 1, outputSide: 'N' } },

    // OR2 (Soma1 + Cin)
    { coord: { x: 6, y: 1 }, cell: { kind: 'gate', gate: 'OR', rotation: 'E', inputSides: ['W', 'N'], outputSide: 'E' } },
    // AND3 (Vai-um 2 = Soma1 · Cin)
    { coord: { x: 6, y: 3 }, cell: { kind: 'gate', gate: 'AND', rotation: 'E', inputSides: ['W', 'S'], outputSide: 'E' } },

    // NOT2 e AND4 (Soma final = Soma1 ⊕ Cin)
    { coord: { x: 7, y: 2 }, cell: { kind: 'gate', gate: 'NOT', rotation: 'N', inputSides: ['S'], outputSide: 'N' } },
    { coord: { x: 7, y: 1 }, cell: { kind: 'gate', gate: 'AND', rotation: 'E', inputSides: ['W', 'S'], outputSide: 'E' } },

    // --- OR3 final (Vai-um final = Vai-um 1 + Vai-um 2) ---
    { coord: { x: 7, y: 5 }, cell: { kind: 'gate', gate: 'OR', rotation: 'E', inputSides: ['W', 'N'], outputSide: 'E' } },

    // Sinks finais
    // Soma: 1 + 0 + 1 = 10₂ -> bit de soma vale 0
    { coord: { x: 8, y: 1 }, cell: { kind: 'sink', expected: 0, inputSide: 'W' } },
    // Vai-um: bit de carry vale 1
    { coord: { x: 8, y: 5 }, cell: { kind: 'sink', expected: 1, inputSide: 'W' } },
  ],
  inventory: { wires: 15, gates: { AND: 0, OR: 0, NOT: 0 } },
  hints: [
    'Um somador completo soma três bits: A, B e o Vem-um (carry in). Ele é formado por dois meio-somadores interligados e uma porta OU.',
    'A saída Soma1 do primeiro meio-somador deve alimentar o segundo meio-somador; os dois vai-um convergem na porta OU na parte inferior.',
  ],
  starThresholds: { maxPieces: 13, maxGates: 0 },
  expression: 'Soma = A ⊕ B ⊕ Cin, Vai-um = (A · B) + (Cin · (A ⊕ B))',
}

export default somadorCompleto
