import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Coord } from '@circuit/core/model'
import type { InputCommand } from '../app/contracts'
import { PointerInputController } from './pointer-input-controller'

/** Grid de teste: células de 20px CSS, 10 colunas × 7 linhas, sem origem/padding. */
const CELL = 20
const COLS = 10
const ROWS = 7

function cellAt(xPx: number, yPx: number): Coord | null {
  if (xPx < 0 || yPx < 0) return null
  const x = Math.floor(xPx / CELL)
  const y = Math.floor(yPx / CELL)
  if (x >= COLS || y >= ROWS) return null
  return { x, y }
}

function makeElement(width = COLS * CELL, height = ROWS * CELL): HTMLElement {
  const el = document.createElement('div')
  el.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: width,
      bottom: height,
      width,
      height,
      x: 0,
      y: 0,
      toJSON() {
        return {}
      },
    }) as DOMRect
  return el
}

function firePointer(
  el: HTMLElement,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  opts: { pointerId: number; x: number; y: number; pointerType?: string },
): void {
  const event = new PointerEvent(type, {
    pointerId: opts.pointerId,
    clientX: opts.x,
    clientY: opts.y,
    pointerType: opts.pointerType ?? 'touch',
    bubbles: true,
    cancelable: true,
  })
  el.dispatchEvent(event)
}

function coordCenter(coord: Coord): { x: number; y: number } {
  return { x: coord.x * CELL + CELL / 2, y: coord.y * CELL + CELL / 2 }
}

describe('PointerInputController — traço de arrasto', () => {
  let element: HTMLElement
  let controller: PointerInputController
  let commands: InputCommand[]

  beforeEach(() => {
    element = makeElement()
    commands = []
    controller = new PointerInputController({ cellAt })
    controller.onCommand((command) => commands.push(command))
    controller.attach(element)
  })

  it('define touch-action: none no elemento anexado', () => {
    expect(element.style.touchAction).toBe('none')
  })

  it('nunca registra handler de mouseenter/mouseleave', () => {
    const spy = vi.spyOn(element, 'addEventListener')
    const fresh = new PointerInputController({ cellAt })
    fresh.attach(element)
    const types = spy.mock.calls.map((call) => call[0])
    expect(types).not.toContain('mouseenter')
    expect(types).not.toContain('mouseleave')
    expect(types.every((t) => t.startsWith('pointer'))).toBe(true)
  })

  it('arrasto reto emite drag-path com o caminho completo', () => {
    const start = coordCenter({ x: 0, y: 0 })
    const mid = coordCenter({ x: 1, y: 0 })
    const end = coordCenter({ x: 2, y: 0 })
    firePointer(element, 'pointerdown', { pointerId: 1, x: start.x, y: start.y })
    firePointer(element, 'pointermove', { pointerId: 1, x: mid.x, y: mid.y })
    firePointer(element, 'pointermove', { pointerId: 1, x: end.x, y: end.y })
    firePointer(element, 'pointerup', { pointerId: 1, x: end.x, y: end.y })

    expect(commands).toEqual([
      { type: 'drag-path', path: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }] },
    ])
  })

  it('arrasto rápido em diagonal produz caminho ortogonal contínuo sem buracos', () => {
    const start = coordCenter({ x: 0, y: 0 })
    // Salta direto para (3,3): o pointermove real de um dedo rápido não passa
    // por amostras intermediárias — a correção de diagonal tem que preencher.
    const end = coordCenter({ x: 3, y: 3 })
    firePointer(element, 'pointerdown', { pointerId: 1, x: start.x, y: start.y })
    firePointer(element, 'pointermove', { pointerId: 1, x: end.x, y: end.y })
    firePointer(element, 'pointerup', { pointerId: 1, x: end.x, y: end.y })

    expect(commands).toHaveLength(1)
    const command = commands[0]
    if (command?.type !== 'drag-path') throw new Error('esperava drag-path')
    const path = command.path

    expect(path[0]).toEqual({ x: 0, y: 0 })
    expect(path[path.length - 1]).toEqual({ x: 3, y: 3 })
    for (let i = 1; i < path.length; i += 1) {
      const prev = path[i - 1]!
      const curr = path[i]!
      const dx = Math.abs(curr.x - prev.x)
      const dy = Math.abs(curr.y - prev.y)
      // Nunca diagonal, nunca parado, nunca um salto >1: sem buracos.
      expect(dx + dy).toBe(1)
    }
  })

  it('ponteiro saindo do canvas encerra o traço limpo, sem célula pendente', () => {
    const start = coordCenter({ x: 0, y: 0 })
    const second = coordCenter({ x: 1, y: 0 })
    firePointer(element, 'pointerdown', { pointerId: 1, x: start.x, y: start.y })
    firePointer(element, 'pointermove', { pointerId: 1, x: second.x, y: second.y })
    // Sai para a esquerda do elemento (x negativo) — nenhum pointerleave é
    // disparado (ponteiro capturado); a detecção é geométrica.
    firePointer(element, 'pointermove', { pointerId: 1, x: -5, y: second.y })

    expect(commands).toEqual([
      { type: 'drag-path', path: [{ x: 0, y: 0 }, { x: 1, y: 0 }] },
    ])

    // Depois de encerrado, mover de volta para dentro ou soltar o ponteiro
    // não deve reabrir nem emitir nada — não há célula pendente.
    firePointer(element, 'pointermove', { pointerId: 1, x: start.x, y: start.y })
    firePointer(element, 'pointerup', { pointerId: 1, x: start.x, y: start.y })
    expect(commands).toHaveLength(1)
  })

  it('descarta silenciosamente um clique nascente que sai do canvas antes de alcançar uma segunda célula', () => {
    const start = coordCenter({ x: 0, y: 0 })
    firePointer(element, 'pointerdown', { pointerId: 1, x: start.x, y: start.y })
    firePointer(element, 'pointermove', { pointerId: 1, x: -5, y: start.y })
    firePointer(element, 'pointerup', { pointerId: 1, x: -5, y: start.y })

    expect(commands).toEqual([])
  })

  it('pointercancel descarta o traço sem emitir comando', () => {
    const start = coordCenter({ x: 0, y: 0 })
    const second = coordCenter({ x: 1, y: 0 })
    firePointer(element, 'pointerdown', { pointerId: 1, x: start.x, y: start.y })
    firePointer(element, 'pointermove', { pointerId: 1, x: second.x, y: second.y })
    firePointer(element, 'pointercancel', { pointerId: 1, x: second.x, y: second.y })

    expect(commands).toEqual([])
  })
})

