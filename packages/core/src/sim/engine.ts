// Motor de simulação por nets (SDD §4). Diagnósticos como dados, nunca
// exceções:
//   - wires adjacentes com lados declarados complementares formam nets
//     (union-find); uma net é um único nó elétrico (SDD §3.2).
//   - dois drivers na mesma net/junção => issue 'short' (curto-circuito).
//   - realimentação combinacional (dependência cíclica entre portas) => 'cycle'
//     (nunca confundida com curto — SDD §4.5).
//   - net sem driver alimentando leitores => 'floating'.
//   - porta com entrada(s) em falta => 'unpowered-gate'.
// Avaliação determinística em ordem topológica, com traço passo-a-passo
// opcional para a animação (MI-08). Sem dependência de DOM.

import type {
  BoardState,
  Cell,
  Coord,
  Direction,
  GateCell,
  GateType,
  IssueKind,
  LevelSpec,
  Signal,
  SimulationIssue,
  SimulationResult,
  SinkStatus,
} from '../model'

// ---------------------------------------------------------------------------
// Geometria
// ---------------------------------------------------------------------------

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

/** Lados ativos de uma célula — os únicos que podem formar conexão. */
function activeSides(cell: Cell): readonly Direction[] {
  switch (cell.kind) {
    case 'source':
      return [cell.outputSide]
    case 'sink':
      return [cell.inputSide]
    case 'gate':
      return [...cell.inputSides, cell.outputSide]
    case 'wire':
      return cell.sides
    default:
      // Células vazias nunca ocupam o mapa de simulação.
      return []
  }
}

function isDriverSide(cell: Cell, side: Direction): boolean {
  return (
    (cell.kind === 'source' && cell.outputSide === side) ||
    (cell.kind === 'gate' && cell.outputSide === side)
  )
}

function coordKey(x: number, y: number): string {
  return `${x},${y}`
}

/** Converte "x,y" de volta em Coord (evita `map(Number)` com índices opcionais). */
function parseCoordKey(key: string): Coord {
  const comma = key.indexOf(',')
  return { x: Number(key.slice(0, comma)), y: Number(key.slice(comma + 1)) }
}

function cellSort(a: Coord, b: Coord): number {
  return a.y - b.y || a.x - b.x
}

