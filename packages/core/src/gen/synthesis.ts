// Síntese física da fase gerada (MI-05, SDD §9.4): transforma o alvo lógico
// (CircuitSpec) num `LevelSpec` concreto sobre o grid.
//
// Geometria canônica: fluxo da esquerda (sources) para a direita (sink).
// Cada variável ocupa uma "trilha" (linha r_i = 1 + 3i); merges AND/OR sobem
// a variável seguinte pela lateral (lado S) da porta; cadeias de NOT ficam
// adjacentes à própria fonte/porta (blocos fixos de lógica). Entre blocos
// fixos, corredores de 1 célula de largura são **podados** (paredes = células
// fixas `empty` ao redor de todo trecho livre), e a saída termina numa
// "praça" aberta (3 linhas × largura variável) antes do sink — o único ponto
// com escolha real de rota.
//
// As paredes tornam a topologia legível e garantem que cada região livre
// contenha exatamente um driver e um leitor: é isso que permite ao solver
// provar solvabilidade com busca de caminho por região, sem explodir.

import type { Cell, Coord, FixedCell, LevelHints, LevelSpec } from '../model'
import { LEVEL_SCHEMA_VERSION } from '../model'
import type { CircuitSpec } from './expression'
import { countGates, evaluateSpec } from './expression'

export interface SynthesisConfig {
  readonly inputs: number
  readonly gates: number
  /** Largura (em células) da praça aberta antes do sink. */
  readonly plazaWidth: number
}

/** Configurações por dificuldade 1..5 (crescente em portas e rota). */
export const DIFFICULTY_CONFIGS: Readonly<Record<number, SynthesisConfig>> = {
  1: { inputs: 1, gates: 1, plazaWidth: 3 },
  2: { inputs: 2, gates: 2, plazaWidth: 4 },
  3: { inputs: 2, gates: 3, plazaWidth: 5 },
  4: { inputs: 3, gates: 4, plazaWidth: 6 },
  5: { inputs: 3, gates: 5, plazaWidth: 7 },
}

export const MAX_DIFFICULTY = 5

const key = (x: number, y: number): string => `${x},${y}`

function coordSort(a: Coord, b: Coord): number {
  return a.y - b.y || a.x - b.x
}

export interface Candidate {
  readonly width: number
  readonly height: number
  /** Células fixas (sources, portas, sink e paredes `empty`). */
  readonly fixed: readonly FixedCell[]
  /** Células livres (corredores + praça). */
  readonly free: ReadonlySet<string>
}

function gateCell(gate: 'AND' | 'OR' | 'NOT', inputSides: readonly ('N' | 'S' | 'E' | 'W')[]): Cell {
  return { kind: 'gate', gate, rotation: 'E', inputSides, outputSide: 'E' }
}

/**
 * Constrói o tabuleiro podado (paredes + células fixas) para um alvo e uma
 * linha da tabela-verdade. Toda célula não usada por corredor/praça vira
 * parede — é a "poda" do SDD §9.4.
 */
