/**
 * Renderizador Canvas 2D do tabuleiro (MI-08) — implementa `BoardRenderer`
 * (contrato MI-02). Canvas 2D único, DPR-aware (SDD §8.1); camadas lógicas
 * desenhadas na ordem grade → fixas → jogador → sinal → overlay (SDD §8.2);
 * repintura sob demanda com dirty flags, e `requestAnimationFrame` apenas
 * durante a animação de propagação (SDD §8.3); animação alimentada pelo traço
 * da simulação (SDD §4.7 → §8.4) com respeito a `prefers-reduced-motion`
 * (corte seco) (SDD §8.5).
 *
 * Fronteira desta tarefa: NÃO trata entrada (MI-09) e NÃO conhece Preact —
 * o HUD e o shell (MI-10/MI-15) consomem apenas a interface `BoardRenderer`.
 */

import type {
  Coord,
  IssueKind,
  SinkStatus,
} from '@circuit/core/model'
import { simulateWithTrace } from '@circuit/core/sim'
import type { BoardRenderer, RenderFrame } from '../app/contracts'
import type { BoardLayout } from './geometry'
import { computeBoardLayout, coordAt } from './geometry'
import {
  paintBackground,
  paintCells,
  paintIssueOverlay,
  paintSelection,
  type IssueDraw,
} from './painters'
import {
  buildSignalTimeline,
  pulseIntensity,
  signalTotalMs,
  type SignalTimeline,
} from './signal-animation'
import type { BoardTheme, IssuePalette } from './theme'
import { withTheme } from './theme'

/** Margem interna (px CSS) entre a borda do canvas e o grid. */
const BOARD_PADDING = 0

export interface MediaQueryListLike {
  readonly matches: boolean
}

export interface ResizeObserverEntryLike {
  readonly contentRect: { readonly width: number; readonly height: number }
}

export type ResizeObserverLike = new (
  callback: (entries: readonly ResizeObserverEntryLike[]) => void,
) => { observe(target: Element): void; disconnect(): void }

/**
 * Dependências injetáveis — a interface pública `BoardRenderer` não as expõe;
 * servem aos testes (jsdom não tem canvas real, rAF nem matchMedia) e à troca
 * de tema pelo shell (MI-10).
 */
export interface CanvasRendererOptions {
  readonly theme?: Partial<BoardTheme>
  readonly requestAnimationFrame?: (callback: (time: number) => void) => number
  readonly cancelAnimationFrame?: (handle: number) => void
  readonly matchMedia?: (query: string) => MediaQueryListLike
  /** `null` desliga o observer; omitir usa o `ResizeObserver` global (quando houver). */
  readonly ResizeObserver?: ResizeObserverLike | null
}

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function coordKey(x: number, y: number): string {
  return `${x},${y}`
}

function cellSortKey(coord: Coord): string {
  return `${coord.y}:${coord.x}`
}

function contentSignature(frame: RenderFrame): string {
  const fixed = [...frame.level.fixedCells]
    .sort((a, b) => cellSortKey(a.coord).localeCompare(cellSortKey(b.coord)))
    .map((item) => `${coordKey(item.coord.x, item.coord.y)}:${JSON.stringify(item.cell)}`)
  const placed = [...frame.board.placedCells]
    .sort((a, b) => cellSortKey(a.coord).localeCompare(cellSortKey(b.coord)))
    .map((item) => `${coordKey(item.coord.x, item.coord.y)}:${JSON.stringify(item.cell)}`)
  return JSON.stringify([frame.level.id, frame.level.grid, fixed, placed])
}

function issuesSignature(issues: readonly RenderFrame['issues'][number][]): string {
  return issues
    .map(
      (issue) =>
        `${issue.kind}:${[...issue.cells]
          .map((c) => coordKey(c.x, c.y))
          .sort()
          .join('|')}`,
    )
    .sort()
    .join(';')
}