function uniqueCoords(cells: readonly Coord[]): Coord[] {
  const seen = new Set<string>()
  const out: Coord[] = []
  for (const c of cells) {
    const key = coordKey(c.x, c.y)
    if (!seen.has(key)) {
      seen.add(key)
      out.push(c)
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Modelo interno
// ---------------------------------------------------------------------------

type DriverRef =
  | { readonly kind: 'source'; readonly coord: Coord; readonly value: 0 | 1 }
  | { readonly kind: 'gate'; readonly coord: Coord }

interface Net {
  readonly id: number
  readonly wires: Coord[]
  readonly drivers: DriverRef[]
  readonly sinks: Coord[]
  readonly gateInputs: Coord[]
}

interface BuiltGraph {
  readonly nets: Net[]
  readonly netByWire: Map<string, number>
  /** driver (coord) -> leitores diretos sem fio entre eles */
  readonly directEdges: Map<string, Array<{ reader: Coord; readerKind: 'sink' | 'gate' }>>
  /** pares driver-driver adjacentes (junção => curto) */
  readonly driverJunctions: Coord[][]
}

function buildOccupancy(level: LevelSpec, board: BoardState): Map<string, Cell> {
  const cells = new Map<string, Cell>()
  const { width, height } = level.grid
  for (const fixed of level.fixedCells) {
    const { x, y } = fixed.coord
    if (x >= 0 && y >= 0 && x < width && y < height) cells.set(coordKey(x, y), fixed.cell)
  }
  // Peças do jogador nunca sobrescrevem células fixas (SDD §6.3).
  for (const placed of board.placedCells) {
    const { x, y } = placed.coord
    if (x >= 0 && y >= 0 && x < width && y < height && !cells.has(coordKey(x, y))) {
      cells.set(coordKey(x, y), placed.cell)
    }
  }
  return cells
}

class UnionFind {
  private readonly parent = new Map<string, string>()

  find(key: string): string {
    const root = this.parent.get(key)
    if (root === undefined || root === key) {
      this.parent.set(key, key)
      return key
    }
    const found = this.find(root)
    this.parent.set(key, found)
    return found
  }

  union(a: string, b: string): void {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra !== rb) this.parent.set(rb, ra)
  }
}

function buildGraph(level: LevelSpec, board: BoardState): BuiltGraph {
  const cells = buildOccupancy(level, board)
  const { width, height } = level.grid

  const inBounds = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < width && y < height

  const neighbor = (x: number, y: number, side: Direction): { x: number; y: number } | undefined => {
    const [dx, dy] = DELTA[side]
    const nx = x + dx
    const ny = y + dy
    return inBounds(nx, ny) ? { x: nx, y: ny } : undefined
  }

  // 1) Union-find entre fios com lados complementares.
  const uf = new UnionFind()
  const wireKeys: string[] = []
  for (const [key, cell] of cells) {
    if (cell.kind !== 'wire') continue
    wireKeys.push(key)
    const { x, y } = parseCoordKey(key)
    for (const side of cell.sides) {
      const nb = neighbor(x, y, side)
      if (!nb) continue
      const nbCell = cells.get(coordKey(nb.x, nb.y))
      if (!nbCell || nbCell.kind !== 'wire') continue
      if (!nbCell.sides.includes(OPPOSITE[side])) continue
      uf.union(key, coordKey(nb.x, nb.y))
    }
  }

  const wiresByNet = new Map<string, Coord[]>()
  for (const key of wireKeys) {
    const root = uf.find(key)
    const { x, y } = parseCoordKey(key)
    const list = wiresByNet.get(root)
    if (list) list.push({ x, y })
    else wiresByNet.set(root, [{ x, y }])
  }

  const nets: Net[] = []
  const netByWire = new Map<string, number>()
  for (const root of [...wiresByNet.keys()].sort()) {
    const id = nets.length
    const wires = (wiresByNet.get(root) ?? []).sort(cellSort)
    nets.push({ id, wires, drivers: [], sinks: [], gateInputs: [] })
    for (const w of wires) netByWire.set(coordKey(w.x, w.y), id)
  }

  const directEdges = new Map<
    string,
    Array<{ reader: Coord; readerKind: 'sink' | 'gate' }>
  >()
  const driverJunctions: Coord[][] = []

  const netIdOfNeighborWire = (x: number, y: number, side: Direction): number | undefined => {
    const nb = neighbor(x, y, side)
    if (!nb) return undefined
    const nbCell = cells.get(coordKey(nb.x, nb.y))
    if (!nbCell || nbCell.kind !== 'wire') return undefined
    if (!nbCell.sides.includes(OPPOSITE[side])) return undefined
    return netByWire.get(coordKey(nb.x, nb.y))
  }

  const sortedKeys = [...cells.keys()].sort()
  for (const key of sortedKeys) {
    const cell = cells.get(key) as Cell
    const { x, y } = parseCoordKey(key)

    if (cell.kind === 'wire') continue

    if (cell.kind === 'sink') {
      const netId = netIdOfNeighborWire(x, y, cell.inputSide)
      if (netId !== undefined) nets[netId]!.sinks.push({ x, y })
      continue
    }

    if (cell.kind === 'gate') {
      for (const side of cell.inputSides) {
        const netId = netIdOfNeighborWire(x, y, side)
        if (netId !== undefined) nets[netId]!.gateInputs.push({ x, y })
      }
    }

    // Driver (source ou saída de porta).
    const outSide = cell.kind === 'source' ? cell.outputSide : (cell as GateCell).outputSide
    const nb = neighbor(x, y, outSide)
    if (!nb) continue
    const nbCell = cells.get(coordKey(nb.x, nb.y))
    if (!nbCell) continue
    const reverse = OPPOSITE[outSide]

    if (nbCell.kind === 'wire') {
      if (!nbCell.sides.includes(reverse)) continue
      const netId = netByWire.get(coordKey(nb.x, nb.y))
      if (netId === undefined) continue
      const driver: DriverRef =
        cell.kind === 'source'
          ? { kind: 'source', coord: { x, y }, value: cell.value }
          : { kind: 'gate', coord: { x, y } }
      nets[netId]!.drivers.push(driver)
      continue
    }

    const nbActive = activeSides(nbCell)
    if (!nbActive.includes(reverse)) continue

    if (isDriverSide(nbCell, reverse)) {
      // Dois drivers cara a cara: junção => curto.
      driverJunctions.push([{ x, y }, { x: nb.x, y: nb.y }])
      continue
    }

    if (nbCell.kind === 'sink') {
      const list = directEdges.get(key)
      const entry = { reader: { x: nb.x, y: nb.y }, readerKind: 'sink' as const }
      if (list) list.push(entry)
      else directEdges.set(key, [entry])
    } else if (nbCell.kind === 'gate' && nbCell.inputSides.includes(reverse)) {
      const list = directEdges.get(key)
      const entry = { reader: { x: nb.x, y: nb.y }, readerKind: 'gate' as const }
      if (list) list.push(entry)
      else directEdges.set(key, [entry])
    }
  }

  for (const net of nets) {
    net.drivers.sort((a, b) => cellSort(a.coord, b.coord))
    net.sinks.sort(cellSort)
    net.gateInputs.sort(cellSort)
  }
  for (const list of directEdges.values()) {
    list.sort((a, b) => cellSort(a.reader, b.reader))
  }

  return { nets, netByWire, directEdges, driverJunctions }
}

// ---------------------------------------------------------------------------
// Portas lógicas
// ---------------------------------------------------------------------------

export function evaluateGate(gate: GateType, inputs: readonly Signal[]): 0 | 1 {
  switch (gate) {
    case 'NOT':
      return inputs[0] === 0 ? 1 : 0
    case 'AND':
      return inputs[0] === 1 && inputs[1] === 1 ? 1 : 0
    case 'OR':
      return inputs[0] === 1 || inputs[1] === 1 ? 1 : 0
  }
}

// ---------------------------------------------------------------------------
// Avaliação
// ---------------------------------------------------------------------------

export interface SimTraceStep {
  /** Células que receberam sinal neste passo (porta e/ou fios da net). */
  readonly cells: readonly Coord[]
}

export interface SimTraceResult {
  readonly result: SimulationResult
  /** Traço da propagação em passos (SDD §4.7) — vazio sem `trace: true`. */
  readonly trace: readonly SimTraceStep[]
}

type GateInput =
  | { readonly status: 'fixed'; readonly value: 0 | 1 }
  | { readonly status: 'dep'; readonly gate: Coord }
  | { readonly status: 'missing'; readonly reason: 'bare' | 'floating' | 'short' }

interface GateState {
  readonly coord: Coord
  readonly gate: GateType
  inputs: GateInput[]
  resolved: boolean
  output: Signal
  readonly drivenNets: number[]
}

export function simulate(
  level: LevelSpec,
  board: BoardState,
  opts: { readonly trace?: boolean } = {},
): SimulationResult {
  return simulateWithTrace(level, board, opts).result
}

export function simulateWithTrace(
  level: LevelSpec,
  board: BoardState,
  opts: { readonly trace?: boolean } = {},
): SimTraceResult {
  const wantTrace = opts.trace === true
  const trace: SimTraceStep[] = []
  const issues: SimulationIssue[] = []
  const issueSeen = new Set<string>()

  function addIssue(kind: IssueKind, cellsIn: readonly Coord[]): void {
    const cells = uniqueCoords(cellsIn).sort(cellSort)
    if (cells.length === 0) return
    const key = `${kind}:${cells.map(c => coordKey(c.x, c.y)).join('|')}`
    if (issueSeen.has(key)) return
    issueSeen.add(key)
    issues.push({ kind, cells })
  }

  const graph = buildGraph(level, board)
  const { nets, netByWire, driverJunctions } = graph
  const cells = buildOccupancy(level, board)

  // ---- estado das nets ----------------------------------------------------
  const netValue = new Map<number, 0 | 1 | 'SHORT' | undefined>()

  for (const net of nets) {
    if (net.drivers.length >= 2) {
      // Curto-circuito: dois ou mais drivers brigando na mesma net (SDD §4.5).
      netValue.set(net.id, 'SHORT')
      addIssue('short', [...net.drivers.map(d => d.coord), ...net.wires])
    }
  }

  for (const pair of driverJunctions) {
    addIssue('short', pair)
  }

  // Nets dirigidas por fonte resolvem de imediato.
  const sourceStep: Coord[] = []
  for (const net of nets) {
    if (netValue.get(net.id) === 'SHORT') continue
    const sources = net.drivers.filter(d => d.kind === 'source')
    const gateDrivers = net.drivers.filter(d => d.kind === 'gate')
    if (sources.length === 1 && gateDrivers.length === 0) {
      const value = (sources[0] as { value: 0 | 1 }).value
      netValue.set(net.id, value)
      for (const w of net.wires) sourceStep.push(w)
    } else if (sources.length === 0 && gateDrivers.length === 0) {
      // Net sem driver: flutuante se alguém a lê (SDD §4.4).
      const hasReaders = net.sinks.length > 0 || net.gateInputs.length > 0
      if (hasReaders) {
        netValue.set(net.id, undefined)
        addIssue('floating', [...net.wires, ...net.sinks])
      }
    }
  }
  if (wantTrace && sourceStep.length > 0) trace.push({ cells: sourceStep })

  // ---- portas -------------------------------------------------------------
  const gatesByCoord = new Map<string, GateState>()

  for (const [key, cell] of cells) {
    if (cell.kind !== 'gate') continue
    const { x, y } = parseCoordKey(key)
    gatesByCoord.set(key, {
      coord: { x, y },
      gate: cell.gate,
      inputs: [],
      resolved: false,
      output: undefined,
      drivenNets: [],
    })
  }

  // Monta as entradas de cada porta (valor fixo, dependência ou falta).
  for (const [key, state] of gatesByCoord) {
    const { x, y } = parseCoordKey(key)
    const gateCell = cells.get(key) as GateCell
    const inputs: GateInput[] = gateCell.inputSides.map(side => {
      const [dx, dy] = DELTA[side]
      const nx = x + dx
      const ny = y + dy
      const nbCell = cells.get(coordKey(nx, ny))
      const reverse = OPPOSITE[side]
      if (!nbCell) return { status: 'missing', reason: 'bare' } as const

      if (nbCell.kind === 'wire') {
        if (!nbCell.sides.includes(reverse)) return { status: 'missing', reason: 'bare' } as const
        const netId = netByWire.get(coordKey(nx, ny))
        if (netId === undefined) return { status: 'missing', reason: 'bare' } as const
        const value = netValue.get(netId)
        if (value === 'SHORT') return { status: 'missing', reason: 'short' } as const
        if (value === undefined) {
          const net = nets[netId]!
          const gateDrivers = net.drivers.filter(d => d.kind === 'gate')
          if (net.drivers.length === 1 && gateDrivers.length === 1) {
            const gd = gateDrivers[0]!
            return { status: 'dep', gate: gd.coord } as const
          }
          return { status: 'missing', reason: 'floating' } as const
        }
        return { status: 'fixed', value } as const
      }

      // Vizinho não-fio: conexão exige lado ativo complementar.
      const nbActive = activeSides(nbCell)
      if (!nbActive.includes(reverse)) return { status: 'missing', reason: 'bare' } as const
      if (nbCell.kind === 'source') {
        return { status: 'fixed', value: nbCell.value } as const
      }
      if (nbCell.kind === 'gate' && isDriverSide(nbCell, reverse)) {
        return { status: 'dep', gate: { x: nx, y: ny } } as const
      }
      return { status: 'missing', reason: 'bare' } as const
    })
    state.inputs = inputs
  }

  // Nets dirigidas por porta (para propagar valor e traço quando ela resolve).
  for (const net of nets) {
    for (const driver of net.drivers) {
      if (driver.kind !== 'gate') continue
      const state = gatesByCoord.get(coordKey(driver.coord.x, driver.coord.y))
      if (state) state.drivenNets.push(net.id)
    }
  }

  // ---- resolução topológica (Kahn) ----------------------------------------
  const queue: GateState[] = []

  function markReady(state: GateState): void {
    if (state.resolved) return
    for (const input of state.inputs) {
      if (input.status === 'missing') return
      if (input.status === 'dep') {
        const dep = gatesByCoord.get(coordKey(input.gate.x, input.gate.y))
        if (!dep || !dep.resolved) return
      }
    }
    state.resolved = true
    queue.push(state)
  }

  for (const state of gatesByCoord.values()) markReady(state)

  while (queue.length > 0) {
    const gate = queue.shift() as GateState
    const values: Signal[] = gate.inputs.map(input => {
      if (input.status === 'fixed') return input.value
      if (input.status !== 'dep') return undefined
      const dep = gatesByCoord.get(coordKey(input.gate.x, input.gate.y))
      return dep && dep.resolved ? dep.output : undefined
    })
    gate.output = evaluateGate(gate.gate, values as [Signal, ...Signal[]])

    const stepCells: Coord[] = [gate.coord]
    for (const netId of gate.drivenNets) {
      if (netValue.get(netId) === 'SHORT') continue
      netValue.set(netId, gate.output)
      for (const w of nets[netId]!.wires) stepCells.push(w)
    }
    if (wantTrace) trace.push({ cells: uniqueCoords(stepCells) })

    for (const state of gatesByCoord.values()) markReady(state)
  }

  // ---- sobras: ciclos e portas sem energia ---------------------------------
  const leftover = [...gatesByCoord.values()].filter(g => !g.resolved)

  function unresolvedDep(state: GateState): GateState[] {
    const targets: GateState[] = []
    for (const input of state.inputs) {
      if (input.status !== 'dep') continue
      const dep = gatesByCoord.get(coordKey(input.gate.x, input.gate.y))
      if (dep && !dep.resolved) targets.push(dep)
    }
    return targets
  }

  // Ciclo combinacional: fecho de portas que só dependem de portas que
  // tampouco resolveram. Portas com entrada estrutural em falta (bare/
  // floating/short) caem fora do fecho.
  const cyclic = new Set(leftover)
  let changed = true
  while (changed) {
    changed = false
    for (const g of [...cyclic]) {
      const hasMissing = g.inputs.some(input => input.status === 'missing')
      const depsAllInside = unresolvedDep(g).every(d => cyclic.has(d))
      if (hasMissing || !depsAllInside) {
        cyclic.delete(g)
        changed = true
      }
    }
  }

  if (cyclic.size > 0) {
    const cyclicKeys = new Set(
      [...cyclic].map(g => coordKey(g.coord.x, g.coord.y)),
    )
    const cycleCells: Coord[] = []
    for (const g of cyclic) cycleCells.push(g.coord)
    // Fios que formam os laços de realimentação (nets ligando portas cíclicas).
    for (const net of nets) {
      const drivesCycle = net.drivers.some(
        d => d.kind === 'gate' && cyclicKeys.has(coordKey(d.coord.x, d.coord.y)),
      )
      const readByCycle = net.gateInputs.some(c => cyclicKeys.has(coordKey(c.x, c.y)))
      if (drivesCycle && readByCycle) {
        for (const w of net.wires) cycleCells.push(w)
      }
    }
    addIssue('cycle', cycleCells)
  }

  for (const g of leftover) {
    if (cyclic.has(g)) continue
    // Porta sem energia: falta alguma entrada. Causa estrutural já registrada
    // (floating/short da net); aqui marcamos a própria porta.
    const hasMissing = g.inputs.some(input => input.status === 'missing')
    const missingDueToShort = g.inputs.some(
      input => input.status === 'missing' && input.reason === 'short',
    )
    if (hasMissing && !missingDueToShort) {
      addIssue('unpowered-gate', [g.coord])
    }
  }

  // ---- sinks ----------------------------------------------------------------
  const sinkStatuses: SinkStatus[] = []

  for (const fixed of level.fixedCells) {
    if (fixed.cell.kind !== 'sink') continue
    const sink = fixed.cell
    const { x, y } = fixed.coord

    let actual: Signal
    const [dx, dy] = DELTA[sink.inputSide]
    const nx = x + dx
    const ny = y + dy
    const nbCell = cells.get(coordKey(nx, ny))
    const reverse = OPPOSITE[sink.inputSide]

    if (!nbCell) {
      actual = undefined
      addIssue('floating', [{ x, y }])
    } else if (nbCell.kind === 'wire') {
      if (!nbCell.sides.includes(reverse)) {
        actual = undefined
        addIssue('floating', [{ x, y }])
      } else {
        const netId = netByWire.get(coordKey(nx, ny))
        const value = netId === undefined ? undefined : netValue.get(netId)
        actual = value === undefined || value === 'SHORT' ? undefined : value
      }
    } else if (nbCell.kind === 'source') {
      actual = isDriverSide(nbCell, reverse) ? nbCell.value : undefined
      if (actual === undefined) addIssue('floating', [{ x, y }])
    } else if (nbCell.kind === 'gate' && isDriverSide(nbCell, reverse)) {
      const driver = gatesByCoord.get(coordKey(nx, ny))
      actual = driver && driver.resolved ? driver.output : undefined
    } else {
      actual = undefined
      addIssue('floating', [{ x, y }])
    }

    sinkStatuses.push({
      coord: { x, y },
      expected: sink.expected,
      actual,
      satisfied: actual === sink.expected,
    })
  }

  const ok = issues.length === 0 && sinkStatuses.every(s => s.satisfied)
  return {
    result: { ok, sinks: sinkStatuses, issues },
    trace,
  }
}
