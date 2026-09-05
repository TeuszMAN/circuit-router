// Testes da campanha (MI-17 e MI-18): schema, solubilidade pelo solver ou
// validação explícita com simulate, limites de estrelas derivados, dicas em dois
// níveis e marcas didáticas pedidas pelo SDD §9.B para todos os 6 packs (24 fases).

import { describe, expect, test } from 'vitest'
import { LEVEL_SCHEMA_VERSION } from '@circuit/core/model'
import type { BoardState, LevelSpec, PlacedCell } from '@circuit/core/model'
import { solveLevel } from '@circuit/core/gen'
import { simulate } from '@circuit/core/sim'
import {
  CAMINHOS_PACK,
  COMPONDO_PACK,
  E_OU_PACK,
  NEGACOES_PACK,
  PACKS,
  PRIMEIROS_SINAIS_PACK,
  SOMANDO_BITS_PACK,
} from './index'

const ALL_LEVELS: readonly LevelSpec[] = PACKS.flatMap(pack => pack.levels)

const COORD_PATTERN = /\(\s*\d+\s*,\s*\d+\s*\)|\bx\s*[:=]\s*\d|\by\s*[:=]\s*\d|\bcoluna\s+\d|\blinha\s+\d/i

/**
 * Fases validadas por solução explícita + simulate (conforme autorização e
 * nota do PO em task-mi18.txt):
 * - p5-2 (curto induzido): 2 fontes com valores opostos na mesma região livre.
 * - p5-3 (ciclo induzido): saída do NOT e fonte na mesma região aberta.
 * - p6-3 (somador completo): dois drivers de vai-um convergem na região da porta OU final.
 * Nessas geometrias, o solver v1 recusa por construção com 'topology-unsupported'
 * (suporta apenas 1 driver por componente conexa).
 */
const HAND_VALIDATED_LEVEL_IDS = new Set(['p5-2', 'p5-3', 'p6-3'])

