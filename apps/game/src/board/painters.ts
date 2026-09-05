/**
 * Pintores de células — funções puras sobre `CanvasRenderingContext2D`.
 * Camadas lógicas do SDD §8.2: grade → células fixas → peças do jogador →
 * sinal → overlay. Nenhuma função conhece o DOM nem o estado do renderizador:
 * recebem contexto, layout, tema e o que desenhar.
 */

import type {
  Cell,
  Coord,
  Direction,
  GateCell,
  LevelSpec,
  PlacedCell,
  SinkStatus,
  SourceCell,
} from '@circuit/core/model'
import type { BoardLayout } from './geometry'
import { cellRect } from './geometry'
import type { BoardTheme, IssuePalette } from './theme'
import { valueColor } from './theme'

type Ctx = CanvasRenderingContext2D

function text(
  ctx: Ctx,
  value: string,
  x: number,
  y: number,
  sizePx: number,
  color: string,
): void {
  ctx.fillStyle = color
  ctx.font = `600 ${Math.max(6, Math.round(sizePx))}px system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(value, x, y)
}

/** Caminho de retângulo arredondado (sem depender de `roundRect`, ainda não universal). */
function roundRectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.arc(x + w - radius, y + radius, radius, -Math.PI / 2, 0)
  ctx.lineTo(x + w, y + h - radius)
  ctx.arc(x + w - radius, y + h - radius, radius, 0, Math.PI / 2)
  ctx.lineTo(x + radius, y + h)
  ctx.arc(x + radius, y + h - radius, radius, Math.PI / 2, Math.PI)
  ctx.lineTo(x, y + radius)
  ctx.arc(x + radius, y + radius, radius, Math.PI, Math.PI * 1.5)
  ctx.closePath()
}

export function fillRoundRect(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  color: string,
): void {
  roundRectPath(ctx, x, y, w, h, r)
  ctx.fillStyle = color
  ctx.fill()
}

export function strokeRoundRect(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  color: string,
  lineWidth: number,
): void {
  roundRectPath(ctx, x, y, w, h, r)
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.stroke()
}

interface RectLike {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

function edgeMidpoint(rect: RectLike, side: Direction): { x: number; y: number } {
  switch (side) {
    case 'N':
      return { x: rect.x + rect.w / 2, y: rect.y }
    case 'S':
      return { x: rect.x + rect.w / 2, y: rect.y + rect.h }
    case 'E':
      return { x: rect.x + rect.w, y: rect.y + rect.h / 2 }
    case 'W':
      return { x: rect.x, y: rect.y + rect.h / 2 }
  }
}

/**
 * Puxa um traço do centro da célula até a borda no lado `side`, partindo de
 * `inset` (fração do raio da célula) — usado para conectar peças ao grid.
 */
function lineToEdge(
  ctx: Ctx,
  rect: RectLike,
  side: Direction,
  inset: number,
  color: string,
  width: number,
): void {
  const cx = rect.x + rect.w / 2
  const cy = rect.y + rect.h / 2
  const out = edgeMidpoint(rect, side)
  ctx.beginPath()
  ctx.moveTo(cx + (out.x - cx) * (1 - inset), cy + (out.y - cy) * (1 - inset))
  ctx.lineTo(out.x, out.y)
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.stroke()
}

// ---------------------------------------------------------------------------
// Peças
// ---------------------------------------------------------------------------

export function paintSource(
  ctx: Ctx,
  rect: RectLike,
  cell: SourceCell,
  theme: BoardTheme,
): void {
  const cx = rect.x + rect.w / 2
  const cy = rect.y + rect.h / 2
  const color = valueColor(theme, cell.value)
  lineToEdge(ctx, rect, cell.outputSide, 0.5, color, Math.max(2, rect.w * 0.16))
  const radius = rect.w * 0.26
  ctx.save()
  ctx.shadowColor = color
  ctx.shadowBlur = rect.w * 0.35
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.fillStyle = theme.chipFill
  ctx.fill()
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(1.5, rect.w * 0.08)
  ctx.stroke()
  ctx.restore()
  text(ctx, String(cell.value), cx, cy, rect.w * 0.34, color)
}

export function paintSink(
  ctx: Ctx,
  rect: RectLike,
  expected: 0 | 1,
  inputSide: Direction,
  status: SinkStatus | undefined,
  theme: BoardTheme,
): void {
  const cx = rect.x + rect.w / 2
  const cy = rect.y + rect.h / 2
  lineToEdge(ctx, rect, inputSide, 0.5, theme.wireIdle, Math.max(2, rect.w * 0.14))
  const radius = rect.w * 0.26
  const satisfied = status !== undefined && status.satisfied
  const ring = satisfied ? theme.sinkSatisfied : theme.sinkRing
  ctx.save()
  if (satisfied) {
    ctx.shadowColor = theme.sinkSatisfied
    ctx.shadowBlur = rect.w * 0.45
  }
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.strokeStyle = ring
  ctx.lineWidth = Math.max(2, rect.w * 0.09)
  ctx.stroke()
  ctx.restore()
  text(ctx, String(expected), cx, cy, rect.w * 0.34, satisfied ? theme.sinkSatisfied : theme.text)
}

export function paintGate(
  ctx: Ctx,
  rect: RectLike,
  cell: GateCell,
  theme: BoardTheme,
): void {
  const cx = rect.x + rect.w / 2
  const cy = rect.y + rect.h / 2
  const inset = rect.w * 0.2
  const bodyX = rect.x + inset
  const bodyY = rect.y + inset
  const bodyW = rect.w - inset * 2
  const bodyH = rect.h - inset * 2

  // Entradas: stubs finos até a borda. Saída: stub grosso + seta.
  for (const side of cell.inputSides) {
    lineToEdge(ctx, rect, side, 0.2, theme.chipStroke, Math.max(1.5, rect.w * 0.1))
  }
  const out = edgeMidpoint(rect, cell.outputSide)
  ctx.beginPath()
  ctx.moveTo(cx + (out.x - cx) * 0.6, cy + (out.y - cy) * 0.6)
  ctx.lineTo(out.x, out.y)
  ctx.strokeStyle = theme.gateOutput
  ctx.lineWidth = Math.max(2, rect.w * 0.16)
  ctx.stroke()
  // Seta apontando para fora, na borda de saída.
  const tail = { x: cx + (out.x - cx) * 0.52, y: cy + (out.y - cy) * 0.52 }
  const wing = rect.w * 0.13
  const perp =
    cell.outputSide === 'N' || cell.outputSide === 'S'
      ? { dx: wing, dy: 0 }
      : { dx: 0, dy: wing }
  ctx.beginPath()
  ctx.moveTo(out.x, out.y)
  ctx.lineTo(tail.x + perp.dx, tail.y + perp.dy)
  ctx.lineTo(tail.x - perp.dx, tail.y - perp.dy)
  ctx.closePath()
  ctx.fillStyle = theme.gateOutput
  ctx.fill()

  fillRoundRect(ctx, bodyX, bodyY, bodyW, bodyH, bodyW * 0.22, theme.chipFill)
  strokeRoundRect(ctx, bodyX, bodyY, bodyW, bodyH, bodyW * 0.22, theme.chipStroke, Math.max(1, rect.w * 0.05))
  text(ctx, cell.gate, cx, cy, bodyH * 0.42, theme.text)
}

/** Fio: segmento centro→borda em cada lado declarado + nó central. */
export function paintWire(
  ctx: Ctx,
  rect: RectLike,
  sides: readonly Direction[],
  color: string,
  alpha: number,
  glowBlur: number,
): void {
  const cx = rect.x + rect.w / 2
  const cy = rect.y + rect.h / 2
  const width = Math.max(2, rect.w * 0.28)
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'butt'
  ctx.lineJoin = 'round'
  if (glowBlur > 0) {
    ctx.shadowColor = color
    ctx.shadowBlur = glowBlur
  }
  ctx.beginPath()
  for (const side of sides) {
    const out = edgeMidpoint(rect, side)
    ctx.moveTo(cx, cy)
    ctx.lineTo(out.x, out.y)
  }
  ctx.stroke()
  // Nó central: funde os segmentos em curvas/T/cruzamento sem buraco no canto.
  ctx.beginPath()
  ctx.arc(cx, cy, width / 2 + 0.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

// ---------------------------------------------------------------------------
// Camadas 0–2 (grade, células fixas, peças do jogador)
// ---------------------------------------------------------------------------

export function paintBackground(
  ctx: Ctx,
  cssWidth: number,
  cssHeight: number,
  layout: BoardLayout,
  theme: BoardTheme,
): void {
  ctx.fillStyle = theme.background
  ctx.fillRect(0, 0, cssWidth, cssHeight)

  const gridW = layout.cellSize * layout.cols
  const gridH = layout.cellSize * layout.rows
  ctx.strokeStyle = theme.gridLine
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let x = 0; x <= layout.cols; x++) {
    const px = layout.originX + x * layout.cellSize
    ctx.moveTo(px + 0.5, layout.originY)
    ctx.lineTo(px + 0.5, layout.originY + gridH)
  }
  for (let y = 0; y <= layout.rows; y++) {
    const py = layout.originY + y * layout.cellSize
    ctx.moveTo(layout.originX, py + 0.5)
    ctx.lineTo(layout.originX + gridW, py + 0.5)
  }
  ctx.stroke()

  strokeRoundRect(ctx, layout.originX, layout.originY, gridW, gridH, 2, theme.boardFrame, 1)
}

export interface SignalDrawState {
  /** Células que receberam sinal (chave "x,y"). */
  readonly energizedKeys: ReadonlySet<string>
  /** Intensidade do pulso [0..1] de cada célula neste instante. */
  readonly intensityFor?: (key: string) => number
}

function coordKey(x: number, y: number): string {
  return `${x},${y}`
}

function paintCell(
  ctx: Ctx,
  layout: BoardLayout,
  theme: BoardTheme,
  cell: Cell,
  x: number,
  y: number,
  sinkStatusByKey: ReadonlyMap<string, SinkStatus>,
  signal?: SignalDrawState,
): void {
  const rect = cellRect(layout, x, y)
  const key = coordKey(x, y)
  switch (cell.kind) {
    case 'empty':
      return
    case 'source':
      paintSource(ctx, rect, cell, theme)
      return
    case 'sink':
      paintSink(ctx, rect, cell.expected, cell.inputSide, sinkStatusByKey.get(key), theme)
      return
    case 'gate':
      paintGate(ctx, rect, cell, theme)
      return
    case 'wire': {
      const energized = signal !== undefined && signal.energizedKeys.has(key)
      if (energized) {
        const animated = signal.intensityFor !== undefined
        const intensity = signal.intensityFor ? signal.intensityFor(key) : 1
        if (intensity <= 0) {
          // Ainda não recebeu o sinal nesta rodada: fica na cor ociosa.
          paintWire(ctx, rect, cell.sides, theme.wireIdle, 1, 0)
        } else if (animated) {
          // Pulso viajante: brilho ciano forte que acende e decai.
          paintWire(
            ctx,
            rect,
            cell.sides,
            theme.signal.pulse,
            0.3 + 0.7 * intensity,
            rect.w * 0.8 * intensity,
          )
        } else {
          // Estado final energizado (corte seco / fim da animação): aceso e
          // levemente brilhante, sem o pulso.
          paintWire(ctx, rect, cell.sides, theme.wireEnergized, 0.75, rect.w * 0.35)
        }
      } else {
        paintWire(ctx, rect, cell.sides, theme.wireIdle, 1, 0)
      }
      return
    }
  }
}

function cellOrder(a: Coord, b: Coord): number {
  return a.y - b.y || a.x - b.x
}

/** Camadas 1+2: células fixas do nível e, depois, peças do jogador. */
export function paintCells(
  ctx: Ctx,
  layout: BoardLayout,
  theme: BoardTheme,
  level: LevelSpec,
  placedCells: readonly PlacedCell[],
  sinkStatusByKey: ReadonlyMap<string, SinkStatus>,
  signal?: SignalDrawState,
): void {
  const fixed = [...level.fixedCells].sort((a, b) => cellOrder(a.coord, b.coord))
  for (const item of fixed) {
    paintCell(ctx, layout, theme, item.cell, item.coord.x, item.coord.y, sinkStatusByKey, signal)
  }
  const placed = [...placedCells].sort((a, b) => cellOrder(a.coord, b.coord))
  for (const item of placed) {
    paintCell(ctx, layout, theme, item.cell, item.coord.x, item.coord.y, sinkStatusByKey, signal)
  }
}

// ---------------------------------------------------------------------------
// Camada 4: overlay (diagnósticos + seleção)
// ---------------------------------------------------------------------------

function paintIssueCell(
  ctx: Ctx,
  layout: BoardLayout,
  theme: BoardTheme,
  kind: keyof IssuePalette,
  coord: Coord,
): void {
  const rect = cellRect(layout, coord.x, coord.y)
  const color = theme.issue[kind]
  const inset = rect.w * 0.08
  roundRectPath(ctx, rect.x + inset, rect.y + inset, rect.w - inset * 2, rect.h - inset * 2, rect.w * 0.16)
  ctx.save()
  ctx.globalAlpha = 0.16
  ctx.fillStyle = color
  ctx.fill()
  ctx.restore()
  ctx.save()
  ctx.shadowColor = color
  ctx.shadowBlur = rect.w * 0.45
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(1.5, rect.w * 0.06)
  ctx.stroke()
  ctx.restore()
}

export interface IssueDraw {
  readonly kind: keyof IssuePalette
  readonly cells: readonly Coord[]
}

/**
 * Overlay de diagnóstico: agrega as células de todos os issues do frame.
 * Quando a mesma célula aparece em issues diferentes, o último vence a cor.
 */
export function paintIssueOverlay(
  ctx: Ctx,
  layout: BoardLayout,
  theme: BoardTheme,
  issues: readonly IssueDraw[],
): void {
  const byKey = new Map<string, { kind: keyof IssuePalette; coord: Coord }>()
  for (const issue of issues) {
    for (const coord of issue.cells) {
      byKey.set(coordKey(coord.x, coord.y), { kind: issue.kind, coord })
    }
  }
  for (const entry of byKey.values()) {
    paintIssueCell(ctx, layout, theme, entry.kind, entry.coord)
  }
}

/** Destaque da célula selecionada. */
export function paintSelection(
  ctx: Ctx,
  layout: BoardLayout,
  theme: BoardTheme,
  selected: Coord | null,
): void {
  if (!selected) return
  const rect = cellRect(layout, selected.x, selected.y)
  const inset = rect.w * 0.1
  ctx.save()
  ctx.shadowColor = theme.selected
  ctx.shadowBlur = rect.w * 0.5
  strokeRoundRect(
    ctx,
    rect.x + inset,
    rect.y + inset,
    rect.w - inset * 2,
    rect.h - inset * 2,
    rect.w * 0.2,
    theme.selected,
    Math.max(2, rect.w * 0.09),
  )
  ctx.restore()
}
