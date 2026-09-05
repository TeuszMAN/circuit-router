import { describe, expect, it } from 'vitest'
import { clampPan, clampZoom, distance, midpoint } from './viewport'

describe('clampZoom', () => {
  it('mantém a escala dentro dos limites', () => {
    expect(clampZoom(2, 1, 4)).toBe(2)
    expect(clampZoom(0.2, 1, 4)).toBe(1)
    expect(clampZoom(10, 1, 4)).toBe(4)
  })

  it('cai para o mínimo quando a escala não é finita', () => {
    expect(clampZoom(Number.NaN, 1, 4)).toBe(1)
    expect(clampZoom(Number.POSITIVE_INFINITY, 1, 4)).toBe(1)
  })
})

describe('clampPan', () => {
  it('não permite pan quando a escala é 1 (conteúdo já preenche o viewport)', () => {
    expect(clampPan({ x: 50, y: 50 }, 200, 100, 1)).toEqual({ x: 0, y: 0 })
  })

  it('permite pan proporcional ao excesso de conteúdo ampliado', () => {
    // escala 2 num viewport de 200px → excesso de 200px, 100px para cada lado.
    expect(clampPan({ x: 1000, y: 0 }, 200, 100, 2)).toEqual({ x: 100, y: 0 })
    expect(clampPan({ x: -1000, y: 0 }, 200, 100, 2)).toEqual({ x: -100, y: 0 })
  })
})

describe('distance / midpoint', () => {
  it('calcula distância euclidiana entre dois pontos', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
  })

  it('calcula o ponto médio', () => {
    expect(midpoint({ x: 0, y: 0 }, { x: 4, y: 2 })).toEqual({ x: 2, y: 1 })
  })
})
