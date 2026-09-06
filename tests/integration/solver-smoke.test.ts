// Teste de fumaça (MI-16): roda o solver sobre TODAS as 24 fases de
// @circuit/content. Espelha o critério de packs.test.ts (packages/content):
// - fases não-hand-validated: solveLevel deve resolver dentro do inventário;
// - hand-validated (p5-2, p5-3, p6-3): solução explícita + simulate (solver v1
//   recusa por 'topology-unsupported' — limitação documentada do §9.4).
// Environment: node.

import { describe, expect, test } from 'vitest'
import type { BoardState, LevelSpec, PlacedCell } from '@circuit/core/model'
import { solveLevel } from '@circuit/core/gen'
import { simulate } from '@circuit/core/sim'
import { PACKS } from '@circuit/content/packs'

// ---------------------------------------------------------------------------
// Fases hand-validated (mesmas de packs.test.ts — solver v1 recusa por
// construção com 'topology-unsupported')
// ---------------------------------------------------------------------------

const HAND_VALIDATED_IDS = new Set(['p5-2', 'p5-3', 'p6-3'])

/**
 * Soluções explícitas para as fases hand-validated, idênticas às de
 * packs.test.ts (HAND_VALIDATED_SOLUTIONS).
 */
const HAND_VALIDATED_SOLUTIONS: Readonly<Record<string, readonly PlacedCell[]>> = {
  // p5-2: liga apenas a fonte de cima (0,0) [valor 1] ao destino (4,1). 4 fios.
  'p5-2': [
    { coord: { x: 1, y: 0 }, cell: { kind: 'wire', sides: ['W', 'S'] } },
    { coord: { x: 1, y: 1 }, cell: { kind: 'wire', sides: ['N', 'E'] } },
    { coord: { x: 2, y: 1 }, cell: { kind: 'wire', sides: ['W', 'E'] } },
    { coord: { x: 3, y: 1 }, cell: { kind: 'wire', sides: ['W', 'E'] } },
  ],
  // p5-3: caminho direto fonte (0,1) → NOT (2,1) → destino (4,1). 2 fios.
  'p5-3': [
    { coord: { x: 1, y: 1 }, cell: { kind: 'wire', sides: ['W', 'E'] } },
    { coord: { x: 3, y: 1 }, cell: { kind: 'wire', sides: ['W', 'E'] } },
  ],
  // p6-3: solução ótima com 13 fios interligando HA1, HA2 e OR3.
  'p6-3': [
    { coord: { x: 3, y: 1 }, cell: { kind: 'wire', sides: ['W', 'E'] } },
    { coord: { x: 4, y: 1 }, cell: { kind: 'wire', sides: ['W', 'S'] } },
    { coord: { x: 3, y: 3 }, cell: { kind: 'wire', sides: ['W', 'N', 'S'] } },

    { coord: { x: 5, y: 2 }, cell: { kind: 'wire', sides: ['W', 'N', 'S'] } },
    { coord: { x: 5, y: 1 }, cell: { kind: 'wire', sides: ['S', 'E'] } },
    { coord: { x: 5, y: 3 }, cell: { kind: 'wire', sides: ['N', 'E'] } },

    { coord: { x: 7, y: 3 }, cell: { kind: 'wire', sides: ['W', 'N', 'S'] } },
    { coord: { x: 7, y: 4 }, cell: { kind: 'wire', sides: ['N', 'S'] } },

    { coord: { x: 3, y: 4 }, cell: { kind: 'wire', sides: ['N', 'S'] } },
    { coord: { x: 3, y: 5 }, cell: { kind: 'wire', sides: ['N', 'E'] } },
    { coord: { x: 4, y: 5 }, cell: { kind: 'wire', sides: ['W', 'E'] } },
    { coord: { x: 5, y: 5 }, cell: { kind: 'wire', sides: ['W', 'E'] } },
    { coord: { x: 6, y: 5 }, cell: { kind: 'wire', sides: ['W', 'E'] } },
  ],
}

// ---------------------------------------------------------------------------
// Smoke suite
// ---------------------------------------------------------------------------

const ALL_LEVELS: readonly LevelSpec[] = PACKS.flatMap(pack => pack.levels)

describe('fumaça do solver sobre todas as 24 fases da campanha', () => {
  test('campanha tem exatamente 24 fases em 6 packs', () => {
    expect(ALL_LEVELS).toHaveLength(24)
    expect(PACKS).toHaveLength(6)
  })

  for (const level of ALL_LEVELS) {
    if (HAND_VALIDATED_IDS.has(level.id)) {
      test(`${level.id} (${level.name}): hand-validated — simulate com solução explícita ok`, () => {
        const placedCells = HAND_VALIDATED_SOLUTIONS[level.id]
        expect(placedCells).toBeDefined()

        const board: BoardState = {
          levelId: level.id,
          placedCells: placedCells as PlacedCell[],
        }

        // Filtra células 'empty' (paredes) para a simulação elétrica
        const electricSpec: LevelSpec = {
          ...level,
          fixedCells: level.fixedCells.filter(f => f.cell.kind !== 'empty'),
        }

        const result = simulate(electricSpec, board)
        expect(result.ok).toBe(true)
        expect(result.sinks.every(s => s.satisfied)).toBe(true)
        expect(result.issues).toHaveLength(0)

        // Solver deve recusar com topology-unsupported (limitação documentada v1)
        const solverResult = solveLevel(level)
        expect(solverResult.solved).toBe(false)
        expect(solverResult.reason).toBe('topology-unsupported')
      })
    } else {
      test(`${level.id} (${level.name}): solveLevel encontra solução dentro do inventário`, () => {
        const result = solveLevel(level)
        expect(result.solved, `motivo da falha: ${result.reason ?? '?'}`).toBe(true)
        expect(result.board).toBeDefined()
        expect(result.wiresUsed).toBeDefined()

        // Confirma a solução simulando (solver já valida internamente, mas
        // isso garante integração de ponta a ponta).
        // Filtra células 'empty' (paredes) — a simulação elétrica não as processa.
        const electricSpec: LevelSpec = {
          ...level,
          fixedCells: level.fixedCells.filter(f => f.cell.kind !== 'empty'),
        }
        const simResult = simulate(electricSpec, result.board!)
        expect(simResult.ok).toBe(true)
        expect(simResult.sinks.every(s => s.satisfied)).toBe(true)
      })
    }
  }
})