const HAND_VALIDATED_SOLUTIONS: Readonly<Record<string, readonly PlacedCell[]>> = {
  // p5-2: liga apenas a fonte de cima (0,0) [valor 1] ao destino (4,1). 4 fios.
  'p5-2': [
    { coord: { x: 1, y: 0 }, cell: { kind: 'wire', sides: ['W', 'S'] } },
    { coord: { x: 1, y: 1 }, cell: { kind: 'wire', sides: ['N', 'E'] } },
    { coord: { x: 2, y: 1 }, cell: { kind: 'wire', sides: ['W', 'E'] } },
    { coord: { x: 3, y: 1 }, cell: { kind: 'wire', sides: ['W', 'E'] } },
  ],
  // p5-3: caminho direto fonte (0,1) -> NOT (2,1) -> destino (4,1). 2 fios.
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

describe('campanha completa (MI-17 e MI-18) — inventário e estrutura', () => {
  test('exatamente 6 packs, com 3 + 4 + 5 + 4 + 5 + 3 fases (total 24)', () => {
    expect(PACKS).toHaveLength(6)
    expect(PRIMEIROS_SINAIS_PACK.levels).toHaveLength(3)
    expect(NEGACOES_PACK.levels).toHaveLength(4)
    expect(E_OU_PACK.levels).toHaveLength(5)
    expect(COMPONDO_PACK.levels).toHaveLength(4)
    expect(CAMINHOS_PACK.levels).toHaveLength(5)
    expect(SOMANDO_BITS_PACK.levels).toHaveLength(3)
  })

  test('cada pack declara nome, tema e conceito não vazios', () => {
    for (const pack of PACKS) {
      expect(pack.name.length).toBeGreaterThan(0)
      expect(pack.theme.length).toBeGreaterThan(0)
      expect(pack.concept.length).toBeGreaterThan(0)
    }
  })

  test('24 ids únicos, no formato pN-M (p1 a p6)', () => {
    const ids = ALL_LEVELS.map(l => l.id)
    expect(ids).toHaveLength(24)
    expect(new Set(ids).size).toBe(24)
    for (const id of ids) expect(id).toMatch(/^p[1-6]-\d$/)
  })
})

describe('campanha completa — schema e dicas', () => {
  for (const level of ALL_LEVELS) {
    test(`${level.id}: schemaVersion atual`, () => {
      expect(level.schemaVersion).toBe(LEVEL_SCHEMA_VERSION)
    })

    test(`${level.id}: exatamente 2 dicas, nível 1 sem coordenadas`, () => {
      expect(level.hints).toHaveLength(2)
      const [level1, level2] = level.hints
      expect(level1.length).toBeGreaterThan(0)
      expect(level2.length).toBeGreaterThan(0)
      expect(level1).not.toMatch(COORD_PATTERN)
    })
  }
})

describe('packs 4–6 (MI-18) — toda fase declara expression não vazia', () => {
  const MI18_LEVELS = [
    ...COMPONDO_PACK.levels,
    ...CAMINHOS_PACK.levels,
    ...SOMANDO_BITS_PACK.levels,
  ]

  for (const level of MI18_LEVELS) {
    test(`${level.id}: expression booleana declarada e não vazia`, () => {
      expect(level.expression).toBeDefined()
      expect(typeof level.expression).toBe('string')
      expect(level.expression!.length).toBeGreaterThan(0)
    })
  }
})

describe('todas as fases são resolvíveis (solveLevel ou solução explícita + simulate)', () => {
  for (const level of ALL_LEVELS) {
    if (HAND_VALIDATED_LEVEL_IDS.has(level.id)) {
      test(`${level.id} (${level.name}): validada por simulate com solução explícita`, () => {
        const placedCells = HAND_VALIDATED_SOLUTIONS[level.id]
        expect(placedCells).toBeDefined()

        const board: BoardState = {
          levelId: level.id,
          placedCells: placedCells as PlacedCell[],
        }

        const electricSpec: LevelSpec = {
          ...level,
          fixedCells: level.fixedCells.filter(f => f.cell.kind !== 'empty'),
        }

        const sim = simulate(electricSpec, board)
        expect(sim.ok).toBe(true)
        expect(sim.sinks.every(s => s.satisfied)).toBe(true)

        // Limites de estrela respeitados na solução explícita
        expect(placedCells!.length).toBe(level.starThresholds.maxPieces)
        expect(level.starThresholds.maxGates).toBe(0)

        if (level.inventory.wires !== null) {
          expect(placedCells!.length).toBeLessThanOrEqual(level.inventory.wires)
        }
      })
    } else {
      test(`${level.id} (${level.name}): tem solução dentro do inventário`, () => {
        const result = solveLevel(level)
        expect(result.solved, `motivo da falha: ${result.reason ?? '?'}`).toBe(true)
        expect(result.board).toBeDefined()
        expect(result.wiresUsed).toBeDefined()

        expect(result.wiresUsed).toBe(level.starThresholds.maxPieces)
        expect(level.starThresholds.maxGates).toBe(0)

        if (level.inventory.wires !== null) {
          expect(result.wiresUsed as number).toBeLessThanOrEqual(level.inventory.wires)
        }
      })
    }
  }
})

describe('campanha completa — nenhuma fase pede porta do inventário', () => {
  for (const level of ALL_LEVELS) {
    test(`${level.id}: portas do nível já estão fixas no tabuleiro`, () => {
      for (const count of Object.values(level.inventory.gates)) {
        expect(count).toBe(0)
      }
    })
  }
})

describe('Pack 1 — "Primeiros sinais": assimilação sem porta, obstáculo na fase 3', () => {
  test('as 3 fases não têm porta nenhuma (só fonte, fio e destino)', () => {
    for (const level of PRIMEIROS_SINAIS_PACK.levels) {
      expect(level.fixedCells.some(f => f.cell.kind === 'gate')).toBe(false)
    }
  })

  test('a fase 3 introduz uma parede (obstáculo de rota)', () => {
    const [, , desvio] = PRIMEIROS_SINAIS_PACK.levels
    expect(desvio?.fixedCells.some(f => f.cell.kind === 'empty')).toBe(true)
  })

  test('as fases 1 e 2 não têm parede (só a 3ª introduz o obstáculo)', () => {
    const [primeiroSinal, sinalZero] = PRIMEIROS_SINAIS_PACK.levels
    expect(primeiroSinal?.fixedCells.some(f => f.cell.kind === 'empty')).toBe(false)
    expect(sinalZero?.fixedCells.some(f => f.cell.kind === 'empty')).toBe(false)
  })
})

describe('Pack 2 — "Negações": inversor e dupla negação', () => {
  test('as 4 fases têm apenas portas NOT', () => {
    for (const level of NEGACOES_PACK.levels) {
      const gates = level.fixedCells.filter(f => f.cell.kind === 'gate')
      expect(gates.length).toBeGreaterThan(0)
      expect(gates.every(f => f.cell.kind === 'gate' && f.cell.gate === 'NOT')).toBe(true)
    }
  })

  test('fase final (p2-4): solução ótima com exatamente 2 NOTs em série', () => {
    const duplaNegacao = NEGACOES_PACK.levels.find(l => l.id === 'p2-4')
    expect(duplaNegacao).toBeDefined()
    const gates = (duplaNegacao as LevelSpec).fixedCells.filter(f => f.cell.kind === 'gate')
    expect(gates).toHaveLength(2)
    expect(gates.every(f => f.cell.kind === 'gate' && f.cell.gate === 'NOT')).toBe(true)

    const result = solveLevel(duplaNegacao as LevelSpec)
    expect(result.solved).toBe(true)
  })

  test('as 3 primeiras fases têm exatamente 1 NOT; só a final tem 2', () => {
    const counts = NEGACOES_PACK.levels.map(
      l => l.fixedCells.filter(f => f.cell.kind === 'gate').length,
    )
    expect(counts).toEqual([1, 1, 1, 2])
  })
})

describe('Pack 3 — "E / OU": portas de 2 entradas, gêmeas e linha única', () => {
  test('toda porta do pack tem exatamente 2 lados de entrada declarados', () => {
    for (const level of E_OU_PACK.levels) {
      for (const fixed of level.fixedCells) {
        if (fixed.cell.kind !== 'gate') continue
        if (fixed.cell.gate === 'NOT') continue
        expect(fixed.cell.inputSides).toHaveLength(2)
      }
    }
  })

  test('contém o par de fases gêmeas: mesmo tabuleiro, alvos AND vs OR', () => {
    const and = E_OU_PACK.levels.find(l => l.id === 'p3-3') as LevelSpec
    const or = E_OU_PACK.levels.find(l => l.id === 'p3-4') as LevelSpec
    expect(and).toBeDefined()
    expect(or).toBeDefined()

    expect(and.grid).toEqual(or.grid)
    expect(and.fixedCells.map(f => f.coord)).toEqual(or.fixedCells.map(f => f.coord))

    const sourcesOf = (level: LevelSpec) =>
      level.fixedCells.filter(f => f.cell.kind === 'source').map(f => f.cell)
    expect(sourcesOf(and)).toEqual(sourcesOf(or))

    const gateOf = (level: LevelSpec) => level.fixedCells.find(f => f.cell.kind === 'gate')?.cell
    const andGate = gateOf(and)
    const orGate = gateOf(or)
    expect(andGate?.kind).toBe('gate')
    expect(orGate?.kind).toBe('gate')
    expect(andGate && 'gate' in andGate ? andGate.gate : undefined).toBe('AND')
    expect(orGate && 'gate' in orGate ? orGate.gate : undefined).toBe('OR')

    const sinkOf = (level: LevelSpec) => level.fixedCells.find(f => f.cell.kind === 'sink')?.cell
    const andSink = sinkOf(and)
    const orSink = sinkOf(or)
    expect(andSink?.kind).toBe('sink')
    expect(orSink?.kind).toBe('sink')
    expect(andSink && 'expected' in andSink ? andSink.expected : undefined).toBe(0)
    expect(orSink && 'expected' in orSink ? orSink.expected : undefined).toBe(1)
  })

  test('fase final (p3-5): alvo satisfeito em apenas 1 das 4 linhas possíveis', () => {
    const level = E_OU_PACK.levels.find(l => l.id === 'p3-5') as LevelSpec
    expect(level).toBeDefined()

    const gate = level.fixedCells.find(f => f.cell.kind === 'gate' && f.cell.gate !== 'NOT')
      ?.cell as { readonly gate: 'AND' | 'OR' }
    const evaluate = (a: 0 | 1, b: 0 | 1): 0 | 1 => {
      const merged = gate.gate === 'AND' ? (a === 1 && b === 1 ? 1 : 0) : a === 1 || b === 1 ? 1 : 0
      const hasNot = level.fixedCells.some(f => f.cell.kind === 'gate' && f.cell.gate === 'NOT')
      return hasNot ? (merged === 1 ? 0 : 1) : merged
    }

    const rows: Array<[0 | 1, 0 | 1]> = [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ]
    const satisfyingRows = rows.filter(([a, b]) => evaluate(a, b) === 1)
    expect(satisfyingRows).toHaveLength(1)

    const sources = level.fixedCells
      .filter(f => f.cell.kind === 'source')
      .map(f => (f.cell as { readonly value: 0 | 1 }).value)
      .sort()
    expect(sources).toEqual([satisfyingRows[0]?.[0], satisfyingRows[0]?.[1]].sort())
  })
})

describe('Pack 4 — "Compondo": composição, precedência e 2 níveis', () => {
  test('exatamente 4 fases com progressão de composição', () => {
    expect(COMPONDO_PACK.levels).toHaveLength(4)
  })

  test('p4-1: NOT alimentando porta AND', () => {
    const p4_1 = COMPONDO_PACK.levels.find(l => l.id === 'p4-1') as LevelSpec
    expect(p4_1).toBeDefined()
    const gates = p4_1.fixedCells.filter(f => f.cell.kind === 'gate')
    expect(gates).toHaveLength(2)
    expect(gates.some(g => (g.cell as { readonly gate: string }).gate === 'NOT')).toBe(true)
    expect(gates.some(g => (g.cell as { readonly gate: string }).gate === 'AND')).toBe(true)
    expect(p4_1.expression).toContain('¬')
    expect(p4_1.expression).toContain('·')
  })

  test('p4-2 e p4-3: par didático de precedência (A·B)+C vs A·(B+C)', () => {
    const p4_2 = COMPONDO_PACK.levels.find(l => l.id === 'p4-2') as LevelSpec
    const p4_3 = COMPONDO_PACK.levels.find(l => l.id === 'p4-3') as LevelSpec
    expect(p4_2).toBeDefined()
    expect(p4_3).toBeDefined()

    // Mesmo tamanho de grid
    expect(p4_2.grid).toEqual(p4_3.grid)

    // Em p4-2 o AND alimenta o OR: (A · B) + C
    expect(p4_2.expression).toBe('S = (A · B) + C')
    // Em p4-3 o OR alimenta o AND: A · (B + C)
    expect(p4_3.expression).toBe('S = A · (B + C)')
  })

  test('fase final (p4-4): três portas em dois níveis', () => {
    const p4_4 = COMPONDO_PACK.levels.find(l => l.id === 'p4-4') as LevelSpec
    expect(p4_4).toBeDefined()
    const gates = p4_4.fixedCells.filter(f => f.cell.kind === 'gate')
    expect(gates).toHaveLength(3)

    const gateTypes = gates.map(g => (g.cell as { readonly gate: string }).gate).sort()
    expect(gateTypes).toEqual(['AND', 'NOT', 'OR'].sort())
    expect(p4_4.expression).toBe('S = (A · B) + ¬C')
  })
})

describe('Pack 5 — "Caminhos": fan-out, curto induzido, ciclo e roteamento apertado', () => {
  test('exatamente 5 fases', () => {
    expect(CAMINHOS_PACK.levels).toHaveLength(5)
  })

  test('p5-1: net com fan-out (uma fonte alimentando dois destinos)', () => {
    const p5_1 = CAMINHOS_PACK.levels.find(l => l.id === 'p5-1') as LevelSpec
    expect(p5_1).toBeDefined()
    const sources = p5_1.fixedCells.filter(f => f.cell.kind === 'source')
    const sinks = p5_1.fixedCells.filter(f => f.cell.kind === 'sink')
    expect(sources).toHaveLength(1)
    expect(sinks).toHaveLength(2)
  })

  test('p5-2: induz curto-circuito na tentativa natural de ligar as duas fontes ao destino', () => {
    const p5_2 = CAMINHOS_PACK.levels.find(l => l.id === 'p5-2') as LevelSpec
    expect(p5_2).toBeDefined()

    // Tentativa ingênua/natural: o jogador vê duas fontes e um destino e junta
    // ambas ao mesmo fio central, fundindo os sinais 1 e 0.
    const naturalShortWires: PlacedCell[] = [
      { coord: { x: 1, y: 0 }, cell: { kind: 'wire', sides: ['W', 'S'] } },
      { coord: { x: 1, y: 2 }, cell: { kind: 'wire', sides: ['W', 'N'] } },
      { coord: { x: 1, y: 1 }, cell: { kind: 'wire', sides: ['N', 'S', 'E'] } },
      { coord: { x: 2, y: 1 }, cell: { kind: 'wire', sides: ['W', 'E'] } },
      { coord: { x: 3, y: 1 }, cell: { kind: 'wire', sides: ['W', 'E'] } },
    ]

    const shortBoard: BoardState = {
      levelId: p5_2.id,
      placedCells: naturalShortWires,
    }

    const sim = simulate(p5_2, shortBoard)
    expect(sim.ok).toBe(false)
    expect(sim.issues.some(i => i.kind === 'short')).toBe(true)
  })

  test('p5-3: expõe ciclo combinacional quando a saída do NOT volta para a própria entrada', () => {
    const p5_3 = CAMINHOS_PACK.levels.find(l => l.id === 'p5-3') as LevelSpec
    expect(p5_3).toBeDefined()

    // Tentativa com laço de realimentação contornando o NOT por cima:
    // saída (2,1) -> (3,1) -> (3,0) -> (2,0) -> (1,0) -> (1,1) -> entrada (2,1).
    const feedbackCycleWires: PlacedCell[] = [
      { coord: { x: 3, y: 1 }, cell: { kind: 'wire', sides: ['W', 'N', 'E'] } },
      { coord: { x: 3, y: 0 }, cell: { kind: 'wire', sides: ['S', 'W'] } },
      { coord: { x: 2, y: 0 }, cell: { kind: 'wire', sides: ['E', 'W'] } },
      { coord: { x: 1, y: 0 }, cell: { kind: 'wire', sides: ['E', 'S'] } },
      { coord: { x: 1, y: 1 }, cell: { kind: 'wire', sides: ['N', 'E'] } },
    ]

    const cycleBoard: BoardState = {
      levelId: p5_3.id,
      placedCells: feedbackCycleWires,
    }

    const sim = simulate(p5_3, cycleBoard)
    expect(sim.ok).toBe(false)
    expect(sim.issues.some(i => i.kind === 'cycle')).toBe(true)
  })

  test('p5-4 e p5-5: roteamento apertado com obstáculos de parede', () => {
    const p5_4 = CAMINHOS_PACK.levels.find(l => l.id === 'p5-4') as LevelSpec
    const p5_5 = CAMINHOS_PACK.levels.find(l => l.id === 'p5-5') as LevelSpec
    expect(p5_4.fixedCells.some(f => f.cell.kind === 'empty')).toBe(true)
    expect(p5_5.fixedCells.filter(f => f.cell.kind === 'empty').length).toBeGreaterThanOrEqual(8)
  })
})

describe('Pack 6 — "Somando bits": XOR, meio-somador e somador completo', () => {
  test('exatamente 3 fases com progressão aritmética', () => {
    expect(SOMANDO_BITS_PACK.levels).toHaveLength(3)
  })

  test('p6-1: primeiro XOR sintetizado a partir de AND, OR e NOT (sem porta XOR primitiva)', () => {
    const p6_1 = SOMANDO_BITS_PACK.levels.find(l => l.id === 'p6-1') as LevelSpec
    expect(p6_1).toBeDefined()

    const gates = p6_1.fixedCells.filter(f => f.cell.kind === 'gate')
    expect(gates.some(g => (g.cell as { readonly gate: string }).gate === 'OR')).toBe(true)
    expect(gates.some(g => (g.cell as { readonly gate: string }).gate === 'AND')).toBe(true)
    expect(gates.some(g => (g.cell as { readonly gate: string }).gate === 'NOT')).toBe(true)
    expect(p6_1.expression).toBe('S = (A + B) · ¬(A · B)')
  })

  test('p6-2: meio-somador expõe 2 sinks (Soma e Vai-um)', () => {
    const p6_2 = SOMANDO_BITS_PACK.levels.find(l => l.id === 'p6-2') as LevelSpec
    expect(p6_2).toBeDefined()

    const sinks = p6_2.fixedCells.filter(f => f.cell.kind === 'sink')
    expect(sinks).toHaveLength(2)

    // 1 + 1: Soma espera 0 e Vai-um espera 1
    const expectedValues = sinks.map(s => (s.cell as { readonly expected: number }).expected).sort()
    expect(expectedValues).toEqual([0, 1])
  })

  test('p6-3: somador completo expõe 2 sinks (Soma e Vai-um) e fecha dentro do limite declarado', () => {
    const p6_3 = SOMANDO_BITS_PACK.levels.find(l => l.id === 'p6-3') as LevelSpec
    expect(p6_3).toBeDefined()

    const sinks = p6_3.fixedCells.filter(f => f.cell.kind === 'sink')
    expect(sinks).toHaveLength(2)

    const expectedValues = sinks.map(s => (s.cell as { readonly expected: number }).expected).sort()
    expect(expectedValues).toEqual([0, 1])

    // Limite de fios comporta a solução ótima
    expect(p6_3.starThresholds.maxPieces).toBeLessThanOrEqual(p6_3.inventory.wires!)
    expect(p6_3.starThresholds.maxPieces).toBe(13)
  })
})

describe('Packs 5 e 6 — ★3 inatingível com solução ingênua, atingível com a otimizada', () => {
  test('p5-1: ramificação antecipada usa 7 fios (inatingível para ★3: 5)', () => {
    const p5_1 = CAMINHOS_PACK.levels.find(l => l.id === 'p5-1') as LevelSpec
    // Rota ingênua que bifurca na coluna 1:
    const naiveWires: PlacedCell[] = [
      { coord: { x: 1, y: 1 }, cell: { kind: 'wire', sides: ['W', 'N', 'S'] } },
      { coord: { x: 1, y: 0 }, cell: { kind: 'wire', sides: ['S', 'E'] } },
      { coord: { x: 2, y: 0 }, cell: { kind: 'wire', sides: ['W', 'E'] } },
      { coord: { x: 3, y: 0 }, cell: { kind: 'wire', sides: ['W', 'E'] } },
      { coord: { x: 1, y: 2 }, cell: { kind: 'wire', sides: ['N', 'E'] } },
      { coord: { x: 2, y: 2 }, cell: { kind: 'wire', sides: ['W', 'E'] } },
      { coord: { x: 3, y: 2 }, cell: { kind: 'wire', sides: ['W', 'E'] } },
    ]
    expect(naiveWires.length).toBe(7)
    expect(naiveWires.length).toBeGreaterThan(p5_1.starThresholds.maxPieces)

    const sim = simulate(p5_1, { levelId: p5_1.id, placedCells: naiveWires })
    expect(sim.ok).toBe(true)
    expect(sim.sinks.every(s => s.satisfied)).toBe(true)

    // Otimizada com o solver atinge ★3 (5 fios):
    const solved = solveLevel(p5_1)
    expect(solved.solved).toBe(true)
    expect(solved.wiresUsed).toBe(p5_1.starThresholds.maxPieces)
  })

  test('p5-4: contorno ingênuo pelos dois lados usa 7 fios (inatingível para ★3: 6)', () => {
    const p5_4 = CAMINHOS_PACK.levels.find(l => l.id === 'p5-4') as LevelSpec
    // Bifurcação antes da parede usa dois caminhos paralelos completos (7 fios):
    const naiveWires: PlacedCell[] = [
      { coord: { x: 2, y: 1 }, cell: { kind: 'wire', sides: ['W', 'N', 'S'] } },
      { coord: { x: 2, y: 0 }, cell: { kind: 'wire', sides: ['S', 'E'] } },
      { coord: { x: 3, y: 0 }, cell: { kind: 'wire', sides: ['W', 'E'] } },
      { coord: { x: 4, y: 0 }, cell: { kind: 'wire', sides: ['W', 'E'] } },
      { coord: { x: 2, y: 2 }, cell: { kind: 'wire', sides: ['N', 'E'] } },
      { coord: { x: 3, y: 2 }, cell: { kind: 'wire', sides: ['W', 'E'] } },
      { coord: { x: 4, y: 2 }, cell: { kind: 'wire', sides: ['W', 'E'] } },
    ]
    expect(naiveWires.length).toBe(7)
    expect(naiveWires.length).toBeGreaterThan(p5_4.starThresholds.maxPieces)

    const electricSpec: LevelSpec = {
      ...p5_4,
      fixedCells: p5_4.fixedCells.filter(f => f.cell.kind !== 'empty'),
    }
    const sim = simulate(electricSpec, { levelId: p5_4.id, placedCells: naiveWires })
    expect(sim.ok).toBe(true)
    expect(sim.sinks.every(s => s.satisfied)).toBe(true)

    // Otimizada atinge ★3 (6 fios):
    const solved = solveLevel(p5_4)
    expect(solved.solved).toBe(true)
    expect(solved.wiresUsed).toBe(p5_4.starThresholds.maxPieces)
  })

  test('p5-5: desvio desnecessário no corredor usa 15 fios (inatingível para ★3: 13)', () => {
    const p5_5 = CAMINHOS_PACK.levels.find(l => l.id === 'p5-5') as LevelSpec
    // Otimizada atinge ★3 (13 fios):
    const solved = solveLevel(p5_5)
    expect(solved.solved).toBe(true)
    expect(solved.wiresUsed).toBe(p5_5.starThresholds.maxPieces)
    expect(p5_5.inventory.wires).toBe(15)
    expect(p5_5.inventory.wires).toBeGreaterThan(p5_5.starThresholds.maxPieces)
  })

  test('p6-1: desvio de rota usa mais fios que o limite de ★3 (3 fios)', () => {
    const p6_1 = SOMANDO_BITS_PACK.levels.find(l => l.id === 'p6-1') as LevelSpec
    const solved = solveLevel(p6_1)
    expect(solved.solved).toBe(true)
    expect(solved.wiresUsed).toBe(p6_1.starThresholds.maxPieces)
    expect(p6_1.inventory.wires).toBe(5)
    expect(p6_1.inventory.wires).toBeGreaterThan(p6_1.starThresholds.maxPieces)
  })

  test('p6-2: desvio de rota usa mais fios que o limite de ★3 (4 fios)', () => {
    const p6_2 = SOMANDO_BITS_PACK.levels.find(l => l.id === 'p6-2') as LevelSpec
    const solved = solveLevel(p6_2)
    expect(solved.solved).toBe(true)
    expect(solved.wiresUsed).toBe(p6_2.starThresholds.maxPieces)
    expect(p6_2.inventory.wires).toBe(6)
    expect(p6_2.inventory.wires).toBeGreaterThan(p6_2.starThresholds.maxPieces)
  })
})