describe('PointerInputController — tap: seleção e rotação', () => {
  let element: HTMLElement
  let controller: PointerInputController
  let commands: InputCommand[]
  let hasGate: boolean

  beforeEach(() => {
    element = makeElement()
    commands = []
    hasGate = false
    controller = new PointerInputController({ cellAt, hasGateAt: () => hasGate })
    controller.onCommand((command) => commands.push(command))
    controller.attach(element)
  })

  function tap(coord: Coord): void {
    const { x, y } = coordCenter(coord)
    firePointer(element, 'pointerdown', { pointerId: 1, x, y })
    firePointer(element, 'pointerup', { pointerId: 1, x, y })
  }

  it('tap em célula vazia seleciona; segundo tap na mesma célula (ainda vazia) desseleciona', () => {
    expect(controller.getSelected()).toBeNull()
    tap({ x: 2, y: 1 })
    expect(controller.getSelected()).toEqual({ x: 2, y: 1 })
    expect(commands).toEqual([])

    tap({ x: 2, y: 1 })
    expect(controller.getSelected()).toBeNull()
    expect(commands).toEqual([])
  })

  it('tap em peça selecionada emite rotate e mantém a seleção', () => {
    tap({ x: 3, y: 2 })
    expect(controller.getSelected()).toEqual({ x: 3, y: 2 })

    hasGate = true
    tap({ x: 3, y: 2 })

    expect(commands).toEqual([{ type: 'rotate', coord: { x: 3, y: 2 } }])
    expect(controller.getSelected()).toEqual({ x: 3, y: 2 })
  })

  it('tap em outra célula troca a seleção sem emitir comando', () => {
    tap({ x: 1, y: 1 })
    tap({ x: 4, y: 4 })
    expect(controller.getSelected()).toEqual({ x: 4, y: 4 })
    expect(commands).toEqual([])
  })
})

describe('PointerInputController — pinch-zoom e pan', () => {
  let element: HTMLElement
  let controller: PointerInputController
  let commands: InputCommand[]

  beforeEach(() => {
    element = makeElement()
    commands = []
    controller = new PointerInputController({ cellAt, minZoom: 1, maxZoom: 4 })
    controller.onCommand((command) => commands.push(command))
    controller.attach(element)
  })

  it('dois ponteiros nunca disparam desenho, mesmo se um deles já estivesse arrastando', () => {
    firePointer(element, 'pointerdown', { pointerId: 1, x: 50, y: 70 })
    firePointer(element, 'pointermove', { pointerId: 1, x: 55, y: 70 })
    // Segundo dedo toca: vira gesto de câmera e cancela o arrasto pendente.
    firePointer(element, 'pointerdown', { pointerId: 2, x: 90, y: 70 })
    firePointer(element, 'pointermove', { pointerId: 1, x: 40, y: 70 })
    firePointer(element, 'pointermove', { pointerId: 2, x: 120, y: 70 })
    firePointer(element, 'pointerup', { pointerId: 1, x: 40, y: 70 })
    firePointer(element, 'pointerup', { pointerId: 2, x: 120, y: 70 })

    expect(commands).toEqual([])
  })

  it('pinch afasta os dedos e aumenta o zoom, sempre dentro dos limites', () => {
    expect(controller.getZoom()).toBe(1)

    firePointer(element, 'pointerdown', { pointerId: 1, x: 90, y: 70 })
    firePointer(element, 'pointerdown', { pointerId: 2, x: 110, y: 70 }) // distância inicial 20
    firePointer(element, 'pointermove', { pointerId: 1, x: 0, y: 70 })
    firePointer(element, 'pointermove', { pointerId: 2, x: 200, y: 70 }) // distância 200 → 10x

    expect(controller.getZoom()).toBe(4) // clamped ao maxZoom
    expect(commands).toEqual([])
  })

  it('setZoom aplica clamp aos limites configurados', () => {
    controller.setZoom(0.1)
    expect(controller.getZoom()).toBe(1)
    controller.setZoom(10)
    expect(controller.getZoom()).toBe(4)
    controller.setZoom(2.5)
    expect(controller.getZoom()).toBe(2.5)
  })
})
