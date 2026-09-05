// Camada de edição com padrão Command e histórico de undo/redo (SDD §6).
// Estado imutável: cada transição produz um novo BoardState; as pilhas
// guardam os estados anteriores — um traço inteiro vira UM único passo de
// undo. Invariante (SDD §6.3): nunca sobrescrever célula fixa do nível.
// Sem dependência de DOM.

import type {
  BoardState,
  Cell,
  Coord,
  Direction,
  GateCell,
  GateType,
  LevelSpec,
  PlacedCell,
  WireCell,
} from '../model'

const OPPOSITE: Readonly<Record<Direction, Direction>> = {
  N: 'S',
  S: 'N',
  E: 'W',
  W: 'E',
}

/** Rotação no sentido horário (N -> E -> S -> W). */
const CW: Readonly<Record<Direction, Direction>> = {
  N: 'E',
  E: 'S',
  S: 'W',
  W: 'N',
}

export function oppositeOf(direction: Direction): Direction {
  return OPPOSITE[direction]
}

export function rotateCw(direction: Direction): Direction {
  return CW[direction]
}

/**
 * Lados de entrada declarados de uma porta a partir da direção de saída
 * (SDD §3.3). NOT tem 1 entrada (oposta à saída); AND/OR têm 2: a oposta e a
 * vizinha no sentido horário. Autores de fase que quiserem outra geometria
 * declaram `inputSides` explicitamente no `LevelSpec`.
 */
export function inputSidesFor(gate: GateType, outputSide: Direction): readonly Direction[] {
  const opposite = OPPOSITE[outputSide]
  if (gate === 'NOT') return [opposite]
  return [opposite, CW[outputSide]]
}

/** Célula ocupada em uma coordenada: do nível (fixa) ou do jogador. */
export interface CellAt {
  readonly cell: Cell
  readonly fixed: boolean
}

export interface EditorOptions {
  /** Quantos passos de undo são mantidos (padrão 200). */
  readonly maxHistory?: number
}

export interface WirePlacement {
  readonly coord: Coord
  readonly sides: readonly Direction[]
}

function key(x: number, y: number): string {
  return `${x},${y}`
}

function sameCoord(a: Coord, b: Coord): boolean {
  return a.x === b.x && a.y === b.y
}

/** Substitui (ou insere) uma peça do jogador numa coordenada. */
function upsert(placed: readonly PlacedCell[], cell: PlacedCell): PlacedCell[] {
  const next = placed.filter(p => !sameCoord(p.coord, cell.coord))
  return [...next, cell]
}

function removeAt(placed: readonly PlacedCell[], coord: Coord): PlacedCell[] {
  return placed.filter(p => !sameCoord(p.coord, coord))
}

export class LevelEditor {
  private _board: BoardState
  private readonly undoStack: BoardState[] = []
  private readonly redoStack: BoardState[] = []
  private readonly fixed = new Map<string, Cell>()
  private readonly maxHistory: number
  private readonly width: number
  private readonly height: number

  constructor(
    readonly level: LevelSpec,
    initial?: BoardState,
    options: EditorOptions = {},
  ) {
    this.maxHistory = options.maxHistory ?? 200
    this._board = initial ?? { levelId: level.id, placedCells: [] }
    this.width = level.grid.width
    this.height = level.grid.height
    for (const fixedCell of level.fixedCells) {
      this.fixed.set(key(fixedCell.coord.x, fixedCell.coord.y), fixedCell.cell)
    }
  }

  get board(): BoardState {
    return this._board
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0
  }

