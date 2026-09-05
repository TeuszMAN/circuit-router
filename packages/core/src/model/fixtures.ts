import type { BoardState } from './board-state'
import type { LevelSpec } from './level'
import { LEVEL_SCHEMA_VERSION } from './level'
import type { SimulationResult } from './simulation'

/**
 * Fase de exemplo — Pack 2 "Negações": uma fonte em 0, um NOT, um sink que
 * espera 1. Prova que `LevelSpec` é habitável pelo schema real (não só
 * compila, mas descreve uma fase jogável). Fios ficam a cargo do jogador,
 * daí `wires: null` (sem limite) e `gates.NOT: 0` (o NOT já é fixo).
 */
export const exampleLevelSpec: LevelSpec = {
  schemaVersion: LEVEL_SCHEMA_VERSION,
  id: 'pack-02-negacoes-01',
  name: 'Primeira negação',
  grid: { width: 3, height: 1 },
  fixedCells: [
    {
      coord: { x: 0, y: 0 },
      cell: { kind: 'source', value: 0, outputSide: 'E' },
    },
    {
      coord: { x: 1, y: 0 },
      cell: {
        kind: 'gate',
        gate: 'NOT',
        rotation: 'E',
        inputSides: ['W'],
        outputSide: 'E',
      },
    },
    {
      coord: { x: 2, y: 0 },
      cell: { kind: 'sink', expected: 1, inputSide: 'W' },
    },
  ],
  inventory: { wires: null, gates: { NOT: 0, AND: 0, OR: 0 } },
  hints: [
    'A fonte manda 0. Que peça devolve o oposto do que recebe?',
    'O NOT já está no tabuleiro — falta só o fio ligando os três.',
  ],
  starThresholds: { maxPieces: 2, maxGates: 0 },
}

/** Estado editável de exemplo: nenhuma peça colocada ainda. */
export const exampleBoardState: BoardState = {
  levelId: exampleLevelSpec.id,
  placedCells: [],
}

/** Resultado de exemplo: sink ainda flutuante, fase não vencida. */
export const exampleSimulationResult: SimulationResult = {
  ok: false,
  sinks: [
    {
      coord: { x: 2, y: 0 },
      expected: 1,
      actual: undefined,
      satisfied: false,
    },
  ],
  issues: [
    {
      kind: 'floating',
      cells: [{ x: 2, y: 0 }],
    },
  ],
}
