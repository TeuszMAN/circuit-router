import { describe, expect, it } from 'vitest'
import { LEVEL_SCHEMA_VERSION, type LevelSpec } from '@circuit/core/model'
import { parseLevelSpecJson, validateLevelSpec } from './schema'

const validSpec: LevelSpec = {
  schemaVersion: LEVEL_SCHEMA_VERSION,
  id: 'sandbox-01',
  name: 'Fase de teste',
  grid: { width: 3, height: 1 },
  fixedCells: [
    { coord: { x: 0, y: 0 }, cell: { kind: 'source', value: 1, outputSide: 'E' } },
    { coord: { x: 1, y: 0 }, cell: { kind: 'wire', sides: ['W', 'E'] } },
    { coord: { x: 2, y: 0 }, cell: { kind: 'sink', expected: 1, inputSide: 'W' } },
  ],
  inventory: { wires: 0, gates: { AND: 0, OR: 0, NOT: 0 } },
  hints: ['dica 1', 'dica 2'],
  starThresholds: { maxPieces: 0, maxGates: 0 },
}

describe('validateLevelSpec', () => {
  it('aceita uma fase bem formada', () => {
    const result = validateLevelSpec(validSpec)
    expect(result.ok).toBe(true)
  })

  it('rejeita valor que não é objeto', () => {
    const result = validateLevelSpec('não é json de fase')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.length).toBeGreaterThan(0)
  })

  it('rejeita schemaVersion desconhecida com mensagem clara', () => {
    const result = validateLevelSpec({ ...validSpec, schemaVersion: 999 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.some(e => e.includes('schemaVersion'))).toBe(true)
  })

  it('rejeita grid ausente ou inválido', () => {
    const result = validateLevelSpec({ ...validSpec, grid: { width: 0, height: 1 } })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.some(e => e.startsWith('grid.width'))).toBe(true)
  })

  it('rejeita célula fixa fora do grid', () => {
    const result = validateLevelSpec({
      ...validSpec,
      fixedCells: [{ coord: { x: 10, y: 10 }, cell: { kind: 'empty' } }],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.some(e => e.includes('fixedCells[0].coord'))).toBe(true)
  })

  it('rejeita porta com aridade errada', () => {
    const result = validateLevelSpec({
      ...validSpec,
      fixedCells: [
        {
          coord: { x: 0, y: 0 },
          cell: { kind: 'gate', gate: 'AND', rotation: 'E', inputSides: ['W'], outputSide: 'E' },
        },
      ],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.some(e => e.includes('inputSides'))).toBe(true)
  })

  it('rejeita hints que não são uma tupla de duas strings', () => {
    const result = validateLevelSpec({ ...validSpec, hints: ['só uma'] })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.some(e => e.startsWith('hints'))).toBe(true)
  })
})

describe('parseLevelSpecJson', () => {
  it('faz o round-trip de uma fase válida', () => {
    const json = JSON.stringify(validSpec)
    const result = parseLevelSpecJson(json)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toEqual(validSpec)
  })

  it('retorna erro claro para JSON malformado, sem lançar', () => {
    expect(() => parseLevelSpecJson('{ isso não é json')).not.toThrow()
    const result = parseLevelSpecJson('{ isso não é json')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]).toContain('JSON inválido')
    }
  })

  it('retorna erro claro para JSON válido mas fora do schema, sem lançar', () => {
    expect(() => parseLevelSpecJson(JSON.stringify({ foo: 'bar' }))).not.toThrow()
    const result = parseLevelSpecJson(JSON.stringify({ foo: 'bar' }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.length).toBeGreaterThan(0)
  })
})
