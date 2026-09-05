// Testes da simulação por nets (MI-03) — critérios de aceite:
// tabelas-verdade completas, short vs cycle bem distinguidos, floating,
// unpowered-gate, determinismo e traço passo-a-passo.

import { describe, expect, it } from 'vitest'
import { LEVEL_SCHEMA_VERSION } from '../model'
import type { BoardState, Cell, Coord, Direction, GateType, LevelSpec, WireCell } from '../model'
import { simulate, simulateWithTrace } from './index'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Placeable = { coord: Coord; cell: WireCell }

function fixed(coord: Coord, cell: Cell) {
  return { coord, cell }
}

function level(width: number, height: number, fixedCells: ReturnType<typeof fixed>[]): LevelSpec {
  return {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'test-level',
    name: 'Nível de teste',
    grid: { width, height },
    fixedCells,
    inventory: { wires: null, gates: {} },
    hints: ['dica 1', 'dica 2'],
    starThresholds: { maxPieces: 99, maxGates: 99 },
  }
}

function board(placed: readonly Placeable[]): BoardState {
  return { levelId: 'test-level', placedCells: placed }
}

const W = (x: number, y: number, sides: readonly Direction[]) =>
  ({ coord: { x, y }, cell: { kind: 'wire', sides } }) as Placeable

const src = (x: number, y: number, value: 0 | 1, outputSide: Direction) =>
  fixed({ x, y }, { kind: 'source', value, outputSide })

const snk = (x: number, y: number, expected: 0 | 1, inputSide: Direction) =>
  fixed({ x, y }, { kind: 'sink', expected, inputSide })

const gate = (
  x: number,
  y: number,
  g: GateType,
  inputSides: readonly Direction[],
  outputSide: Direction,
) =>
  fixed({ x, y }, { kind: 'gate', gate: g, rotation: outputSide, inputSides, outputSide }) as ReturnType<
    typeof fixed
  >

const emptyBoard = board([])

/** Monta linha de teste de porta: fonte A e B alimentam entradas W e N; sink na saída E. */
function gateRig(g: GateType, a: 0 | 1, b: 0 | 1, expected: 0 | 1): LevelSpec {
  return level(3, 2, [
    src(0, 1, a, 'E'),
    src(1, 0, b, 'S'),
    gate(1, 1, g, ['W', 'N'], 'E'),
    snk(2, 1, expected, 'W'),
  ])
}

// ---------------------------------------------------------------------------
// Tabelas-verdade
// ---------------------------------------------------------------------------