export function buildCandidate(
  cfg: SynthesisConfig,
  target: CircuitSpec,
  row: readonly (0 | 1)[],
): Candidate {
  const m = cfg.inputs
  const rows: number[] = []
  for (let i = 0; i < m; i++) rows.push(1 + 3 * i)
  const finalRow = rows[m - 1] as number
  const height = 3 * m

  // Colunas das portas de merge (M_i combina o acumulador da linha i-1 com a
  // variável da linha i). d_i é a coluna da descida do acumulador após M_i.
  const mergeCol: number[] = []
  const dropCol: number[] = []
  for (let i = 1; i < m; i++) {
    const col = 6 + 4 * (i - 1)
    mergeCol.push(col)
    dropCol.push(col + 2)
  }
  const leafChain = (i: number): number => target.leafChains[i] as number

  const fixed: FixedCell[] = []
  const free = new Set<string>()
  const addFreeRun = (x0: number, x1: number, y: number): void => {
    const lo = Math.min(x0, x1)
    const hi = Math.max(x0, x1)
    for (let x = lo; x <= hi; x++) free.add(key(x, y))
  }
  const addFreeColumn = (x: number, y0: number, y1: number): void => {
    const lo = Math.min(y0, y1)
    const hi = Math.max(y0, y1)
    for (let y = lo; y <= hi; y++) free.add(key(x, y))
  }

  // Fontes (coluna 0), uma por variável na ordem do comb.
  for (let i = 0; i < m; i++) {
    const y = rows[i] as number
    const varIndex = target.order[i] as number
    fixed.push({
      coord: { x: 0, y },
      cell: { kind: 'source', value: row[varIndex] as 0 | 1, outputSide: 'E' },
    })
  }

  let plazaStart: number

  if (m === 1) {
    // Uma única variável: cadeia única de NOTs + praça + sink.
    const chainLen = countGates(target)
    for (let c = 1; c <= chainLen; c++) {
      fixed.push({ coord: { x: c, y: finalRow }, cell: gateCell('NOT', ['W']) })
    }
    plazaStart = chainLen + 1
    addPlaza(free, plazaStart, cfg.plazaWidth, finalRow, height)
  } else {
    // Cadeias de NOT das folhas (bloco adjacente à fonte de cada variável).
    for (let i = 0; i < m; i++) {
      const y = rows[i] as number
      const len = leafChain(i)
      for (let c = 1; c <= len; c++) {
        fixed.push({ coord: { x: c, y }, cell: gateCell('NOT', ['W']) })
      }
    }

    // Corredor da 1ª variável até a entrada W de M_1.
    const m1 = mergeCol[0] as number
    addFreeRun(leafChain(0) + 1, m1 - 1, rows[0] as number)

    for (let i = 1; i < m; i++) {
      const col = mergeCol[i - 1] as number
      const d = dropCol[i - 1] as number
      const rTop = rows[i - 1] as number
      const rBot = rows[i] as number

      // Porta de merge M_i na linha de cima; entradas W (acumulador) e S (variável).
      fixed.push({
        coord: { x: col, y: rTop },
        cell: gateCell(target.ops[i - 1] as 'AND' | 'OR', ['W', 'S']),
      })

      // Abordagem da variável i (linha de baixo) + subida no lado S da porta.
      addFreeRun(leafChain(i) + 1, col - 1, rBot)
      addFreeColumn(col, rTop + 1, rBot)

      // Saída E da porta e descida do acumulador até a linha da variável i.
      addFreeRun(col + 1, d, rTop)
      addFreeColumn(d, rTop + 1, rBot)

      // Corrida do acumulador até a entrada da próxima porta (se houver).
      if (i < m - 1) {
        const nextCol = mergeCol[i] as number
        addFreeRun(d, nextCol - 1, rBot)
      }
    }

    // Cadeia de NOTs da raiz (bloco fixo na linha final).
    const dLast = dropCol[m - 2] as number
    const rootChain = target.rootChain
    if (rootChain > 0) {
      for (let c = 1; c <= rootChain; c++) {
        fixed.push({ coord: { x: dLast + c, y: finalRow }, cell: gateCell('NOT', ['W']) })
      }
      plazaStart = dLast + rootChain + 1
    } else {
      plazaStart = dLast + 1
    }
    addPlaza(free, plazaStart, cfg.plazaWidth, finalRow, height)
  }

  // Sink: fim da praça, lendo da esquerda.
  const expected = evaluateSpec(target, row)
  const sinkX = plazaStart + cfg.plazaWidth
  fixed.push({
    coord: { x: sinkX, y: finalRow },
    cell: { kind: 'sink', expected, inputSide: 'W' },
  })

  return finalize(fixed, free, height)
}

/** Praça aberta: retângulo de `width` × 3 células antes do sink. */
function addPlaza(free: Set<string>, plazaStart: number, width: number, finalRow: number, height: number): void {
  for (let x = plazaStart; x < plazaStart + width; x++) {
    for (let y = finalRow - 1; y <= finalRow + 1; y++) {
      if (y >= 0 && y < height) free.add(key(x, y))
    }
  }
}

/** Preenche o resto do grid com paredes. Largura = maior coluna ocupada + 1. */
function finalize(fixedIn: FixedCell[], free: Set<string>, height: number): Candidate {
  let width = 1
  for (const f of fixedIn) width = Math.max(width, f.coord.x + 1)
  const fixed = [...fixedIn]
  const occupied = new Set(fixedIn.map(f => key(f.coord.x, f.coord.y)))
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const k = key(x, y)
      if (!free.has(k) && !occupied.has(k)) {
        fixed.push({ coord: { x, y }, cell: { kind: 'empty' } })
      }
    }
  }
  return { width, height, fixed, free }
}

function defaultHints(): LevelHints {
  return [
    'Cada corredor leva o sinal de um bloco ao próximo; o valor só muda ao atravessar uma porta.',
    'Ligue cada saída à entrada do bloco seguinte, da esquerda para a direita, até o destino.',
  ]
}

/** Monta o LevelSpec completo (inventário provisório de fios ilimitados). */
export function buildLevelSpec(
  candidate: Candidate,
  seedId: string,
  name: string,
  expression: string,
): LevelSpec {
  const fixed = [...candidate.fixed].sort((a, b) => coordSort(a.coord, b.coord))
  return {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: seedId,
    name,
    grid: { width: candidate.width, height: candidate.height },
    fixedCells: fixed,
    inventory: { wires: null, gates: { AND: 0, OR: 0, NOT: 0 } },
    hints: defaultHints(),
    starThresholds: { maxPieces: 999, maxGates: 0 },
    expression,
  }
}

/** Ajusta inventário e estrelas com base na solução encontrada pelo solver. */
export function applyInventory(spec: LevelSpec, wiresUsed: number, slack: number): LevelSpec {
  const wires = wiresUsed + slack
  return {
    ...spec,
    inventory: { wires, gates: { AND: 0, OR: 0, NOT: 0 } },
    starThresholds: { maxPieces: wires, maxGates: 0 },
  }
}