function overlaySignature(frame: RenderFrame): string {
  const selected = frame.selected ? coordKey(frame.selected.x, frame.selected.y) : '-'
  return `${selected}|${issuesSignature(frame.issues)}`
}

function issuePaletteKey(kind: IssueKind): keyof IssuePalette {
  switch (kind) {
    case 'short':
      return 'short'
    case 'cycle':
      return 'cycle'
    case 'floating':
      return 'floating'
    case 'unpowered-gate':
      return 'unpowered'
  }
}

function toIssueDraw(issues: readonly RenderFrame['issues'][number][]): readonly IssueDraw[] {
  return issues.map((issue) => ({
    kind: issuePaletteKey(issue.kind),
    cells: issue.cells,
  }))
}

export class CanvasBoardRenderer implements BoardRenderer {
  private readonly theme: BoardTheme

  private container: HTMLElement | null = null
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private resizeObserver: { observe(target: Element): void; disconnect(): void } | null = null

  private cssWidth = 0
  private cssHeight = 0
  private dpr = 1
  private gridCols = 0
  private gridRows = 0
  private layout: BoardLayout | null = null

  private frame: RenderFrame | null = null
  private lastContentKey: string | null = null
  private lastOverlayKey: string | null = null
  private lastElectricalKey: string | null = null

  private timeline: SignalTimeline | null = null
  private activatedKeys: ReadonlySet<string> = new Set<string>()
  private sinkStatusByKey: ReadonlyMap<string, SinkStatus> = new Map<string, SinkStatus>()

  /** Token de animação — frames atrasados de uma rodada cancelada são ignorados. */
  private animToken = 0
  private rafHandle: number | null = null
  private animStartTime: number | null = null

  constructor(options: CanvasRendererOptions = {}) {
    this.opts = options
    this.theme = withTheme(options.theme)
  }

  // -------------------------------------------------------------------------
  // Ciclo de vida
  // -------------------------------------------------------------------------

  mount(container: HTMLElement): void {
    if (this.container === container && this.canvas !== null) return
    this.unmount()

    const canvas = document.createElement('canvas')
    canvas.style.display = 'block'
    canvas.style.touchAction = 'none'
    container.appendChild(canvas)

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('CanvasBoardRenderer: Canvas 2D indisponível')

    this.container = container
    this.canvas = canvas
    this.ctx = ctx

    const observerCtor = this.resolveResizeObserver()
    if (observerCtor) {
      this.resizeObserver = new observerCtor((entries) => {
        const entry = entries[0]
        if (!entry) return
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          this.resize(width, height, this.dpr)
        }
      })
      this.resizeObserver.observe(container)
    }

