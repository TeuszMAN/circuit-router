// Testes de fumaça dos packs 1–3 (MI-17): schema, solubilidade pelo solver,
// atingibilidade das estrelas, dicas em dois níveis e as marcas didáticas
// pedidas pelo SDD §9.B (dupla negação com 2 NOTs, par de fases gêmeas
// AND/OR, fase de "uma só linha" da tabela-verdade).

import { describe, expect, test } from 'vitest'
import { LEVEL_SCHEMA_VERSION } from '@circuit/core/model'
import type { LevelSpec } from '@circuit/core/model'
import { solveLevel } from '@circuit/core/gen'
import { E_OU_PACK, NEGACOES_PACK, PACKS, PRIMEIROS_SINAIS_PACK } from './index'

const ALL_LEVELS: readonly LevelSpec[] = PACKS.flatMap(pack => pack.levels)

const COORD_PATTERN = /\(\s*\d+\s*,\s*\d+\s*\)|\bx\s*[:=]\s*\d|\by\s*[:=]\s*\d|\bcoluna\s+\d|\blinha\s+\d/i

describe('packs 1–3 (MI-17) — inventário e estrutura', () => {
  test('exatamente 3 packs, com 3 + 4 + 5 fases', () => {
    expect(PACKS).toHaveLength(3)
    expect(PRIMEIROS_SINAIS_PACK.levels).toHaveLength(3)
    expect(NEGACOES_PACK.levels).toHaveLength(4)
    expect(E_OU_PACK.levels).toHaveLength(5)
  })

  test('cada pack declara nome, tema e conceito não vazios', () => {
    for (const pack of PACKS) {
      expect(pack.name.length).toBeGreaterThan(0)
      expect(pack.theme.length).toBeGreaterThan(0)
      expect(pack.concept.length).toBeGreaterThan(0)
    }
  })

  test('12 ids únicos, no formato pN-M', () => {
    const ids = ALL_LEVELS.map(l => l.id)
    expect(ids).toHaveLength(12)
    expect(new Set(ids).size).toBe(12)
    for (const id of ids) expect(id).toMatch(/^p[1-3]-\d$/)
  })
})

describe('packs 1–3 (MI-17) — schema e dicas', () => {
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

describe('packs 1–3 (MI-17) — todas as fases são resolvíveis pelo solver', () => {
  for (const level of ALL_LEVELS) {
    test(`${level.id} (${level.name}): tem solução dentro do inventário`, () => {
      const result = solveLevel(level)
      expect(result.solved, `motivo da falha: ${result.reason ?? '?'}`).toBe(true)
      expect(result.board).toBeDefined()
      expect(result.wiresUsed).toBeDefined()

      // starThresholds derivados do solver: maxPieces é exatamente o nº de
      // fios da solução ótima encontrada (não uma estimativa no olho), e
      // nenhuma fase pede do jogador a colocação de porta (maxGates sempre
      // 0 — gates são fixas, ver bloco de inventário abaixo).
      expect(result.wiresUsed).toBe(level.starThresholds.maxPieces)
      expect(level.starThresholds.maxGates).toBe(0)

      // Inventário declarado (quando limitado) precisa comportar a solução.
      if (level.inventory.wires !== null) {
        expect(result.wiresUsed as number).toBeLessThanOrEqual(level.inventory.wires)
      }
    })
  }
})

describe('packs 1–3 (MI-17) — nenhuma fase pede porta do inventário', () => {
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

    // Mesmo tabuleiro: grid idêntico e mesmas coordenadas fixas.
    expect(and.grid).toEqual(or.grid)
    expect(and.fixedCells.map(f => f.coord)).toEqual(or.fixedCells.map(f => f.coord))

    // Mesmas fontes com os mesmos valores — só a porta e o alvo mudam.
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
    // Mesmas fontes (1 e 0): a AND apaga o destino e a OR acende — o contraste
    // que o SDD pede entre "os dois" e "pelo menos um".
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

    // As fontes fixas da fase realizam exatamente essa linha satisfatória.
    const sources = level.fixedCells
      .filter(f => f.cell.kind === 'source')
      .map(f => (f.cell as { readonly value: 0 | 1 }).value)
      .sort()
    expect(sources).toEqual([satisfyingRows[0]?.[0], satisfyingRows[0]?.[1]].sort())
  })
})
