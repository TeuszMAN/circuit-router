// Testes da camada de edição (MI-04): comandos, undo/redo, traço coalescido
// em um comando, invariante de célula fixa e property test de 200 ops.

import { describe, expect, it } from 'vitest'
import type { BoardState, Direction, GateType, LevelSpec } from '../model'
import { LEVEL_SCHEMA_VERSION } from '../model'
import { LevelEditor, inputSidesFor } from './index'

function makeLevel(): LevelSpec {
  return {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'editor-test',
    name: 'Tabuleiro de teste',
    grid: { width: 5, height: 3 },
    fixedCells: [
      { coord: { x: 0, y: 0 }, cell: { kind: 'source', value: 1, outputSide: 'E' } },
      { coord: { x: 4, y: 2 }, cell: { kind: 'sink', expected: 1, inputSide: 'W' } },
    ],
    inventory: { wires: null, gates: {} },
    hints: ['dica', 'dica'],
    starThresholds: { maxPieces: 99, maxGates: 99 },
  }
}

const emptyBoard = (level: LevelSpec): BoardState => ({ levelId: level.id, placedCells: [] })

describe('LevelEditor: comandos básicos (MI-04)', () => {
  it('placeWire e placeGate alteram o board; undo/redo restauram', () => {
    const level = makeLevel()
    const editor = new LevelEditor(level, emptyBoard(level))
    expect(editor.placeWire(1, 1, ['E', 'W'])).toBe(true)
    expect(editor.board.placedCells).toHaveLength(1)
    expect(editor.canUndo).toBe(true)

    expect(editor.undo()).toBe(true)
    expect(editor.board.placedCells).toEqual([])
    expect(editor.canRedo).toBe(true)

    expect(editor.redo()).toBe(true)
    expect(editor.board.placedCells).toHaveLength(1)
  })

  it('placeGate deriva inputSides da rotação (SDD §3.3)', () => {
    const level = makeLevel()
    const editor = new LevelEditor(level, emptyBoard(level))
    expect(editor.placeGate(2, 1, 'AND', 'E')).toBe(true)
    const gate = editor.board.placedCells[0]?.cell
    expect(gate?.kind).toBe('gate')
    if (gate?.kind !== 'gate') throw new Error('porta ausente')
    expect(gate.inputSides).toEqual(['W', 'S'])
    expect(gate.outputSide).toBe('E')

    expect(inputSidesFor('NOT', 'N')).toEqual(['S'])
    expect(inputSidesFor('OR', 'S')).toEqual(['N', 'W'])
  })

  it('rotateGate rotaciona no sentido horário recalculando os lados', () => {
    const level = makeLevel()
    const editor = new LevelEditor(level, emptyBoard(level))
    editor.placeGate(2, 1, 'AND', 'E')
    expect(editor.rotateGate(2, 1)).toBe(true)
    const gate = editor.board.placedCells[0]?.cell
    if (gate?.kind !== 'gate') throw new Error('porta ausente')
    expect(gate.rotation).toBe('S')
    expect(gate.outputSide).toBe('S')
    expect(gate.inputSides).toEqual(['N', 'W'])
  })

  it('comando sobre célula fixa é rejeitado sem alterar estado', () => {
    const level = makeLevel()
    const editor = new LevelEditor(level, emptyBoard(level))
    const before = editor.board
    expect(editor.placeWire(0, 0, ['E', 'W'])).toBe(false) // source fixo
    expect(editor.placeGate(4, 2, 'NOT', 'E')).toBe(false) // sink fixo
    expect(editor.erase(0, 0)).toBe(false)
    expect(editor.rotateGate(0, 0)).toBe(false)
    expect(editor.board).toEqual(before)
    expect(editor.canUndo).toBe(false)
  })

  it('célula fora do grid é rejeitada', () => {
    const level = makeLevel()
    const editor = new LevelEditor(level, emptyBoard(level))
    expect(editor.placeWire(-1, 0, ['E'])).toBe(false)
    expect(editor.placeWire(5, 0, ['E', 'W'])).toBe(false)
    expect(editor.placeGate(0, 3, 'NOT', 'E')).toBe(false)
  })

  it('colocar sobre peça do jogador substitui (um único comando)', () => {
    const level = makeLevel()
    const editor = new LevelEditor(level, emptyBoard(level))
    editor.placeWire(2, 1, ['E', 'W'])
    expect(editor.board.placedCells).toHaveLength(1)
    expect(editor.placeGate(2, 1, 'NOT', 'E')).toBe(true)
    expect(editor.board.placedCells).toHaveLength(1)
    const cell = editor.board.placedCells[0]?.cell
    expect(cell?.kind).toBe('gate')
  })

  it('erase remove apenas peças do jogador', () => {
    const level = makeLevel()
    const editor = new LevelEditor(level, emptyBoard(level))
    editor.placeWire(1, 1, ['E', 'W'])
    editor.placeGate(3, 1, 'NOT', 'E')
    expect(editor.erase(3, 1)).toBe(true)
    expect(editor.board.placedCells).toHaveLength(1)
    expect(editor.erase(1, 1)).toBe(true)
    expect(editor.board.placedCells).toEqual([])
    expect(editor.erase(1, 1)).toBe(false) // vazio
  })

  it('redo é limpo após uma nova edição', () => {
    const level = makeLevel()
    const editor = new LevelEditor(level, emptyBoard(level))
    editor.placeWire(1, 1, ['E', 'W'])
    editor.undo()
    expect(editor.canRedo).toBe(true)
    editor.placeWire(2, 2, ['E', 'W'])
    expect(editor.canRedo).toBe(false)
    expect(editor.redo()).toBe(false)
  })
})

