/**
 * Geometria célula↔pixel do tabuleiro (SDD §8.1). Funções puras, sem DOM:
 * o layout do grid é derivado do tamanho CSS do canvas e das dimensões do
 * nível; todo desenho e o hit-test de `BoardRenderer.cellAt` passam por aqui.
 * Coordenadas sempre em px CSS — a nitidez em DPR alto é responsabilidade do
 * renderizador (backing store × devicePixelRatio), não desta camada.
 */

import type { Coord } from '@circuit/core/model'

export interface BoardLayout {
  /** Largura/altura CSS do canvas que originou o layout. */
  readonly cssWidth: number
  readonly cssHeight: number
  readonly cols: number
  readonly rows: number
  /** Tamanho do lado de cada célula, em px CSS. */
  readonly cellSize: number
  /** Deslocamento do canto superior esquerdo do grid dentro do canvas. */
  readonly originX: number
  readonly originY: number
}

export interface CellRect {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

/** Menor célula aceitável — abaixo disso o desenho perde o sentido. */
export const MIN_CELL_SIZE = 4

/**
 * Deriva o layout que encaixa o grid `cols×rows` no canvas `cssWidth×cssHeight`,
 * centralizando o excesso. `padding` é uma margem interna opcional em px.
 */
export function computeBoardLayout(
  cssWidth: number,
  cssHeight: number,
  cols: number,
  rows: number,
  padding = 0,
): BoardLayout {
  const availW = Math.max(1, cssWidth - padding * 2)
  const availH = Math.max(1, cssHeight - padding * 2)
  const cellSize = Math.max(
    MIN_CELL_SIZE,
    Math.floor(Math.min(availW / Math.max(1, cols), availH / Math.max(1, rows))),
  )
  const gridW = cellSize * cols
  const gridH = cellSize * rows
  return {
    cssWidth,
    cssHeight,
    cols,
    rows,
    cellSize,
    originX: Math.floor((cssWidth - gridW) / 2),
    originY: Math.floor((cssHeight - gridH) / 2),
  }
}

/** Retângulo (px CSS) ocupado pela célula (x, y) no canvas. */
export function cellRect(layout: BoardLayout, x: number, y: number): CellRect {
  return {
    x: layout.originX + x * layout.cellSize,
    y: layout.originY + y * layout.cellSize,
    w: layout.cellSize,
    h: layout.cellSize,
  }
}

/** Centro em px CSS da célula (x, y). */
export function cellCenter(
  layout: BoardLayout,
  x: number,
  y: number,
): { readonly x: number; readonly y: number } {
  const rect = cellRect(layout, x, y)
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 }
}

/**
 * Converte um ponto em px CSS (relativo ao canto superior esquerdo do canvas)
 * na célula do grid que o contém. `null` quando o ponto cai fora do grid
 * (excesso centralizado ou além das bordas).
 */
export function coordAt(layout: BoardLayout, xPx: number, yPx: number): Coord | null {
  if (xPx < layout.originX || yPx < layout.originY) return null
  const x = Math.floor((xPx - layout.originX) / layout.cellSize)
  const y = Math.floor((yPx - layout.originY) / layout.cellSize)
  if (x < 0 || y < 0 || x >= layout.cols || y >= layout.rows) return null
  return { x, y }
}
