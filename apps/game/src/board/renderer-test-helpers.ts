/**
 * Harness de teste do renderizador (jsdom não tem canvas 2D real, rAF nem
 * matchMedia): instala um `getContext('2d')` fake que registra chamadas,
 * drivers manuais de rAF/ResizeObserver e construtores de nível/frame.
 * Apenas testes importam este arquivo — o app nunca o vê.
 */

import { vi, type Mock } from 'vitest'
import type { BoardState, LevelSpec, SimulationIssue } from '@circuit/core/model'
import { LEVEL_SCHEMA_VERSION } from '@circuit/core/model'
import type { SimTraceStep } from '@circuit/core/sim'
import type { RenderFrame } from '../app/contracts'

// ---------------------------------------------------------------------------
// Canvas 2D fake
// ---------------------------------------------------------------------------

export type FakeContext = CanvasRenderingContext2D & {
  readonly calls: Record<string, unknown[][]>
}

const CTX_METHODS = [
  'save',
  'restore',
  'beginPath',
  'closePath',
  'moveTo',
  'lineTo',
  'arc',
  'fill',
  'stroke',
  'fillRect',
  'clearRect',
  'setTransform',
  'fillText',
] as const

/** Sobrescreve `getContext` para devolver um contexto 2D fake que grava tudo. */
export function installCanvas2DMock(): { ctx: FakeContext; restore(): void } {
  const original = HTMLCanvasElement.prototype.getContext
  const calls: Record<string, unknown[][]> = {}
  const record = (method: string) =>
    vi.fn((...args: unknown[]) => {
      const list = calls[method] ?? (calls[method] = [])
      list.push(args)
    })
  const ctx: Record<string, unknown> = { calls }
  for (const method of CTX_METHODS) ctx[method] = record(method)

  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, id: string) {
    if (id === '2d') {
      ctx.canvas = this
      return ctx as unknown as CanvasRenderingContext2D
    }
    return null
  } as unknown as typeof HTMLCanvasElement.prototype.getContext

  return {
    ctx: ctx as unknown as FakeContext,
    restore() {
      HTMLCanvasElement.prototype.getContext = original
    },
  }
}

export function paintCount(ctx: FakeContext): number {
  return (ctx.calls.clearRect ?? []).length
}

// ---------------------------------------------------------------------------
// Drivers manuais (rAF, ResizeObserver, matchMedia)
// ---------------------------------------------------------------------------

export function makeRafDriver(): {
  requestAnimationFrame: (cb: (time: number) => void) => number
  cancelAnimationFrame: (handle: number) => void
  pending(): number
  step(time: number): void
} {
  let nextId = 1
  const pending = new Map<number, (time: number) => void>()
  return {
    requestAnimationFrame(cb) {
      const id = nextId++
      pending.set(id, cb)
      return id
    },
    cancelAnimationFrame(handle) {
      pending.delete(handle)
    },
    pending() {
      return pending.size
    },
    step(time: number) {
      const callbacks = [...pending.values()]
      pending.clear()
      for (const cb of callbacks) cb(time)
    },
  }
}

export interface FakeResizeObserverEntry {
  readonly contentRect: { readonly width: number; readonly height: number }
}

export interface FakeResizeObserver {
  readonly observe: Mock<(target: Element) => void>
  readonly disconnect: Mock<() => void>
  fire(width: number, height: number): void
}

export function makeResizeObserverDriver(): {
  ctor: new (cb: (entries: readonly FakeResizeObserverEntry[]) => void) => FakeResizeObserver
  instances: FakeResizeObserver[]
} {
  const instances: FakeResizeObserver[] = []
  class FakeResizeObserverImpl implements FakeResizeObserver {
    readonly observe = vi.fn<(target: Element) => void>()
    readonly disconnect = vi.fn<() => void>()
    private callback: (entries: readonly FakeResizeObserverEntry[]) => void
    constructor(callback: (entries: readonly FakeResizeObserverEntry[]) => void) {
      this.callback = callback
      instances.push(this)
    }
    fire(width: number, height: number): void {
      this.callback([{ contentRect: { width, height } }])
    }
  }
  return { ctor: FakeResizeObserverImpl, instances }
}

export function makeMatchMedia(matches: boolean): (query: string) => { matches: boolean } {
  return () => ({ matches })
}

// ---------------------------------------------------------------------------
// Fixtures de nível/frame
// ---------------------------------------------------------------------------

/**
 * Nível 3×1 com fonte em 0 (valor 1 → E) e sink em 2 (espera 1 ← W).
 * Colocar um fio reto em (1,0) satisfaz o sink e produz traço de 1 passo.
 */
export function makeLevel(): LevelSpec {
  return {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'test-level',
    name: 'Teste',
    grid: { width: 3, height: 1 },
    fixedCells: [
      { coord: { x: 0, y: 0 }, cell: { kind: 'source', value: 1, outputSide: 'E' } },
      { coord: { x: 2, y: 0 }, cell: { kind: 'sink', expected: 1, inputSide: 'W' } },
    ],
    inventory: { wires: null, gates: { NOT: 0, AND: 0, OR: 0 } },
    hints: ['hint1', 'hint2'],
    starThresholds: { maxPieces: 1, maxGates: 0 },
  }
}

export function makeBoard(placedCells: BoardState['placedCells'] = []): BoardState {
  return { levelId: 'test-level', placedCells }
}

export const WIRE_EW = {
  kind: 'wire' as const,
  sides: ['W', 'E'] as const,
}

export function makeFrame(overrides: Partial<RenderFrame> = {}): RenderFrame {
  return {
    level: makeLevel(),
    board: makeBoard([{ coord: { x: 1, y: 0 }, cell: { ...WIRE_EW } }]),
    issues: [],
    selected: null,
    ...overrides,
  }
}

/** Frame cujo tabuleiro ainda não tem fio (nada a propagar). */
export function makeInertFrame(): RenderFrame {
  return makeFrame({ board: makeBoard([]) })
}

export function makeTraceStep(...coords: Array<[number, number]>): SimTraceStep {
  return { cells: coords.map(([x, y]) => ({ x, y })) }
}

export function makeIssue(kind: SimulationIssue['kind'], ...coords: Array<[number, number]>): SimulationIssue {
  return { kind, cells: coords.map(([x, y]) => ({ x, y })) }
}
