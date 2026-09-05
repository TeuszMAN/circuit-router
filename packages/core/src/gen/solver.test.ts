// Testes do solver/validador (MI-05): 500 fases geradas 100% solucionáveis,
// determinismo da solução e casos negativos (limite de inventário e região
// com dois drivers, que exige busca de topologia — fora do escopo do v1).

import { describe, expect, it } from 'vitest'
import { LEVEL_SCHEMA_VERSION } from '../model'
import type { LevelSpec } from '../model'
import { generateLevel, solveLevel } from './index'

const seeds = Array.from({ length: 500 }, (_, i) => i)

describe('solver — 500 fases geradas, 100% solucionáveis', () => {
  it.each(seeds)('fase com seed %i é provada solucionável dentro do inventário', seed => {
    const difficulty = 1 + (seed % 5)
    const g = generateLevel({ seed: seed * 2654435761, difficulty })

    const r = solveLevel(g.spec)
    expect(r.solved, `d=${difficulty} reason=${r.reason ?? '?'}`).toBe(true)
    expect(r.board).toBeDefined()
    expect(r.wiresUsed).toBeGreaterThan(0)
    // Dentro do inventário declarado na fase.
    const limit = g.spec.inventory.wires
    expect(limit).not.toBeNull()
    expect(r.wiresUsed).toBeLessThanOrEqual(limit as number)
    // A dificuldade estimada reflete o orçamento exato de portas da fase.
    expect(g.estimate.gates).toBe(g.spec.fixedCells.filter(f => f.cell.kind === 'gate').length)
  })
})

describe('solver — determinismo', () => {
  it('mesma fase => mesma solução byte-idêntica', () => {
    const g = generateLevel({ seed: 99, difficulty: 4 })
    const a = solveLevel(g.spec)
    const b = solveLevel(g.spec)
    expect(JSON.stringify(a.board)).toBe(JSON.stringify(b.board))
  })
})

describe('solver — casos negativos', () => {
  it('região com dois drivers não é resolvida (topologia ambígua)', () => {
    const level: LevelSpec = {
      schemaVersion: LEVEL_SCHEMA_VERSION,
      id: 'two-drivers',
      name: 'Dois drivers',
      grid: { width: 3, height: 3 },
      fixedCells: [
        { coord: { x: 0, y: 0 }, cell: { kind: 'source', value: 1, outputSide: 'E' } },
        { coord: { x: 2, y: 0 }, cell: { kind: 'source', value: 0, outputSide: 'W' } },
        { coord: { x: 1, y: 2 }, cell: { kind: 'sink', expected: 1, inputSide: 'N' } },
        { coord: { x: 0, y: 1 }, cell: { kind: 'empty' } },
        { coord: { x: 0, y: 2 }, cell: { kind: 'empty' } },
        { coord: { x: 2, y: 1 }, cell: { kind: 'empty' } },
        { coord: { x: 2, y: 2 }, cell: { kind: 'empty' } },
      ],
      inventory: { wires: 10, gates: { AND: 0, OR: 0, NOT: 0 } },
      hints: ['a', 'b'],
      starThresholds: { maxPieces: 10, maxGates: 0 },
    }
    const r = solveLevel(level)
    expect(r.solved).toBe(false)
    expect(r.reason).toBe('topology-unsupported')
  })

  it('fase sem fios suficientes no inventário é insolúvel', () => {
    const g = generateLevel({ seed: 7, difficulty: 3 })
    const tight: LevelSpec = {
      ...g.spec,
      inventory: { wires: 0, gates: { AND: 0, OR: 0, NOT: 0 } },
    }
    const r = solveLevel(tight)
    expect(r.solved).toBe(false)
    expect(r.reason).toBe('wire-limit')
  })

  it('sink com valor inatingível não vence a fase (not-satisfied)', () => {
    const level: LevelSpec = {
      schemaVersion: LEVEL_SCHEMA_VERSION,
      id: 'no-sink',
      name: 'Sem destino',
      grid: { width: 2, height: 1 },
      fixedCells: [
        { coord: { x: 0, y: 0 }, cell: { kind: 'source', value: 1, outputSide: 'E' } },
        { coord: { x: 1, y: 0 }, cell: { kind: 'sink', expected: 0, inputSide: 'W' } },
      ],
      inventory: { wires: 5, gates: { AND: 0, OR: 0, NOT: 0 } },
      hints: ['a', 'b'],
      starThresholds: { maxPieces: 5, maxGates: 0 },
    }
    // Espera 0, fonte dá 1: mesmo com fio reto, sink insatisfeito.
    const r = solveLevel(level)
    expect(r.solved).toBe(false)
    expect(r.reason).toBe('not-satisfied')
  })
})