describe('tabelas-verdade (critério MI-03)', () => {
  it('NOT: 0 -> 1 e 1 -> 0', () => {
    const l0 = level(3, 1, [src(0, 0, 0, 'E'), gate(1, 0, 'NOT', ['W'], 'E'), snk(2, 0, 1, 'W')])
    expect(simulate(l0, emptyBoard).ok).toBe(true)

    const l1 = level(3, 1, [src(0, 0, 1, 'E'), gate(1, 0, 'NOT', ['W'], 'E'), snk(2, 0, 0, 'W')])
    const r1 = simulate(l1, emptyBoard)
    expect(r1.ok).toBe(true)
    expect(r1.sinks[0]?.actual).toBe(0)
  })

  it('AND: só 1 com ambas as entradas em 1 (4 linhas)', () => {
    for (const a of [0, 1] as const) {
      for (const b of [0, 1] as const) {
        const expected = a === 1 && b === 1 ? 1 : 0
        const result = simulate(gateRig('AND', a, b, expected), emptyBoard)
        expect(result.ok, `AND(${a},${b}) deveria satisfazer sink=${expected}`).toBe(true)
        expect(result.issues).toEqual([])
      }
    }
  })

  it('OR: 1 quando pelo menos uma entrada vale 1 (4 linhas)', () => {
    for (const a of [0, 1] as const) {
      for (const b of [0, 1] as const) {
        const expected = a === 1 || b === 1 ? 1 : 0
        const result = simulate(gateRig('OR', a, b, expected), emptyBoard)
        expect(result.ok, `OR(${a},${b}) deveria satisfazer sink=${expected}`).toBe(true)
        expect(result.issues).toEqual([])
      }
    }
  })

  it('porta com sink esperando valor errado: mismatch sem issues', () => {
    const l = gateRig('AND', 1, 1, 0) // espera 0, recebe 1
    const result = simulate(l, emptyBoard)
    expect(result.ok).toBe(false)
    expect(result.issues).toEqual([])
    expect(result.sinks[0]?.satisfied).toBe(false)
    expect(result.sinks[0]?.actual).toBe(1)
    expect(result.sinks[0]?.expected).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Fios, nets e fan-out
// ---------------------------------------------------------------------------

describe('fios e nets (critério MI-03)', () => {
  it('propaga sinal por cadeia de fios até o sink', () => {
    const l = level(4, 1, [src(0, 0, 1, 'E'), snk(3, 0, 1, 'W')])
    const b = board([W(1, 0, ['W', 'E']), W(2, 0, ['W', 'E'])])
    const result = simulate(l, b)
    expect(result.ok).toBe(true)
    expect(result.issues).toEqual([])
    expect(result.sinks[0]?.actual).toBe(1)
  })

  it('fio com o valor certo propaga 0 também', () => {
    const l = level(4, 1, [src(0, 0, 0, 'E'), snk(3, 0, 0, 'W')])
    const b = board([W(1, 0, ['W', 'E']), W(2, 0, ['W', 'E'])])
    expect(simulate(l, b).ok).toBe(true)
  })

  it('fan-out: um sinal alimenta dois sinks (ler não gasta)', () => {
    const l = level(3, 2, [src(0, 0, 1, 'E'), snk(2, 0, 1, 'W'), snk(1, 1, 1, 'N')])
    const b = board([W(1, 0, ['W', 'E', 'S'])])
    const result = simulate(l, b)
    expect(result.ok).toBe(true)
    expect(result.sinks).toHaveLength(2)
    expect(result.sinks.every(s => s.satisfied)).toBe(true)
  })

  it('fio em T alimenta porta e sink simultaneamente', () => {
    // source -> wire(1,0)[W,E,S] -> NOT (leste) e sink (sul)
    const l = level(4, 2, [
      src(0, 0, 1, 'E'),
      gate(2, 0, 'NOT', ['W'], 'E'),
      snk(3, 0, 0, 'W'),
      snk(1, 1, 1, 'N'),
    ])
    const b = board([W(1, 0, ['W', 'E', 'S'])])
    const result = simulate(l, b)
    expect(result.ok).toBe(true)
  })

  it('fio colocado sobre célula fixa é ignorado (invariante SDD §6.3)', () => {
    const l = level(3, 1, [src(0, 0, 0, 'E'), gate(1, 0, 'NOT', ['W'], 'E'), snk(2, 0, 1, 'W')])
    const b = board([W(1, 0, ['W', 'E'])]) // tenta sobrescrever o NOT
    const result = simulate(l, b)
    expect(result.ok).toBe(true) // NOT intacto
  })
})

// ---------------------------------------------------------------------------
// Diagnósticos: curto, ciclo, flutuante, sem energia
// ---------------------------------------------------------------------------

describe('diagnósticos estruturados (critério MI-03)', () => {
  it('curto: dois drivers brigando na mesma net de fios', () => {
    const l = level(3, 1, [src(0, 0, 1, 'E'), src(2, 0, 0, 'W')])
    const b = board([W(1, 0, ['W', 'E'])])
    const result = simulate(l, b)
    expect(result.ok).toBe(false)
    const shorts = result.issues.filter(i => i.kind === 'short')
    expect(shorts.length).toBeGreaterThan(0)
    const cells = shorts.flatMap(s => s.cells)
    expect(cells.some(c => c.x === 0 && c.y === 0)).toBe(true)
    expect(cells.some(c => c.x === 2 && c.y === 0)).toBe(true)
    expect(cells.some(c => c.x === 1 && c.y === 0)).toBe(true) // o fio
  })

  it('curto: dois sources cara a cara sem fio (junção)', () => {
    const l = level(2, 1, [src(0, 0, 1, 'E'), src(1, 0, 0, 'W')])
    const result = simulate(l, emptyBoard)
    expect(result.issues.some(i => i.kind === 'short')).toBe(true)
  })

  it('ciclo: NOT realimentado é cycle, NUNCA short', () => {
    // NOT em (1,0) com laço de fios da saída (leste) de volta à entrada (oeste).
    const l = level(3, 2, [gate(1, 0, 'NOT', ['W'], 'E')])
    const b = board([
      W(2, 0, ['W', 'S']),
      W(2, 1, ['N', 'W']),
      W(1, 1, ['E', 'W']),
      W(0, 1, ['E', 'N']),
      W(0, 0, ['S', 'E']),
    ])
    const result = simulate(l, b)
    expect(result.issues.some(i => i.kind === 'short')).toBe(false)
    const cycles = result.issues.filter(i => i.kind === 'cycle')
    expect(cycles.length).toBeGreaterThan(0)
    expect(cycles.flatMap(c => c.cells).some(c => c.x === 1 && c.y === 0)).toBe(true)
  })

  it('floating: sink sem nenhuma fonte nem fio', () => {
    const l = level(3, 1, [snk(2, 0, 1, 'W')])
    const result = simulate(l, emptyBoard)
    expect(result.ok).toBe(false)
    const floats = result.issues.filter(i => i.kind === 'floating')
    expect(floats.length).toBeGreaterThan(0)
    expect(floats.flatMap(f => f.cells).some(c => c.x === 2 && c.y === 0)).toBe(true)
    expect(result.sinks[0]?.satisfied).toBe(false)
  })

  it('floating: net de fios sem driver alimentando sink', () => {
    const l = level(3, 1, [snk(2, 0, 1, 'W')])
    const b = board([W(1, 0, ['W', 'E'])])
    const result = simulate(l, b)
    const floats = result.issues.filter(i => i.kind === 'floating')
    expect(floats.length).toBeGreaterThan(0)
    const cells = floats.flatMap(f => f.cells)
    expect(cells.some(c => c.x === 1 && c.y === 0)).toBe(true) // o fio
  })

  it('unpowered-gate: porta com uma entrada alimentada e outra em falta', () => {
    const l = level(3, 2, [
      src(0, 0, 1, 'E'),
      gate(1, 0, 'AND', ['W', 'N'], 'E'),
      snk(2, 0, 1, 'W'),
    ])
    // input W <- source; input N olha para fora do grid (bare).
    const result = simulate(l, emptyBoard)
    expect(result.issues.some(i => i.kind === 'unpowered-gate')).toBe(true)
    expect(result.issues.some(i => i.kind === 'short')).toBe(false)
    expect(result.issues.some(i => i.kind === 'cycle')).toBe(false)
  })

  it('porta com entradas incompletas não emite saída', () => {
    const l = level(3, 2, [
      src(0, 0, 1, 'E'),
      gate(1, 0, 'AND', ['W', 'N'], 'E'),
      snk(2, 0, 1, 'W'),
    ])
    const result = simulate(l, emptyBoard)
    expect(result.sinks[0]?.actual).toBeUndefined()
    expect(result.sinks[0]?.satisfied).toBe(false)
  })

  it('dupla negação: dois NOTs em série devolvem o sinal original', () => {
    const l = level(4, 1, [
      src(0, 0, 0, 'E'),
      gate(1, 0, 'NOT', ['W'], 'E'),
      gate(2, 0, 'NOT', ['W'], 'E'),
      snk(3, 0, 0, 'W'),
    ])
    expect(simulate(l, emptyBoard).ok).toBe(true)
  })

  it('porta dirigindo sink direto (sem fio) funciona', () => {
    const l = level(3, 1, [src(0, 0, 1, 'E'), gate(1, 0, 'NOT', ['W'], 'E'), snk(2, 0, 0, 'W')])
    const result = simulate(l, emptyBoard)
    expect(result.ok).toBe(true)
    expect(result.sinks[0]?.actual).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Determinismo e traço
// ---------------------------------------------------------------------------

describe('determinismo e traço (critério MI-03)', () => {
  it('resultado idêntico em execuções repetidas', () => {
    const l = gateRig('OR', 1, 0, 1)
    const a = simulate(l, emptyBoard)
    const b = simulate(l, emptyBoard)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('traço passo-a-passo exporta a ordem da propagação', () => {
    // source -> fio -> NOT -> fio -> sink
    const l = level(4, 1, [src(0, 0, 1, 'E'), gate(2, 0, 'NOT', ['W'], 'E'), snk(3, 0, 0, 'W')])
    const b = board([W(1, 0, ['W', 'E'])])
    const { result, trace } = simulateWithTrace(l, b, { trace: true })
    expect(result.ok).toBe(true)
    expect(trace.length).toBeGreaterThanOrEqual(2)
    const firstStep = trace[0]
    if (!firstStep) throw new Error('trace vazio')
    // passo 0: fio da net da fonte acende primeiro
    expect(firstStep.cells.some(c => c.x === 1 && c.y === 0)).toBe(true)
    // algum passo contém o NOT (a porta que resolveu)
    expect(trace.some(step => step.cells.some(c => c.x === 2 && c.y === 0))).toBe(true)
  })

  it('sem trace, a saída traz lista vazia', () => {
    const l = level(3, 1, [src(0, 0, 0, 'E'), gate(1, 0, 'NOT', ['W'], 'E'), snk(2, 0, 1, 'W')])
    const { trace } = simulateWithTrace(l, emptyBoard)
    expect(trace).toEqual([])
  })
})
