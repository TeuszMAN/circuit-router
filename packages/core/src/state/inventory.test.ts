import { expect, it } from 'vitest'
import { exampleLevelSpec } from '../model/fixtures'
import { LevelEditor, remainingInventory } from './index'

it('rejeita portas indisponíveis (incluindo tipo omitido)', () => {
  const editor = new LevelEditor({ ...exampleLevelSpec, fixedCells: [], inventory: { wires: null, gates: {} } })
  expect(editor.placeGate(1, 0, 'AND', 'E')).toBe(false)
  expect(editor.canUndo).toBe(false)
})

it('rejeita um arrasto inteiro acima do limite sem perder o redo ou colocar meio caminho', () => {
  const editor = new LevelEditor({ ...exampleLevelSpec, fixedCells: [], inventory: { wires: 1, gates: {} } })
  editor.placeWire(0, 0, ['E'])
  editor.undo()
  expect(editor.dragWires([
    { coord: { x: 0, y: 0 }, sides: ['E'] }, { coord: { x: 1, y: 0 }, sides: ['W'] },
  ])).toBe(false)
  expect(editor.board.placedCells).toEqual([])
  expect(editor.canRedo).toBe(true)
})

it('devolve estoque ao apagar/substituir/desfazer e permite completar lados sem peças extras', () => {
  const level = { ...exampleLevelSpec, fixedCells: [], inventory: { wires: 1, gates: { NOT: 1 } } }
  const editor = new LevelEditor(level)
  editor.placeWire(1, 0, ['W'])
  expect(editor.placeWire(2, 0, ['W', 'E'])).toBe(false)
  expect(editor.dragWires([{ coord: { x: 1, y: 0 }, sides: ['E'] }])).toBe(true)
  expect(editor.placeGate(1, 0, 'NOT', 'E')).toBe(true)
  expect(remainingInventory(level, editor.board).wires).toBe(1)
  expect(editor.placeGate(2, 0, 'NOT', 'E')).toBe(false)
  expect(editor.rotateGate(1, 0)).toBe(true)
  editor.erase(1, 0)
  expect(remainingInventory(level, editor.board).gates.NOT).toBe(1)
  editor.undo()
  expect(remainingInventory(level, editor.board).gates.NOT).toBe(0)
})