    // Se um frame já foi renderizado antes do mount (app guarda estado), pinta.
    if (this.frame) this.render(this.frame)
  }

  unmount(): void {
    this.stopAnimation()
    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
      this.resizeObserver = null
    }
    if (this.canvas) {
      this.canvas.remove()
      this.canvas = null
    }
    this.ctx = null
    this.container = null
    this.layout = null
    this.frame = null
    this.lastContentKey = null
    this.lastOverlayKey = null
    this.lastElectricalKey = null
    this.timeline = null
    this.activatedKeys = new Set<string>()
    this.sinkStatusByKey = new Map<string, SinkStatus>()
  }

  resize(widthPx: number, heightPx: number, devicePixelRatio: number): void {
    const width = Math.max(0, widthPx)
    const height = Math.max(0, heightPx)
    const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1
    this.cssWidth = width
    this.cssHeight = height
    this.dpr = dpr

    if (this.canvas) {
      this.canvas.width = Math.max(1, Math.round(width * dpr))
      this.canvas.height = Math.max(1, Math.round(height * dpr))
      this.canvas.style.width = `${width}px`
      this.canvas.style.height = `${height}px`
    }
    this.recomputeLayout()
    this.paintStatic()
  }

  // -------------------------------------------------------------------------
  // BoardRenderer
  // -------------------------------------------------------------------------

  render(frame: RenderFrame): void {
    this.frame = frame
    if (!this.container || !this.canvas) return

    const grid = frame.level.grid
    if (grid.width !== this.gridCols || grid.height !== this.gridRows) {
      this.gridCols = grid.width
      this.gridRows = grid.height
      this.recomputeLayout()
    }

    let needsPaint = false

    const contentKey = contentSignature(frame)
    if (contentKey !== this.lastContentKey) {
      this.lastContentKey = contentKey
      this.ingestSimulation(frame)
      needsPaint = true
    }

    const overlayKey = overlaySignature(frame)
    if (overlayKey !== this.lastOverlayKey) {
      this.lastOverlayKey = overlayKey
      needsPaint = true
    }

    if (needsPaint) this.paintStatic()
  }

  cellAt(xPx: number, yPx: number): Coord | null {
    if (!this.layout) return null
    return coordAt(this.layout, xPx, yPx)
  }

  // -------------------------------------------------------------------------
  // Animação de propagação
  // -------------------------------------------------------------------------

  /**
   * Roda a simulação (com traço) do conteúdo atual e decide se a propagação
   * deve ser animada. Dirty-flag por assinatura: conteúdo idêntico ao último
   * frame não reanima nem re-simula.
   */
  private ingestSimulation(frame: RenderFrame): void {
    const { trace, result } = simulateWithTrace(frame.level, frame.board, { trace: true })
    this.sinkStatusByKey = new Map(
      result.sinks.map((sink) => [coordKey(sink.coord.x, sink.coord.y), sink]),
    )
    this.timeline = buildSignalTimeline(trace)
    this.activatedKeys = this.timeline.activatedKeys

    const electricalKey = this.electricalKey(this.timeline, frame.issues)
    const shouldAnimate =
      this.timeline.stepCount > 0 && electricalKey !== this.lastElectricalKey
    this.lastElectricalKey = electricalKey

    if (shouldAnimate && !this.isReducedMotion()) {
      this.startAnimation()
    } else {
      // Sem traço (nada a propagar), estado elétrico idêntico ou corte seco
      // (prefers-reduced-motion): cancela qualquer rodada anterior — o
      // paintStatic seguinte desenha o estado final energizado sem nenhum
      // frame agendado.
      this.stopAnimation()
    }
  }

  private electricalKey(
    timeline: SignalTimeline,
    issues: readonly RenderFrame['issues'][number][],
  ): string {
    const activated = [...timeline.activatedKeys].sort().join(';')
    const sinks = [...this.sinkStatusByKey.values()]
      .sort((a, b) => cellSortKey(a.coord).localeCompare(cellSortKey(b.coord)))
      .map((sink) => `${coordKey(sink.coord.x, sink.coord.y)}:${sink.satisfied ? 1 : 0}`)
      .join(';')
    return `${activated}|${sinks}|${issuesSignature(issues)}`
  }

  private startAnimation(): void {
    this.stopAnimation()
    const raf = this.resolveRaf()
    if (!raf) {
      // Ambiente sem requestAnimationFrame: corte seco (o paintStatic do
      // render() desenha o estado final).
      return
    }
    this.animStartTime = null
    const token = ++this.animToken
    this.rafHandle = raf((time) => this.onAnimationFrame(time, token))
  }

  private onAnimationFrame(time: number, token: number): void {
    if (token !== this.animToken) return // rodada cancelada/sobrescrita
    this.rafHandle = null

    // Preferência pode mudar em runtime — re-checa a cada frame.
    if (this.isReducedMotion()) {
      this.stopAnimation()
      this.paintStatic()
      return
    }
    const timeline = this.timeline
    if (!timeline || timeline.stepCount === 0) {
      this.stopAnimation()
      this.paintStatic()
      return
    }
    if (this.animStartTime === null) this.animStartTime = time
    const elapsed = time - this.animStartTime
    if (elapsed >= signalTotalMs(timeline)) {
      this.stopAnimation()
      this.paintStatic()
      return
    }
    this.paintAnimated(timeline, elapsed)
    const raf = this.resolveRaf()
    if (raf) this.rafHandle = raf((next) => this.onAnimationFrame(next, token))
  }

  private stopAnimation(): void {
    this.animToken++
    if (this.rafHandle !== null) {
      const caf = this.resolveCaf()
      if (caf) caf(this.rafHandle)
      this.rafHandle = null
    }
    this.animStartTime = null
  }

  // -------------------------------------------------------------------------
  // Pintura
  // -------------------------------------------------------------------------

  private recomputeLayout(): void {
    if (this.cssWidth <= 0 || this.cssHeight <= 0 || this.gridCols <= 0 || this.gridRows <= 0) {
      this.layout = null
      return
    }
    this.layout = computeBoardLayout(
      this.cssWidth,
      this.cssHeight,
      this.gridCols,
      this.gridRows,
      BOARD_PADDING,
    )
  }

  /** Estado final energizado — pintura sob demanda (dirty flag), sem animação. */
  private paintStatic(): void {
    if (this.rafHandle !== null) return // um frame animado vem aí
    this.paint(null)
  }

  private paintAnimated(timeline: SignalTimeline, elapsed: number): void {
    this.paint(elapsed, (key) => {
      const step = timeline.activationByKey.get(key)
      return step === undefined ? 0 : pulseIntensity(elapsed, step)
    })
  }

  private paint(
    elapsed: number | null,
    intensityFor: ((key: string) => number) | undefined = undefined,
  ): void {
    const ctx = this.ctx
    const layout = this.layout
    const frame = this.frame
    if (!ctx || !layout || !frame) return

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.globalAlpha = 1
    ctx.shadowBlur = 0
    ctx.clearRect(0, 0, this.cssWidth, this.cssHeight)

    paintBackground(ctx, this.cssWidth, this.cssHeight, layout, this.theme)

    // Camada de sinal: sem `intensityFor` (pintura estática) as células
    // energizadas ficam acesas em intensidade cheia; com ele, o pulso percorre
    // o traço conforme o relógio da animação.
    const signal =
      this.activatedKeys.size === 0
        ? undefined
        : { energizedKeys: this.activatedKeys, intensityFor: elapsed === null ? undefined : intensityFor }

    paintCells(
      ctx,
      layout,
      this.theme,
      frame.level,
      frame.board.placedCells,
      this.sinkStatusByKey,
      signal,
    )

    paintIssueOverlay(ctx, layout, this.theme, toIssueDraw(frame.issues))
    paintSelection(ctx, layout, this.theme, frame.selected)

    ctx.globalAlpha = 1
    ctx.shadowBlur = 0
  }

  // -------------------------------------------------------------------------
  // Infraestrutura
  // -------------------------------------------------------------------------

  private resolveResizeObserver(): ResizeObserverLike | null {
    if (this.opts.ResizeObserver !== undefined) return this.opts.ResizeObserver
    if (typeof ResizeObserver === 'undefined') return null
    return ResizeObserver as unknown as ResizeObserverLike
  }

  private isReducedMotion(): boolean {
    const query = this.opts.matchMedia ?? defaultMatchMedia
    return query(REDUCED_MOTION_QUERY).matches
  }

  private resolveRaf(): ((callback: (time: number) => void) => number) | undefined {
    if (this.opts.requestAnimationFrame) return this.opts.requestAnimationFrame
    if (typeof requestAnimationFrame === 'function') {
      return requestAnimationFrame.bind(globalThis)
    }
    return undefined
  }

  private resolveCaf(): ((handle: number) => void) | undefined {
    if (this.opts.cancelAnimationFrame) return this.opts.cancelAnimationFrame
    if (typeof cancelAnimationFrame === 'function') {
      return cancelAnimationFrame.bind(globalThis)
    }
    return undefined
  }

  private readonly opts: CanvasRendererOptions
}

function defaultMatchMedia(query: string): MediaQueryListLike {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia(query)
  }
  return { matches: false }
}
