/**
 * `InputController` (contrato MI-02, `apps/game/src/app/contracts.ts`) sobre
 * Pointer Events — unifica dedo, caneta e mouse (SDD §7.4). Nunca muta
 * `BoardState`: só emite `InputCommand`s que o ponto de composição (MI-15)
 * traduz em comandos do `LevelEditor` (`packages/core/src/state`).
 *
 * A conversão pixel→célula não é reimplementada aqui: quem monta o controller
 * injeta `cellAt`, tipicamente `BoardRenderer.cellAt` (MI-08), garantindo que
 * entrada e desenho compartilhem exatamente o mesmo layout de grid.
 *
 * "Sair do canvas" é detectado por geometria (posição do ponteiro contra o
 * retângulo do elemento), nunca por `pointerenter`/`pointerleave` — que não
 * disparam de forma confiável para um ponteiro capturado (`setPointerCapture`)
 * fora dos limites do elemento.
 */

import type { Coord } from '@circuit/core/model'
import type { InputCommand, InputController } from '../app/contracts'
import { coordsEqual, orthogonalBridge } from './path'
import {
  clampPan,
  clampZoom,
  DEFAULT_MAX_ZOOM,
  DEFAULT_MIN_ZOOM,
  distance,
  midpoint,
  type PanOffset,
  type ViewportPoint,
} from './viewport'

/** Intensidade curta de vibração (ms) — traço avançando célula a célula. */
const HAPTIC_STEP_MS = 8
/** Intensidade de vibração ao rotacionar uma peça por toque. */
const HAPTIC_ROTATE_MS = 15

export interface ViewportState {
  readonly zoom: number
  readonly pan: PanOffset
}

export interface PointerInputControllerOptions {
  /** Converte um ponto em px CSS do elemento anexado para uma célula do grid. */
  readonly cellAt: (xPx: number, yPx: number) => Coord | null
  /** Diz se a célula tem uma peça rotacionável — usada para decidir tap vs. seleção. */
  readonly hasGateAt?: (coord: Coord) => boolean
  readonly minZoom?: number
  readonly maxZoom?: number
  /** Injeção para testes; por padrão usa `navigator.vibrate` quando disponível. */
  readonly vibrate?: (pattern: number | readonly number[]) => boolean
}

function defaultVibrate(pattern: number | readonly number[]): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false
  return navigator.vibrate(pattern as number | number[])
}

type CaptureCapableElement = HTMLElement & {
  setPointerCapture?: (pointerId: number) => void
  releasePointerCapture?: (pointerId: number) => void
}

export class PointerInputController implements InputController {
  private readonly opts: PointerInputControllerOptions
  private readonly minZoom: number
  private readonly maxZoom: number

  private element: HTMLElement | null = null

  private readonly commandListeners = new Set<(command: InputCommand) => void>()
  private readonly selectionListeners = new Set<(coord: Coord | null) => void>()
  private readonly viewportListeners = new Set<(viewport: ViewportState) => void>()

  private selected: Coord | null = null
  private zoom = 1
  private pan: PanOffset = { x: 0, y: 0 }

  /** Ponteiro único desenhando o traço atual; `null` fora de um gesto de arrasto. */
  private drawPointerId: number | null = null
  private path: Coord[] = []

  private readonly activePointers = new Map<number, ViewportPoint>()
  private pinchStartDistance: number | null = null
  private pinchStartMidpoint: ViewportPoint | null = null
  private pinchStartZoom = 1
  private pinchStartPan: PanOffset = { x: 0, y: 0 }

  constructor(options: PointerInputControllerOptions) {
    this.opts = options
    this.minZoom = options.minZoom ?? DEFAULT_MIN_ZOOM
    this.maxZoom = options.maxZoom ?? DEFAULT_MAX_ZOOM
    this.zoom = this.minZoom
  }

  // -------------------------------------------------------------------------
  // InputController
  // -------------------------------------------------------------------------

  attach(element: HTMLElement): void {
    this.detach()
    this.element = element
    element.style.touchAction = 'none'
    element.addEventListener('pointerdown', this.handlePointerDown)
    element.addEventListener('pointermove', this.handlePointerMove)
    element.addEventListener('pointerup', this.handlePointerUp)
    element.addEventListener('pointercancel', this.handlePointerCancel)
  }