describe('LevelEditor: traço e histórico (MI-04)', () => {
  it('undo de um traço de N células restaura o estado exato em UMA operação', () => {
    const level = makeLevel()
    const editor = new LevelEditor(level, emptyBoard(level))
    const path = [
      { coord: { x: 1, y: 1 }, sides: ['E', 'W'] as Direction[] },
      { coord: { x: 2, y: 1 }, sides: ['E', 'W'] as Direction[] },
      { coord: { x: 2, y: 2 }, sides: ['E', 'W'] as Direction[] },
      { coord: { x: 3, y: 2 }, sides: ['E', 'W'] as Direction[] },
    ]
    expect(editor.dragWires(path)).toBe(true)
    expect(editor.board.placedCells).toHaveLength(4)
    expect(editor.undo()).toBe(true)
    expect(editor.board.placedCells).toEqual([])
    expect(editor.canUndo).toBe(false) // um único passo consumido
    expect(editor.redo()).toBe(true)
    expect(editor.board.placedCells).toHaveLength(4)
  })

  it('traço pula células fixas e continua', () => {
    const level = makeLevel()
    const editor = new LevelEditor(level, emptyBoard(level))
    const path = [
      { coord: { x: 0, y: 0 }, sides: ['E', 'W'] as Direction[] }, // fixa (source) — pulada
      { coord: { x: 1, y: 0 }, sides: ['E', 'W'] as Direction[] },
      { coord: { x: 2, y: 0 }, sides: ['E', 'W'] as Direction[] },
    ]
    expect(editor.dragWires(path)).toBe(true)
    expect(editor.board.placedCells).toHaveLength(2)
    expect(editor.board.placedCells.some(p => p.coord.x === 0 && p.coord.y === 0)).toBe(false)
  })

  it('traço vazio é rejeitado', () => {
    const level = makeLevel()
    const editor = new LevelEditor(level, emptyBoard(level))
    expect(editor.dragWires([])).toBe(false)
  })

  it('clear remove tudo em um comando e undo restaura', () => {
    const level = makeLevel()
    const editor = new LevelEditor(level, emptyBoard(level))
    editor.placeWire(1, 1, ['E', 'W'])
    editor.placeGate(3, 1, 'NOT', 'E')
    expect(editor.clear()).toBe(true)
    expect(editor.board.placedCells).toEqual([])
    expect(editor.undo()).toBe(true)
    expect(editor.board.placedCells).toHaveLength(2)
  })

  it('limite de histórico descarta os passos mais antigos', () => {
    const level = makeLevel()
    const editor = new LevelEditor(level, emptyBoard(level), { maxHistory: 3 })
    for (let i = 1; i <= 4; i++) {
      expect(editor.placeWire(i, 0, ['E', 'W'])).toBe(true)
    }
    expect(editor.board.placedCells).toHaveLength(4)
    // histórico guarda no máximo 3 estados: a 1ª jogada já não é desfeita.
    editor.undo()
    expect(editor.board.placedCells).toHaveLength(3)
    editor.undo()
    expect(editor.board.placedCells).toHaveLength(2)
    editor.undo()
    expect(editor.board.placedCells).toHaveLength(1)
    expect(editor.undo()).toBe(false)
  })

  it('property test: 200 comandos aleatórios + 200 undos voltam ao estado inicial', () => {
    const level = makeLevel()
    const editor = new LevelEditor(level, emptyBoard(level))
    const initial = JSON.stringify(editor.board)

    // LCG determinístico (mulberry32 simplificado)
    let seed = 42
    const rand = (): number => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed / 0xffffffff
    }
    const dirs: readonly Direction[] = ['N', 'S', 'E', 'W']
    const gates: readonly GateType[] = ['NOT', 'AND', 'OR']
    const pick = <T,>(list: readonly T[]): T => {
      const item = list[Math.floor(rand() * list.length)]
      if (item === undefined) throw new Error('lista vazia no pick')
      return item
    }

    let applied = 0
    for (let i = 0; i < 200; i++) {
      const x = Math.floor(rand() * 5)
      const y = Math.floor(rand() * 3)
      const op = Math.floor(rand() * 5)
      let ok = false
      if (op === 0) {
        const n = 2 + Math.floor(rand() * 3)
        const sides = [...new Set(Array.from({ length: n }, () => pick(dirs)))]
        if (sides.length >= 2) ok = editor.placeWire(x, y, sides)
      } else if (op === 1) {
        ok = editor.placeGate(x, y, pick(gates), pick(dirs))
      } else if (op === 2) {
        ok = editor.rotateGate(x, y)
      } else if (op === 3) {
        ok = editor.erase(x, y)
      } else {
        ok = editor.clear()
      }
      if (ok) applied++
    }
    expect(applied).toBeGreaterThan(0)

    let undos = 0
    while (editor.undo()) undos++
    expect(undos).toBe(applied)
    expect(JSON.stringify(editor.board)).toBe(initial)
  })
})
