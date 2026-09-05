import type { LevelSpec } from '@circuit/core/model'
import { LEVEL_SCHEMA_VERSION } from '@circuit/core/model'

/**
 * Reforça a mecânica de rotação: o mesmo inversor, agora virado para receber
 * o sinal por cima e devolvê-lo por baixo — o jogador precisa olhar para os
 * lados declarados da porta, não assumir uma orientação fixa.
 */
export const chaveVirada: LevelSpec = {
  schemaVersion: LEVEL_SCHEMA_VERSION,
  id: 'p2-2',
  name: 'Chave virada',
  grid: { width: 3, height: 3 },
  fixedCells: [
    { coord: { x: 1, y: 0 }, cell: { kind: 'source', value: 1, outputSide: 'S' } },
    {
      coord: { x: 1, y: 1 },
      cell: { kind: 'gate', gate: 'NOT', rotation: 'S', inputSides: ['N'], outputSide: 'S' },
    },
    { coord: { x: 2, y: 2 }, cell: { kind: 'sink', expected: 0, inputSide: 'W' } },
  ],
  inventory: { wires: null, gates: { AND: 0, OR: 0, NOT: 0 } },
  hints: [
    'O inversor pode ficar virado em qualquer direção — o que importa é de que lado ele recebe o sinal e para onde manda o resultado.',
    'Desta vez a saída do inversor aponta para baixo; puxe o fio dali até o destino.',
  ],
  starThresholds: { maxPieces: 1, maxGates: 0 },
  expression: 'S = ¬A',
}

export default chaveVirada