  detach(): void {
    if (!this.element) return
    this.element.removeEventListener('pointerdown', this.handlePointerDown)
    this.element.removeEventListener('pointermove', this.handlePointerMove)
    this.element.removeEventListener('pointerup', this.handlePointerUp)
    this.element.removeEventListener('pointercancel', this.handlePointerCancel)
    this.element = null
    this.resetDraw()
    this.activePointers.clear()
    this.resetPinch()
  }

  onCommand(listener: (command: InputCommand) => void): () => void {
    this.commandListeners.add(listener)
    return () => this.commandListeners.delete(listener)
  }

  setZoom(scale: number): void {
    this.zoom = clampZoom(scale, this.minZoom, this.maxZoom)
    this.pan = clampPan(this.pan, this.elementWidth(), this.elementHeight(), this.zoom)
    this.notifyViewport()
  }

  // -------------------------------------------------------------------------
  // Observação (fora do contrato — consumida pelo ponto de composição MI-15
  // para refletir seleção/viewport na UI, sem que este módulo conheça Preact).
  // -------------------------------------------------------------------------

  getSelected(): Coord | null {
    return this.selected
  }

  onSelectionChange(listener: (coord: Coord | null) => void): () => void {
    this.selectionListeners.add(listener)
    return () => this.selectionListeners.delete(listener)
  }

  getZoom(): number {
    return this.zoom
  }

  onViewportChange(listener: (viewport: ViewportState) => void): () => void {
    this.viewportListeners.add(listener)
    return () => this.viewportListeners.delete(listener)
  }

  // -------------------------------------------------------------------------
  // Pointer events
  // -------------------------------------------------------------------------

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (!this.element) return
    if (event.pointerType === 'mouse' && event.button !== 0) return

    this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    this.capture(event.pointerId)

    if (this.activePointers.size >= 2) {
      this.resetDraw()
      this.beginPinch()
      return
    }

