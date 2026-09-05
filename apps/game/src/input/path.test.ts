import { describe, expect, it } from 'vitest'
import { coordsEqual, orthogonalBridge } from './path'

describe('orthogonalBridge', () => {
  it('não gera passo algum entre uma célula e ela mesma', () => {
    expect(orthogonalBridge({ x: 2, y: 2 }, { x: 2, y: 2 })).toEqual([])
  })

  it('anda reto quando o movimento é puramente horizontal ou vertical', () => {
    expect(orthogonalBridge({ x: 0, y: 0 }, { x: 3, y: 0 })).toEqual([
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ])
    expect(orthogonalBridge({ x: 0, y: 0 }, { x: 0, y: -2 })).toEqual([
      { x: 0, y: -1 },
      { x: 0, y: -2 },
    ])
  })

  it('corrige um salto diagonal em uma escada ortogonal contínua, sem buracos', () => {
    const bridge = orthogonalBridge({ x: 0, y: 0 }, { x: 3, y: 3 })

    // Nunca um passo diagonal: cada célula difere da anterior em exatamente
    // 1 unidade num único eixo.
    const full = [{ x: 0, y: 0 }, ...bridge]
    for (let i = 1; i < full.length; i += 1) {
      const prev = full[i - 1]!
      const curr = full[i]!
      const dx = Math.abs(curr.x - prev.x)
      const dy = Math.abs(curr.y - prev.y)
      expect(dx + dy).toBe(1)
    }

    // Sem buracos: chega exatamente ao destino, percorrendo todas as 6 células.
    expect(bridge).toHaveLength(6)
    expect(bridge[bridge.length - 1]).toEqual({ x: 3, y: 3 })
  })

  it('corrige diagonais também com eixos assimétricos e sinais negativos', () => {
    const bridge = orthogonalBridge({ x: 5, y: 5 }, { x: 2, y: 7 })
    const full = [{ x: 5, y: 5 }, ...bridge]
    for (let i = 1; i < full.length; i += 1) {
      const prev = full[i - 1]!
      const curr = full[i]!
      expect(Math.abs(curr.x - prev.x) + Math.abs(curr.y - prev.y)).toBe(1)
    }
    expect(bridge).toHaveLength(5) // |5-2| + |7-5|
    expect(bridge[bridge.length - 1]).toEqual({ x: 2, y: 7 })
  })
})

describe('coordsEqual', () => {
  it('compara por valor', () => {
    expect(coordsEqual({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(true)
    expect(coordsEqual({ x: 1, y: 2 }, { x: 1, y: 3 })).toBe(false)
  })
})
