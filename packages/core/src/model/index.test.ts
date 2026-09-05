import { describe, expect, it } from 'vitest'
import { CORE_VERSION, GATE_ARITY, LEVEL_SCHEMA_VERSION } from './index'
import {
  exampleBoardState,
  exampleLevelSpec,
  exampleSimulationResult,
} from './fixtures'

describe('core scaffold', () => {
  it('exposes a version placeholder', () => {
    expect(CORE_VERSION).toBe('0.0.1')
  })
})

describe('LevelSpec contract', () => {
  it('accepts a fully typed example level', () => {
    expect(exampleLevelSpec.schemaVersion).toBe(LEVEL_SCHEMA_VERSION)
    expect(exampleLevelSpec.fixedCells).toHaveLength(3)
    expect(exampleLevelSpec.hints).toHaveLength(2)
  })

  it('declares gate input sides explicitly, matching the gate arity', () => {
    const gate = exampleLevelSpec.fixedCells.find(
      (fixed) => fixed.cell.kind === 'gate',
    )
    if (!gate || gate.cell.kind !== 'gate') {
      throw new Error('fixture is missing a gate cell')
    }
    expect(gate.cell.inputSides).toHaveLength(GATE_ARITY[gate.cell.gate])
  })
})

describe('BoardState contract', () => {
  it('starts as an editable layer independent from fixed cells', () => {
    expect(exampleBoardState.levelId).toBe(exampleLevelSpec.id)
    expect(exampleBoardState.placedCells).toEqual([])
  })
})

describe('SimulationResult contract', () => {
  it('carries typed issues alongside per-sink status', () => {
    expect(exampleSimulationResult.ok).toBe(false)
    expect(exampleSimulationResult.issues[0]?.kind).toBe('floating')
    expect(exampleSimulationResult.sinks[0]?.satisfied).toBe(false)
  })
})