    const local = this.localPoint(event)
    const coord = this.opts.cellAt(local.x, local.y)
    this.drawPointerId = event.pointerId
    this.path = []
    if (coord) this.appendCoord(coord)
  }

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (!this.element) return
    if (this.activePointers.has(event.pointerId)) {
      this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    }

    if (this.activePointers.size >= 2) {
      this.updatePinch()
      return
    }

    if (this.drawPointerId !== event.pointerId) return

    const local = this.localPoint(event)
    if (!this.isInsideElement(local)) {
      this.endDrawAtBoundary()
      return
    }
    const coord = this.opts.cellAt(local.x, local.y)
    if (coord) this.appendCoord(coord)
  }

  private readonly handlePointerUp = (event: PointerEvent): void => {
    this.release(event.pointerId)
    this.activePointers.delete(event.pointerId)
    if (this.activePointers.size < 2) this.resetPinch()

    if (this.drawPointerId === event.pointerId) this.finishDraw()
  }

  private readonly handlePointerCancel = (event: PointerEvent): void => {
    this.release(event.pointerId)
    this.activePointers.delete(event.pointerId)
    if (this.activePointers.size < 2) this.resetPinch()

    if (this.drawPointerId === event.pointerId) this.resetDraw()
  }

  // -------------------------------------------------------------------------
  // Traço de arrasto
  // -------------------------------------------------------------------------

  private appendCoord(coord: Coord): void {
    const last = this.path[this.path.length - 1]
    if (!last) {
      this.path = [coord]
      this.maybeVibrate(HAPTIC_STEP_MS)
      return
    }
    if (coordsEqual(last, coord)) return
    this.path.push(...orthogonalBridge(last, coord))
    this.maybeVibrate(HAPTIC_STEP_MS)
  }

  /** Fim natural do gesto (pointerup): traço de 1 célula é um tap, não um arrasto. */
  private finishDraw(): void {
    const path = this.path
    this.drawPointerId = null
    this.path = []
    if (path.length === 0) return
    const first = path[0]
    if (path.length === 1 && first) {
      this.handleTap(first)
      return
    }
    this.emitCommand({ type: 'drag-path', path })
  }

  /**
   * Ponteiro saiu dos limites do elemento: encerra o traço sem deixar célula
   * pendente. Um arrasto real (2+ células) é preservado; um clique nascente
   * (0 ou 1 célula) é descartado — nunca vira tap nem rotação.
   */
  private endDrawAtBoundary(): void {
    const path = this.path
    this.drawPointerId = null
    this.path = []
    if (path.length > 1) this.emitCommand({ type: 'drag-path', path })
  }

  private resetDraw(): void {
    this.drawPointerId = null
    this.path = []
  }

  private handleTap(coord: Coord): void {
    if (this.selected && coordsEqual(this.selected, coord)) {
      if (this.opts.hasGateAt?.(coord)) {
        this.emitCommand({ type: 'rotate', coord })
        this.maybeVibrate(HAPTIC_ROTATE_MS)
      } else {
        this.setSelected(null)
      }
      return
    }
    this.setSelected(coord)
  }

  private setSelected(coord: Coord | null): void {
    if (this.selected === coord) return
    if (this.selected && coord && coordsEqual(this.selected, coord)) return
    this.selected = coord
    for (const listener of this.selectionListeners) listener(coord)
  }

  // -------------------------------------------------------------------------
  // Pinch-zoom e pan
  // -------------------------------------------------------------------------

  private beginPinch(): void {
    const points = [...this.activePointers.values()]
    const a = points[0]
    const b = points[1]
    if (!a || !b) return
    this.pinchStartDistance = distance(a, b)
    this.pinchStartMidpoint = midpoint(a, b)
    this.pinchStartZoom = this.zoom
    this.pinchStartPan = this.pan
  }

  private updatePinch(): void {
    const points = [...this.activePointers.values()]
    const a = points[0]
    const b = points[1]
    if (!a || !b) return
    if (this.pinchStartDistance === null || !this.pinchStartMidpoint) {
      this.beginPinch()
      return
    }
    if (this.pinchStartDistance <= 0) return

    const ratio = distance(a, b) / this.pinchStartDistance
    const nextZoom = clampZoom(this.pinchStartZoom * ratio, this.minZoom, this.maxZoom)

    const mid = midpoint(a, b)
    const deltaX = mid.x - this.pinchStartMidpoint.x
    const deltaY = mid.y - this.pinchStartMidpoint.y
    const nextPan = clampPan(
      { x: this.pinchStartPan.x + deltaX, y: this.pinchStartPan.y + deltaY },
      this.elementWidth(),
      this.elementHeight(),
      nextZoom,
    )

    this.zoom = nextZoom
    this.pan = nextPan
    this.notifyViewport()
  }

  private resetPinch(): void {
    this.pinchStartDistance = null
    this.pinchStartMidpoint = null
  }

  private notifyViewport(): void {
    const viewport: ViewportState = { zoom: this.zoom, pan: this.pan }
    for (const listener of this.viewportListeners) listener(viewport)
  }

  // -------------------------------------------------------------------------
  // Infraestrutura
  // -------------------------------------------------------------------------

  private emitCommand(command: InputCommand): void {
    for (const listener of this.commandListeners) listener(command)
  }

  private localPoint(event: PointerEvent): ViewportPoint {
    const rect = this.element?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  private isInsideElement(point: ViewportPoint): boolean {
    const rect = this.element?.getBoundingClientRect()
    if (!rect) return false
    return point.x >= 0 && point.x <= rect.width && point.y >= 0 && point.y <= rect.height
  }

  private elementWidth(): number {
    return this.element?.getBoundingClientRect().width ?? 0
  }

  private elementHeight(): number {
    return this.element?.getBoundingClientRect().height ?? 0
  }

  private capture(pointerId: number): void {
    const el = this.element as CaptureCapableElement | null
    try {
      el?.setPointerCapture?.(pointerId)
    } catch {
      // Sem suporte a pointer capture (ex.: jsdom) — o clamp por geometria
      // no pointermove ainda garante o encerramento limpo do traço.
    }
  }

  private release(pointerId: number): void {
    const el = this.element as CaptureCapableElement | null
    try {
      el?.releasePointerCapture?.(pointerId)
    } catch {
      // Idem — liberar captura é best-effort.
    }
  }

  private maybeVibrate(pattern: number): void {
    const vibrate = this.opts.vibrate ?? defaultVibrate
    try {
      vibrate(pattern)
    } catch {
      // Haptics é opcional (SDD §7.5) — falha nunca interrompe a entrada.
    }
  }
}
