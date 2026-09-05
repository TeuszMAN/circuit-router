// Estimativa de dificuldade de uma fase (MI-05, SDD §9.4): três métricas
// estruturais derivadas do circuito (não do olho):
//   - `gates`: nº de portas fixas da fase;
//   - `depth`: profundidade combinacional — maior nº de portas em série entre
//     uma fonte e um sink, extraído do netlist montado a partir do tabuleiro
//     (fixo + fios da solução);
//   - `wireLength`: comprimento de rota — fios usados na solução.
// O `score` é uma combinação ponderada usada para ordenar fases e para o
// teste de monotonicidade (dificuldade do parâmetro => dificuldade estimada).

import type { BoardState, Cell, Coord, Direction, LevelSpec } from '../model'

export interface DifficultyEstimate {
  readonly gates: number
  readonly depth: number
  readonly wireLength: number
  readonly score: number
}

const OPPOSITE: Readonly<Record<Direction, Direction>> = {
  N: 'S',
  S: 'N',
  E: 'W',
  W: 'E',
}

const DELTA: Readonly<Record<Direction, readonly [number, number]>> = {
  N: [0, -1],
  S: [0, 1],
  E: [1, 0],
  W: [-1, 0],
}

const key = (x: number, y: number): string => `${x},${y}`

function activeSides(cell: Cell): readonly Direction[] {
  switch (cell.kind) {
    case 'source':
      return [cell.outputSide]
    case 'sink':
      return [cell.inputSide]
    case 'gate':
      return [...cell.inputSides, cell.outputSide]
    default:
      return []
  }
}

export function estimateDifficulty(level: LevelSpec, board: BoardState | undefined): DifficultyEstimate {
  const gates = level.fixedCells.filter(f => f.cell.kind === 'gate').length
  const wireLength = board ? board.placedCells.filter(p => p.cell.kind === 'wire').length : 0
  const depth = board ? extractDepth(level, board) : 0
  const score = gates * 20 + depth * 5 + wireLength
  return { gates, depth, wireLength, score }
}

/**
 * Profundidade combinacional: maior cadeia de portas fonte→sink. Reconstrói
 * nets de fios (adjacentes com lados complementares, como o motor) e resolve
 * as profundidades por relaxação iterativa.
 */
