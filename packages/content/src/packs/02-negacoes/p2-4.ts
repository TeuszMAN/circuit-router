import type { LevelSpec } from '@circuit/core/model'
import { LEVEL_SCHEMA_VERSION } from '@circuit/core/model'

/**
 * Fase final do pack: dois inversores em série devolvem o valor original —
 * a dupla negação, primeira "lei" booleana descoberta na prática. Solução
 * ótima usa exatamente os 2 NOTs já fixos no tabuleiro (verificado por
 * teste no solver).
 */
export const duplaNegacao: LevelSpec = {
  schemaVersion: LEVEL_SCHEMA_VERSION,
  id: 'p2-4',
  name: 'Dupla negação',
  grid: { width: 6, height: 1 },
  fixedCells: [
    { coord: { x: 0, y: 0 }, cell: { kind: 'source', value: 1, outputSide: 'E' } },
    {
      coord: { x: 2, y: 0 },
      cell: { kind: 'gate', gate: 'NOT', rotation: 'E', inputSides: ['W'], outputSide: 'E' },
    },
    {
      coord: { x: 4, y: 0 },
      cell: { kind: 'gate', gate: 'NOT', rotation: 'E', inputSides: ['W'], outputSide: 'E' },
    },
    { coord: { x: 5, y: 0 }, cell: { kind: 'sink', expected: 1, inputSide: 'W' } },
  ],
  inventory: { wires: null, gates: { AND: 0, OR: 0, NOT: 0 } },
  hints: [
    'Dois inversores em sequência: o que acontece quando você inverte um valor e depois inverte de novo?',
    'Ligue a fonte ao primeiro inversor, e a saída dele ao segundo, até o destino — são dois fios curtos.',
  ],
  starThresholds: { maxPieces: 2, maxGates: 0 },
  expression: 'S = ¬¬A',
}

export default duplaNegacao
