// Solver/validador de fases (MI-05, SDD §9.4): prova que um `LevelSpec` tem
// solução dentro do inventário e devolve essa solução como `BoardState`.
//
// Estratégia — decomposição por regiões livres: as fases geradas (e fases de
// corredor em geral) têm o tabuleiro podado por paredes, de modo que cada
// componente conexa de células livres contém exatamente UM driver (source ou
// saída de porta) e seus leitores (entradas de porta/sink). Conectar driver →
// leitores dentro da própria região nunca cria curto nem ciclo, então a busca
// de caminho é independente por região (BFS determinística) e o resultado é
// validado no fim pelo motor de simulação — nada é "chutado".
//
// Limitações assumidas: regiões com 2+ drivers não são resolvidas (exigiriam
// busca de topologia — fica como extensão futura; fases geradas nunca as
// produzem). Portas a colocar pelo jogador (inventário de portas > 0) também
// ficam fora do escopo do v1 do solver.

import type { BoardState, Cell, Coord, Direction, FixedCell, LevelSpec, PlacedCell, WireCell } from '../model'
import { simulate } from '../sim'

export type SolveFailureReason = 'topology-unsupported' | 'no-route' | 'wire-limit' | 'not-satisfied'

export interface SolveResult {
  readonly solved: boolean
  /** Solução válida quando `solved === true` (fios posicionados). */
  readonly board?: BoardState
  readonly wiresUsed?: number
  readonly reason?: SolveFailureReason
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

const DIRS: readonly Direction[] = ['N', 'E', 'S', 'W']

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

interface Pin {
  readonly cell: Coord
  readonly driver: boolean
  readonly reader: boolean
}

interface Region {
  readonly id: number
  readonly cells: Map<string, Coord>
  readonly pins: Pin[]
}

export function solveLevel(level: LevelSpec): SolveResult {
  const width = level.grid.width
  const height = level.grid.height
  const occupancy = new Map<string, FixedCell>()

  for (const fixed of level.fixedCells) {
    const { x, y } = fixed.coord
    if (x >= 0 && y >= 0 && x < width && y < height) occupancy.set(key(x, y), fixed)
  }

  // ---- flood fill das regiões livres --------------------------------------
  const regionByCell = new Map<string, number>()
  const regions: Region[] = []
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const k = key(x, y)
      if (regionByCell.has(k) || occupancy.has(k)) continue
      const id = regions.length
      const cells = new Map<string, Coord>()
      const queue: Coord[] = [{ x, y }]
      regionByCell.set(k, id)
      cells.set(k, { x, y })
      while (queue.length > 0) {
        const cur = queue.shift() as Coord
        for (const dir of DIRS) {
          const [dx, dy] = DELTA[dir] as readonly [number, number]
          const nx = cur.x + dx
          const ny = cur.y + dy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          const nk = key(nx, ny)
          if (regionByCell.has(nk) || occupancy.has(nk)) continue
          regionByCell.set(nk, id)
          cells.set(nk, { x: nx, y: ny })
          queue.push({ x: nx, y: ny })
        }
      }
      regions.push({ id, cells, pins: [] })
    }
  }

  // ---- pinos: terminais fixos que encostam numa célula livre ---------------
  const fixedList = [...occupancy.values()].sort((a, b) => a.coord.y - b.coord.y || a.coord.x - b.coord.x)
  for (const fixed of fixedList) {
    const cell = fixed.cell
    const sides = activeSides(cell)
    if (cell.kind === 'empty') continue
    for (const side of sides) {
      const [dx, dy] = DELTA[side] as readonly [number, number]
      const nx = fixed.coord.x + dx
      const ny = fixed.coord.y + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const nk = key(nx, ny)
      const regionId = regionByCell.get(nk)
      if (regionId === undefined) {
        // Vizinho ocupado: conexão direta é decidida pelo motor; nada a rotear.
        continue
      }
      const isDriver =
        (cell.kind === 'source' && side === cell.outputSide) ||
        (cell.kind === 'gate' && side === cell.outputSide)
      const isReader =
        (cell.kind === 'gate' && cell.inputSides.includes(side)) ||
        (cell.kind === 'sink' && side === cell.inputSide)
      const pin: Pin = { cell: { x: nx, y: ny }, driver: isDriver, reader: isReader }
      ;(regions[regionId] as Region).pins.push(pin)
    }
  }

  // ---- roteamento por região ------------------------------------------------
  const wireCells = new Set<string>()
  const netByCell = new Map<string, number>()
  let wireCount = 0

  for (const region of regions) {
    const drivers = region.pins.filter(p => p.driver)
    const readers = region.pins.filter(p => p.reader)
    if (drivers.length === 0 && readers.length === 0) continue
    if (drivers.length !== 1) {
      return { solved: false, reason: drivers.length > 1 ? 'topology-unsupported' : 'no-route' }
    }
    if (readers.length === 0) continue // região sem leitor: nada obrigatório

    const driverCell = (drivers[0] as Pin).cell
    const connected = new Set<string>([key(driverCell.x, driverCell.y)])
    wireCells.add(key(driverCell.x, driverCell.y))
    netByCell.set(key(driverCell.x, driverCell.y), region.id)

    const readerPins = [...readers].sort((a, b) => a.cell.y - b.cell.y || a.cell.x - b.cell.x)
    for (const reader of readerPins) {
      const rk = key(reader.cell.x, reader.cell.y)
      if (connected.has(rk)) continue
      const path = bfsToConnected(reader.cell, connected, region, regionByCell, occupancy, width, height)
      if (path === null) return { solved: false, reason: 'no-route' }
      for (const c of path) {
        const ck = key(c.x, c.y)
        wireCells.add(ck)
        netByCell.set(ck, region.id)
        connected.add(ck)
      }
    }
  }

  // ---- derivação dos lados de cada fio -------------------------------------
  const placed: PlacedCell[] = []
  for (const ck of wireCells) {
    const comma = ck.indexOf(',')
    const x = Number(ck.slice(0, comma))
    const y = Number(ck.slice(comma + 1))
    const netId = netByCell.get(ck)
    const sides: Direction[] = []
    for (const dir of DIRS) {
      const [dx, dy] = DELTA[dir] as readonly [number, number]
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const nk = key(nx, ny)
      if (netId !== undefined && netByCell.get(nk) === netId) {
        sides.push(dir)
        continue
      }
      const neighbor = occupancy.get(nk)
      if (neighbor && activeSides(neighbor.cell).includes(OPPOSITE[dir] as Direction)) {
        sides.push(dir)
      }
    }
    if (sides.length < 2) {
      // Fio órfão/terminal não conectado: não forma caminho válido.
      return { solved: false, reason: 'no-route' }
    }
    const wire: WireCell = { kind: 'wire', sides }
    placed.push({ coord: { x, y }, cell: wire })
  }
  placed.sort((a, b) => a.coord.y - b.coord.y || a.coord.x - b.coord.x)

  // ---- inventário e verificação pelo motor ---------------------------------
  const wires = placed.length
  const limit = level.inventory.wires
  if (limit !== null && wires > limit) {
    return { solved: false, reason: 'wire-limit' }
  }

  const board: BoardState = { levelId: level.id, placedCells: placed }
  // Paredes (`fixedCells` kind 'empty') são eletricamente inertes: sem lados,
  // sem fios sobre elas. O motor de simulação (MI-03) ainda não as tolera, então
  // a verificação roda sobre uma cópia sem paredes — resultado idêntico.
  const electricSpec: LevelSpec = { ...level, fixedCells: level.fixedCells.filter(f => f.cell.kind !== 'empty') }
  const result = simulate(electricSpec, board)
  if (!result.ok || result.sinks.some(s => !s.satisfied)) {
    return { solved: false, reason: 'not-satisfied' }
  }
  return { solved: true, board, wiresUsed: wires }
}

