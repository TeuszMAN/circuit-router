import { describe, expect, it } from 'vitest'
import {
  cellCenter,
  cellRect,
  computeBoardLayout,
  coordAt,
  MIN_CELL_SIZE,
} from './geometry'

describe('computeBoardLayout', () => {
  it('encaixa o grid exato quando o canvas tem a proporção certa', () => {
    const layout = computeBoardLayout(300, 100, 3, 1)
    expect(layout.cellSize).toBe(100)
    expect(layout.originX).toBe(0)
    expect(layout.originY).toBe(0)
  })

  it('centraliza o excesso horizontal', () => {
    const layout = computeBoardLayout(500, 100, 3, 1)
    expect(layout.cellSize).toBe(100) // min(500/3, 100) → altura manda
    expect(layout.originX).toBe(100) // (500 - 3*100) / 2
    expect(layout.originY).toBe(0)
  })

  it('centraliza o excesso vertical', () => {
    const layout = computeBoardLayout(300, 500, 3, 1)
    expect(layout.cellSize).toBe(100) // min(300/3, 500) → largura manda
    expect(layout.originX).toBe(0)
    expect(layout.originY).toBe(200) // (500 - 100) / 2
  })

  it('usa a dimensão mais apertada e nunca estoura o canvas', () => {
    const layout = computeBoardLayout(300, 90, 4, 2)
    expect(layout.cellSize).toBe(45) // altura: 90/2
    expect(layout.originX).toBe(60) // (300 - 4*45)/2
    expect(layout.originY).toBe(0)
  })

  it('aplica margem interna (padding) nas duas dimensões', () => {
    const layout = computeBoardLayout(320, 120, 3, 1, 10)
    expect(layout.cellSize).toBe(100)
    expect(layout.originX).toBe(10)
    expect(layout.originY).toBe(10)
  })

  it('nunca produz célula menor que o mínimo, mesmo em canvas minúsculo', () => {
    const layout = computeBoardLayout(2, 2, 20, 14)
    expect(layout.cellSize).toBe(MIN_CELL_SIZE)
  })
})

describe('conversão célula↔pixel', () => {
  const layout = computeBoardLayout(300, 100, 3, 1)

  it('cellRect e cellCenter mapeiam uma célula para o seu retângulo', () => {
    const rect = cellRect(layout, 1, 0)
    expect(rect).toEqual({ x: 100, y: 0, w: 100, h: 100 })
    expect(cellCenter(layout, 1, 0)).toEqual({ x: 150, y: 50 })
  })

  it('coordAt devolve a célula que contém um ponto do container', () => {
    expect(coordAt(layout, 10, 5)).toEqual({ x: 0, y: 0 })
    expect(coordAt(layout, 250, 99)).toEqual({ x: 2, y: 0 })
    expect(coordAt(layout, 100, 0)).toEqual({ x: 1, y: 0 })
  })

  it('coordAt devolve null fora do grid (bordas e excesso centralizado)', () => {
    expect(coordAt(layout, 301, 50)).toBeNull()
    expect(coordAt(layout, -1, 50)).toBeNull()
    expect(coordAt(layout, 50, 101)).toBeNull()
    expect(coordAt(layout, 50, -1)).toBeNull()
  })

  it('round-trip célula→centro→célula preserva a coordenada', () => {
    for (const expected of [{ x: 0, y: 0 }, { x: 2, y: 0 }] as const) {
      const center = cellCenter(layout, expected.x, expected.y)
      expect(coordAt(layout, center.x, center.y)).toEqual(expected)
    }
  })

  it('funciona com origem deslocada (grid menor que o canvas)', () => {
    // Canvas 300×350 com grid 3×3: células de 100px, sobram 50px verticais
    // (origem y = 25). coordAt deve respeitar a origem.
    const shifted = computeBoardLayout(300, 350, 3, 3)
    expect(shifted.cellSize).toBe(100)
    expect(shifted.originX).toBe(0)
    expect(shifted.originY).toBe(25)
    expect(coordAt(shifted, 10, 20)).toBeNull() // acima do grid (y < 25)
    expect(coordAt(shifted, 10, 26)).toEqual({ x: 0, y: 0 })
    expect(coordAt(shifted, 290, 30)).toEqual({ x: 2, y: 0 })
    expect(coordAt(shifted, 290, 300)).toEqual({ x: 2, y: 2 })
    expect(coordAt(shifted, 150, 349)).toBeNull() // abaixo do grid
  })
})