  isInside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height
  }

  isFixed(x: number, y: number): boolean {
    return this.fixed.has(key(x, y))
  }

  /** Célula ocupada em (x,y): fixa do nível (prioridade) ou do jogador. */
  cellAt(x: number, y: number): CellAt | undefined {
    const fixedCell = this.fixed.get(key(x, y))
    if (fixedCell) return { cell: fixedCell, fixed: true }
    const placed = this._board.placedCells.find(p => p.coord.x === x && p.coord.y === y)
    return placed ? { cell: placed.cell, fixed: false } : undefined
  }

  /** Total de peças do jogador no tabuleiro (para estrela ★2). */
  get placedCount(): number {
    return this._board.placedCells.length
  }

  private transition(apply: (placed: readonly PlacedCell[]) => PlacedCell[] | null): boolean {
    const next = apply(this._board.placedCells)
    if (next === null) return false
    this.undoStack.push(this._board)
    if (this.undoStack.length > this.maxHistory) this.undoStack.shift()
    this.redoStack.length = 0
    this._board = { levelId: this.level.id, placedCells: next }
    return true
  }

  /** Coloca (ou substitui) um fio. Rejeita célula fixa ou fora do grid. */
  placeWire(x: number, y: number, sides: readonly Direction[]): boolean {
    if (!this.isInside(x, y) || this.isFixed(x, y)) return false
    const wire: WireCell = { kind: 'wire', sides }
    return this.transition(placed => upsert(placed, { coord: { x, y }, cell: wire }))
  }

  /** Coloca (ou substitui) uma porta com os lados derivados da rotação. */
  placeGate(x: number, y: number, gate: GateType, outputSide: Direction): boolean {
    if (!this.isInside(x, y) || this.isFixed(x, y)) return false
    const cell: GateCell = {
      kind: 'gate',
      gate,
      rotation: outputSide,
      inputSides: inputSidesFor(gate, outputSide),
      outputSide,
    }
    return this.transition(placed => upsert(placed, { coord: { x, y }, cell }))
  }

  /** Rotaciona 90° no sentido horário uma porta do jogador. */
  rotateGate(x: number, y: number): boolean {
    const at = this.cellAt(x, y)
    if (!at || at.fixed || at.cell.kind !== 'gate') return false
    const gate = at.cell
    const rotation = rotateCw(gate.rotation)
    const cell: GateCell = {
      kind: 'gate',
      gate: gate.gate,
      rotation,
      inputSides: inputSidesFor(gate.gate, rotation),
      outputSide: rotation,
    }
    return this.transition(placed => upsert(placed, { coord: { x, y }, cell }))
  }

  /** Apaga uma peça do jogador. Rejeita célula fixa ou vazia. */
  erase(x: number, y: number): boolean {
    const at = this.cellAt(x, y)
    if (!at || at.fixed) return false
    return this.transition(placed => {
      const next = removeAt(placed, { x, y })
      return next.length === placed.length ? null : next
    })
  }

  /**
   * Traço contínuo de fios (drag-to-connect, SDD §6.2): células fixas são
   * puladas e TODO o traço vira um único comando de undo. Substitui peças do
   * jogador existentes nas células do caminho.
   */
  dragWires(path: readonly WirePlacement[]): boolean {
    if (path.length === 0) return false
    return this.transition(placed => {
      let next: PlacedCell[] = [...placed]
      let changed = false
      for (const step of path) {
        const { x, y } = step.coord
        if (!this.isInside(x, y) || this.isFixed(x, y)) continue
        const wire: WireCell = { kind: 'wire', sides: step.sides }
        next = upsert(next, { coord: { x, y }, cell: wire })
        changed = true
      }
      return changed ? next : null
    })
  }

  /** Limpa o tabuleiro inteiro do jogador em um único comando. */
  clear(): boolean {
    if (this._board.placedCells.length === 0) return false
    return this.transition(() => [])
  }

  undo(): boolean {
    const previous = this.undoStack.pop()
    if (!previous) return false
    this.redoStack.push(this._board)
    this._board = previous
    return true
  }

  redo(): boolean {
    const next = this.redoStack.pop()
    if (!next) return false
    this.undoStack.push(this._board)
    this._board = next
    return true
  }
}