/** BFS determinística (ordem fixa de vizinhos, FIFO) até qualquer célula conectada. */
function bfsToConnected(
  start: Coord,
  connected: ReadonlySet<string>,
  region: Region,
  regionByCell: ReadonlyMap<string, number>,
  occupancy: ReadonlyMap<string, FixedCell>,
  width: number,
  height: number,
): Coord[] | null {
  const startKey = key(start.x, start.y)
  if (connected.has(startKey)) return [start]
  const parent = new Map<string, string>()
  const visited = new Set<string>([startKey])
  const queue: Coord[] = [start]

  while (queue.length > 0) {
    const cur = queue.shift() as Coord
    for (const dir of DIRS) {
      const [dx, dy] = DELTA[dir] as readonly [number, number]
      const nx = cur.x + dx
      const ny = cur.y + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const nk = key(nx, ny)
      if (regionByCell.get(nk) !== region.id) continue
      if (visited.has(nk)) continue
      parent.set(nk, key(cur.x, cur.y))
      if (connected.has(nk)) {
        return rebuildPath(start, nk, parent)
      }
      visited.add(nk)
      queue.push({ x: nx, y: ny })
    }
  }
  return null
}

function rebuildPath(start: Coord, endKey: string, parent: ReadonlyMap<string, string>): Coord[] {
  const path: Coord[] = []
  let cur: string | undefined = endKey
  while (cur !== undefined) {
    const comma = cur.indexOf(',')
    path.push({ x: Number(cur.slice(0, comma)), y: Number(cur.slice(comma + 1)) })
    if (cur === key(start.x, start.y)) break
    cur = parent.get(cur)
  }
  return path
}