function extractDepth(level: LevelSpec, board: BoardState): number {
  const width = level.grid.width
  const height = level.grid.height
  const occupancy = new Map<string, Cell>()
  for (const fixed of level.fixedCells) {
    const { x, y } = fixed.coord
    occupancy.set(key(x, y), fixed.cell)
  }
  for (const placed of board.placedCells) {
    const { x, y } = placed.coord
    if (!occupancy.has(key(x, y))) occupancy.set(key(x, y), placed.cell)
  }

  const neighbor = (x: number, y: number, side: Direction): Coord | undefined => {
    const [dx, dy] = DELTA[side] as readonly [number, number]
    const nx = x + dx
    const ny = y + dy
    return nx >= 0 && ny >= 0 && nx < width && ny < height ? { x: nx, y: ny } : undefined
  }

  // Union de fios adjacentes com lados complementares.
  const parent = new Map<string, string>()
  const find = (k: string): string => {
    const p = parent.get(k)
    if (p === undefined || p === k) {
      parent.set(k, k)
      return k
    }
    const root = find(p)
    parent.set(k, root)
    return root
  }
  const union = (a: string, b: string): void => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(rb, ra)
  }

  for (const [k, cell] of occupancy) {
    if (cell.kind !== 'wire') continue
    const comma = k.indexOf(',')
    const x = Number(k.slice(0, comma))
    const y = Number(k.slice(comma + 1))
    for (const side of cell.sides) {
      const nb = neighbor(x, y, side)
      if (!nb) continue
      const nbCell = occupancy.get(key(nb.x, nb.y))
      if (!nbCell || nbCell.kind !== 'wire') continue
      if (!nbCell.sides.includes(OPPOSITE[side])) continue
      union(k, key(nb.x, nb.y))
    }
  }

  const netOfWire = new Map<string, number>()
  const netRoot = new Map<string, number>()
  let nextNet = 0
  for (const [k, cell] of occupancy) {
    if (cell.kind !== 'wire') continue
    const root = find(k)
    let id = netRoot.get(root)
    if (id === undefined) {
      id = nextNet++
      netRoot.set(root, id)
    }
    netOfWire.set(k, id)
  }

  // Net -> drivers (fonte/porta cuja saída encosta num fio da net).
  const netDrivers = new Map<number, Coord[]>()
  for (const [k, cell] of occupancy) {
    if (cell.kind !== 'source' && cell.kind !== 'gate') continue
    const outSide = cell.kind === 'source' ? cell.outputSide : cell.outputSide
    const comma = k.indexOf(',')
    const x = Number(k.slice(0, comma))
    const y = Number(k.slice(comma + 1))
    const nb = neighbor(x, y, outSide)
    if (!nb) continue
    const nbCell = occupancy.get(key(nb.x, nb.y))
    if (!nbCell || nbCell.kind !== 'wire') continue
    if (!nbCell.sides.includes(OPPOSITE[outSide])) continue
    const id = netOfWire.get(key(nb.x, nb.y))
    if (id === undefined) continue
    const list = netDrivers.get(id)
    if (list) list.push({ x, y })
    else netDrivers.set(id, [{ x, y }])
  }

  // Profundidade por relaxação iterativa.
  const gateCoords = new Map<string, Coord>()
  const depthOf = new Map<string, number>() // portas resolvidas (>= 1)
  for (const [k, cell] of occupancy) {
    if (cell.kind !== 'gate') continue
    const comma = k.indexOf(',')
    gateCoords.set(k, { x: Number(k.slice(0, comma)), y: Number(k.slice(comma + 1)) })
  }

  const sourceValueOfInput = (gateCell: Cell, x: number, y: number): { depth: number } | undefined => {
    // Retorna undefined enquanto a fonte da entrada não estiver resolvida.
    const inputDepths: number[] = []
    for (const side of (gateCell as { inputSides: readonly Direction[] }).inputSides) {
      const nb = neighbor(x, y, side)
      if (!nb) return undefined // entrada fora do grid: sem driver
      const nbCell = occupancy.get(key(nb.x, nb.y))
      const reverse = OPPOSITE[side]
      if (!nbCell) return undefined
      if (nbCell.kind === 'source') {
        inputDepths.push(0)
        continue
      }
      if (nbCell.kind === 'gate' && nbCell.outputSide === reverse) {
        const d = depthOf.get(key(nb.x, nb.y))
        if (d === undefined) return undefined
        inputDepths.push(d)
        continue
      }
      if (nbCell.kind === 'wire') {
        if (!nbCell.sides.includes(reverse)) return undefined
        const id = netOfWire.get(key(nb.x, nb.y))
        if (id === undefined) return undefined
        const drivers = netDrivers.get(id) ?? []
        if (drivers.length === 0) return undefined
        let best: number | undefined
        for (const driver of drivers) {
          const driverCell = occupancy.get(key(driver.x, driver.y))
          if (!driverCell) continue
          if (driverCell.kind === 'source') {
            best = best === undefined ? 0 : Math.max(best, 0)
          } else if (driverCell.kind === 'gate') {
            const d = depthOf.get(key(driver.x, driver.y))
            if (d === undefined) return undefined
            best = best === undefined ? d : Math.max(best, d)
          }
        }
        if (best === undefined) return undefined
        inputDepths.push(best)
        continue
      }
      return undefined // porta/sink vizinho sem encaixe: entrada ausente
    }
    return { depth: inputDepths.length === 0 ? 0 : Math.max(...inputDepths) }
  }

  let changed = true
  let maxDepth = 0
  let guard = 0
  while (changed && guard < occupancy.size * 2) {
    changed = false
    guard++
    for (const [k, coord] of gateCoords) {
      if (depthOf.has(k)) continue
      const cell = occupancy.get(k)
      if (!cell || cell.kind !== 'gate') continue
      const resolved = sourceValueOfInput(cell, coord.x, coord.y)
      if (resolved === undefined) continue
      depthOf.set(k, resolved.depth + 1)
      maxDepth = Math.max(maxDepth, resolved.depth + 1)
      changed = true
    }
  }
  return maxDepth
}
