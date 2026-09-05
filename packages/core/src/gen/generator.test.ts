// Testes do gerador procedural (MI-05): determinismo por seed, monotonicidade
// da dificuldade estimada com o parâmetro e orçamento de tempo de geração.

import { describe, expect, it } from 'vitest'
import type { Cell } from '../model'
import {
  DIFFICULTY_CONFIGS,
  MAX_DIFFICULTY,
  generateLevel,
  solveLevel,
} from './index'
import type { GeneratedLevel } from './index'

function stableSeed(difficulty: number, sample: number): number {
  return 10_000 + difficulty * 10_000 + sample
}

describe('gerador — determinismo', () => {
  it('mesma seed => mesma fase byte-idêntica', () => {
    for (let difficulty = 1; difficulty <= MAX_DIFFICULTY; difficulty++) {
      for (let sample = 0; sample < 4; sample++) {
        const seed = stableSeed(difficulty, sample)
        const a = generateLevel({ seed, difficulty })
        const b = generateLevel({ seed, difficulty })
        expect(JSON.stringify(a.spec)).toBe(JSON.stringify(b.spec))
        expect(JSON.stringify(a.estimate)).toBe(JSON.stringify(b.estimate))
        expect(JSON.stringify(a.reference)).toBe(JSON.stringify(b.reference))
      }
    }
  })

  it('seeds diferentes geram fases diferentes', () => {
    const a = generateLevel({ seed: 1, difficulty: 3 })
    const b = generateLevel({ seed: 2, difficulty: 3 })
    expect(JSON.stringify(a.spec)).not.toBe(JSON.stringify(b.spec))
  })

  it('valida difficulty fora da faixa', () => {
    expect(() => generateLevel({ seed: 1, difficulty: 0 })).toThrow(RangeError)
    expect(() => generateLevel({ seed: 1, difficulty: 6 })).toThrow(RangeError)
  })

  it('fase gerada tem estrutura coerente com a dificuldade', () => {
    const g = generateLevel({ seed: 5, difficulty: 4 })
    expect(g.spec.schemaVersion).toBe(1)
    expect(g.spec.grid.width).toBeGreaterThan(0)
    expect(g.spec.grid.height).toBeGreaterThan(0)
    expect(g.spec.fixedCells.length).toBeGreaterThan(0)
    expect(g.spec.expression).toMatch(/^S = /)
    // Só portas fixas (jogador não coloca portas em fases geradas) e paredes.
    const gates = g.spec.fixedCells
      .map(f => f.cell)
      .filter((c): c is Extract<Cell, { kind: 'gate' }> => c.kind === 'gate')
    expect(gates.every(k => k.gate === 'AND' || k.gate === 'OR' || k.gate === 'NOT')).toBe(true)
    // Orçamento exato de portas por dificuldade.
    expect(g.estimate.gates).toBe(DIFFICULTY_CONFIGS[g.difficulty]!.gates)
  })
})

describe('gerador — dificuldade estimada cresce com o parâmetro', () => {
  it('média de score, portas e rota são monotônicas não-decrescentes por dificuldade', () => {
    const samplesPerLevel = 6
    const means: number[] = []
    const gateMeans: number[] = []
    const wireMeans: number[] = []
    for (let d = 1; d <= MAX_DIFFICULTY; d++) {
      let scoreSum = 0
      let gateSum = 0
      let wireSum = 0
      for (let s = 0; s < samplesPerLevel; s++) {
        const g = generateLevel({ seed: stableSeed(d, s), difficulty: d })
        scoreSum += g.estimate.score
        gateSum += g.estimate.gates
        wireSum += g.estimate.wireLength
      }
      means.push(scoreSum / samplesPerLevel)
      gateMeans.push(gateSum / samplesPerLevel)
      wireMeans.push(wireSum / samplesPerLevel)
    }
    for (let i = 1; i < means.length; i++) {
      expect(means[i]!, `score d${i + 1} deve ser >= d${i}`).toBeGreaterThanOrEqual(means[i - 1]!)
      expect(gateMeans[i]!, `gates d${i + 1}`).toBeGreaterThanOrEqual(gateMeans[i - 1]!)
    }
    // O parâmetro de dificuldade precisa mover a agulha: última > primeira.
    expect(means[means.length - 1]!).toBeGreaterThan(means[0]!)
    expect(wireMeans[wireMeans.length - 1]!).toBeGreaterThan(wireMeans[0]!)
  })
})

describe('gerador — orçamento de tempo', () => {
  it('geração média < 50ms', () => {
    const n = 120
    const start = Date.now()
    for (let i = 0; i < n; i++) {
      const g = generateLevel({ seed: 40_000 + i, difficulty: 1 + (i % MAX_DIFFICULTY) })
      void g.spec.id
    }
    const elapsedMs = Date.now() - start
    expect(elapsedMs / n).toBeLessThan(50)
  })
})

describe('gerador — integridade da fase produzida', () => {
  it('fase gerada é solucionável com inventário derivado (fios limitados)', () => {
    const levels: GeneratedLevel[] = []
    for (let d = 1; d <= MAX_DIFFICULTY; d++) {
      for (let s = 0; s < 3; s++) levels.push(generateLevel({ seed: stableSeed(d, s), difficulty: d }))
    }
    for (const g of levels) {
      const r = solveLevel(g.spec)
      expect(r.solved, `seed=${g.seed} d=${g.difficulty} reason=${r.reason}`).toBe(true)
      expect(r.wiresUsed).toBeLessThanOrEqual(g.spec.inventory.wires ?? Infinity)
    }
  })
})
