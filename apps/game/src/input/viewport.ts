/**
 * Matemática pura de pinch-zoom e pan (SDD §7.4): clamp de escala dentro dos
 * limites configurados e clamp de pan de modo que o conteúdo ampliado nunca
 * se afaste a ponto de expor área vazia além das bordas do viewport.
 */

export const DEFAULT_MIN_ZOOM = 1
export const DEFAULT_MAX_ZOOM = 4

export interface PanOffset {
  readonly x: number
  readonly y: number
}

export interface ViewportPoint {
  readonly x: number
  readonly y: number
}

export function clampZoom(scale: number, min: number, max: number): number {
  if (!Number.isFinite(scale)) return min
  return Math.min(max, Math.max(min, scale))
}

/** Deslocamento máximo (em uma direção) antes de expor área vazia do viewport. */
function maxPanFor(viewportSize: number, scale: number): number {
  return Math.max(0, (viewportSize * scale - viewportSize) / 2)
}

export function clampPan(
  offset: PanOffset,
  viewportWidth: number,
  viewportHeight: number,
  scale: number,
): PanOffset {
  const maxX = maxPanFor(viewportWidth, scale)
  const maxY = maxPanFor(viewportHeight, scale)
  return {
    x: Math.min(maxX, Math.max(-maxX, offset.x)),
    y: Math.min(maxY, Math.max(-maxY, offset.y)),
  }
}

export function distance(a: ViewportPoint, b: ViewportPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function midpoint(a: ViewportPoint, b: ViewportPoint): ViewportPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}
