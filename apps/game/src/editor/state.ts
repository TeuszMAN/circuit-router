/**
 * Estado do modo sandbox/editor (MI-13, SDD §9.5): grid livre onde o autor
 * coloca sources/sinks/portas/fios livremente — cada célula colocada vira uma
 * `FixedCell` da fase sendo desenhada, e "testar" roda a simulação do core
 * direto sobre esse desenho (não existe camada separada de "peças do
 * jogador" no sandbox; a fase *é* o circuito desenhado). Exportar/importar
 * trafega o mesmo `LevelSpec` usado pelo resto do jogo, validado pelo
 * schema (`./schema.ts`) — nunca lança para JSON externo malformado.
 */
import { signal, type Signal } from '@preact/signals'
import { simulate } from '@circuit/core/sim'
import {
  LEVEL_SCHEMA_VERSION,
  type BoardState,
  type Cell,
  type Coord,
  type FixedCell,
  type GridSize,
  type LevelSpec,
  type SimulationResult,
} from '@circuit/core/model'
import { SaveStore, type SandboxDraft, type StorageLike } from '@circuit/core/persist'
import { validateLevelSpec, parseLevelSpecJson } from './schema'

const DEFAULT_GRID: GridSize = { width: 8, height: 6 }

function cellKey(coord: Coord): string {
  return `${coord.x},${coord.y}`
}

function sameCoord(a: Coord, b: Coord): boolean {
  return a.x === b.x && a.y === b.y
}

/** Fase em branco: grid livre, nenhuma peça, nada reservado ao jogador. */
export function blankSandboxLevel(id = 'sandbox-draft', name = 'Rascunho sandbox'): LevelSpec {
  return {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id,
    name,
    grid: DEFAULT_GRID,
    fixedCells: [],
    inventory: { wires: 0, gates: { AND: 0, OR: 0, NOT: 0 } },
    hints: ['', ''],
    starThresholds: { maxPieces: 0, maxGates: 0 },
  }
}

/** Storage em memória — usado nos testes e como padrão fora do navegador. */
export function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>()
  return {
    getItem: k => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v)
    },
    removeItem: k => {
      map.delete(k)
    },
  }
}

export interface ImportOutcome {
  readonly ok: boolean
  readonly errors?: readonly string[]
}

export interface DraftSummary {
  readonly slot: string
  readonly label: string
  readonly updatedAt: string
}

function emptyBoardOf(level: LevelSpec): BoardState {
  return { levelId: level.id, placedCells: [] }
}

export interface SandboxEditorState {
  readonly level: Signal<LevelSpec>
  /** Última simulação rodada por `runSimulation()` (null até a primeira). */
  readonly lastResult: Signal<SimulationResult | null>
  /** Última mensagem de erro de import/carregamento (PT-BR), ou null. */
  readonly lastError: Signal<string | null>

  setMeta(patch: Partial<Pick<LevelSpec, 'id' | 'name' | 'expression'>>): void
  setHints(hints: readonly [string, string]): void
  resizeGrid(size: GridSize): boolean
  cellAt(coord: Coord): Cell | undefined
  placeCell(coord: Coord, cell: Cell): boolean
  eraseCell(coord: Coord): boolean
  clear(): void

  /** Roda o motor de simulação sobre o desenho atual (teste imediato). */
  runSimulation(): SimulationResult

  exportJson(): { readonly ok: true; readonly json: string } | { readonly ok: false; readonly errors: readonly string[] }
  importJson(raw: string): ImportOutcome

  saveDraft(slot: string, label: string): void
  loadDraft(slot: string): ImportOutcome
  deleteDraft(slot: string): boolean
  listDrafts(): readonly DraftSummary[]
}

export function createSandboxEditor(storage?: StorageLike, initial?: LevelSpec): SandboxEditorState {
  const store = new SaveStore(storage ?? createMemoryStorage(), 'circuit-router-sandbox')
  const level = signal<LevelSpec>(initial ?? blankSandboxLevel())
  const lastResult = signal<SimulationResult | null>(null)
  const lastError = signal<string | null>(null)

  function withFixedCells(next: readonly FixedCell[]): void {
    level.value = { ...level.value, fixedCells: next }
  }

  function inBounds(coord: Coord, grid: GridSize): boolean {
    return coord.x >= 0 && coord.y >= 0 && coord.x < grid.width && coord.y < grid.height
  }

  return {
    level,
    lastResult,
    lastError,

    setMeta(patch) {
      level.value = { ...level.value, ...patch }
    },

    setHints(hints) {
      level.value = { ...level.value, hints: [hints[0], hints[1]] }
    },

    resizeGrid(size) {
      if (!Number.isInteger(size.width) || !Number.isInteger(size.height) || size.width <= 0 || size.height <= 0) {
        return false
      }
      const kept = level.value.fixedCells.filter(f => inBounds(f.coord, size))
      level.value = { ...level.value, grid: size, fixedCells: kept }
      return true
    },

    cellAt(coord) {
      return level.value.fixedCells.find(f => sameCoord(f.coord, coord))?.cell
    },

    placeCell(coord, cell) {
      if (!inBounds(coord, level.value.grid)) return false
      const rest = level.value.fixedCells.filter(f => !sameCoord(f.coord, coord))
      withFixedCells([...rest, { coord, cell }])
      return true
    },

    eraseCell(coord) {
      const before = level.value.fixedCells.length
      const rest = level.value.fixedCells.filter(f => !sameCoord(f.coord, coord))
      if (rest.length === before) return false
      withFixedCells(rest)
      return true
    },

    clear() {
      withFixedCells([])
    },

    runSimulation() {
      const result = simulate(level.value, emptyBoardOf(level.value))
      lastResult.value = result
      return result
    },

    exportJson() {
      const validated = validateLevelSpec(level.value)
      if (!validated.ok) return { ok: false, errors: validated.errors }
      return { ok: true, json: JSON.stringify(validated.value, null, 2) }
    },

    importJson(raw) {
      const result = parseLevelSpecJson(raw)
      if (!result.ok) {
        lastError.value = result.errors.join('; ')
        return { ok: false, errors: result.errors }
      }
      level.value = result.value
      lastError.value = null
      lastResult.value = null
      return { ok: true }
    },

    saveDraft(slot, label) {
      store.saveDraft(slot, { label, levelSpec: level.value, boardState: emptyBoardOf(level.value) })
    },

    loadDraft(slot) {
      const draft = store.draft(slot)
      if (!draft) {
        const errors = [`rascunho "${slot}" não encontrado`]
        lastError.value = errors[0] as string
        return { ok: false, errors }
      }
      const validated = validateLevelSpec(draft.levelSpec)
      if (!validated.ok) {
        const errors = [`rascunho "${slot}" corrompido: ${validated.errors.join('; ')}`]
        lastError.value = errors[0] as string
        return { ok: false, errors }
      }
      level.value = validated.value
      lastError.value = null
      lastResult.value = null
      return { ok: true }
    },

    deleteDraft(slot) {
      return store.deleteDraft(slot)
    },

    listDrafts() {
      const drafts = store.data.sandboxDrafts as Readonly<Record<string, SandboxDraft>>
      return Object.entries(drafts)
        .map(([slot, draft]) => ({ slot, label: draft.label, updatedAt: draft.updatedAt }))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    },
  }
}
