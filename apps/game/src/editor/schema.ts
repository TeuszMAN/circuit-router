/**
 * Validação de `LevelSpec` vindo de JSON externo (import do editor, MI-13).
 *
 * O core não expõe um validador de schema — `LevelSpec` é só um tipo
 * TypeScript, apagado em tempo de execução. Este módulo reconstrói as
 * checagens estruturais na fronteira do editor (import de arquivo/texto) e
 * devolve mensagens em PT-BR úteis o bastante para o autor da fase corrigir o
 * JSON, nunca uma exceção — "JSON inválido/fora do schema → erro claro, app
 * não quebra" é aceite explícito da MI-13.
 */
import {
  GATE_ARITY,
  LEVEL_SCHEMA_VERSION,
  type Cell,
  type Direction,
  type FixedCell,
  type GateType,
  type GridSize,
  type LevelHints,
  type LevelInventory,
  type LevelSpec,
  type StarThresholds,
} from '@circuit/core/model'

export interface SchemaValidationFailure {
  readonly ok: false
  readonly errors: readonly string[]
}

export interface SchemaValidationSuccess {
  readonly ok: true
  readonly value: LevelSpec
}

export type SchemaValidationResult = SchemaValidationSuccess | SchemaValidationFailure

const DIRECTIONS: readonly Direction[] = ['N', 'S', 'E', 'W']
const GATE_TYPES: readonly GateType[] = ['AND', 'OR', 'NOT']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isDirection(value: unknown): value is Direction {
  return typeof value === 'string' && (DIRECTIONS as readonly string[]).includes(value)
}

function isGateType(value: unknown): value is GateType {
  return typeof value === 'string' && (GATE_TYPES as readonly string[]).includes(value)
}

function isBinarySignal(value: unknown): value is 0 | 1 {
  return value === 0 || value === 1
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

/** Acumula erros em vez de lançar na primeira falha — o autor vê tudo de uma vez. */
class Errors {
  readonly items: string[] = []

  add(path: string, message: string): void {
    this.items.push(`${path}: ${message}`)
  }

  get hasAny(): boolean {
    return this.items.length > 0
  }
}

function validateGrid(raw: unknown, errors: Errors): GridSize | null {
  if (!isRecord(raw)) {
    errors.add('grid', 'deve ser um objeto com "width" e "height"')
    return null
  }
  const width = raw.width
  const height = raw.height
  let ok = true
  if (!isPositiveInt(width)) {
    errors.add('grid.width', 'deve ser um número inteiro maior que zero')
    ok = false
  }
  if (!isPositiveInt(height)) {
    errors.add('grid.height', 'deve ser um número inteiro maior que zero')
    ok = false
  }
  return ok ? { width: width as number, height: height as number } : null
}

function validateCell(raw: unknown, path: string, errors: Errors): Cell | null {
  if (!isRecord(raw)) {
    errors.add(path, 'deve ser um objeto de célula com "kind"')
    return null
  }
  const kind = raw.kind
  switch (kind) {
    case 'empty':
      return { kind: 'empty' }
    case 'source': {
      let ok = true
      if (!isBinarySignal(raw.value)) {
        errors.add(`${path}.value`, 'deve ser 0 ou 1')
        ok = false
      }
      if (!isDirection(raw.outputSide)) {
        errors.add(`${path}.outputSide`, 'deve ser uma direção válida (N, S, E ou W)')
        ok = false
      }
      return ok ? { kind: 'source', value: raw.value as 0 | 1, outputSide: raw.outputSide as Direction } : null
    }
    case 'sink': {
      let ok = true
      if (!isBinarySignal(raw.expected)) {
        errors.add(`${path}.expected`, 'deve ser 0 ou 1')
        ok = false
      }
      if (!isDirection(raw.inputSide)) {
        errors.add(`${path}.inputSide`, 'deve ser uma direção válida (N, S, E ou W)')
        ok = false
      }
      return ok ? { kind: 'sink', expected: raw.expected as 0 | 1, inputSide: raw.inputSide as Direction } : null
    }
    case 'wire': {
      const sides = raw.sides
      if (!Array.isArray(sides) || sides.length === 0 || !sides.every(isDirection)) {
        errors.add(`${path}.sides`, 'deve ser uma lista não vazia de direções (N, S, E ou W)')
        return null
      }
      return { kind: 'wire', sides: sides as Direction[] }
    }
    case 'gate': {
      let ok = true
      if (!isGateType(raw.gate)) {
        errors.add(`${path}.gate`, 'deve ser AND, OR ou NOT')
        ok = false
      }
      if (!isDirection(raw.rotation)) {
        errors.add(`${path}.rotation`, 'deve ser uma direção válida (N, S, E ou W)')
        ok = false
      }
      if (!isDirection(raw.outputSide)) {
        errors.add(`${path}.outputSide`, 'deve ser uma direção válida (N, S, E ou W)')
        ok = false
      }
      const inputSides = raw.inputSides
      if (!Array.isArray(inputSides) || inputSides.length === 0 || !inputSides.every(isDirection)) {
        errors.add(`${path}.inputSides`, 'deve ser uma lista não vazia de direções (N, S, E ou W)')
        ok = false
      } else if (isGateType(raw.gate) && inputSides.length !== GATE_ARITY[raw.gate]) {
        errors.add(
          `${path}.inputSides`,
          `porta ${raw.gate} espera ${GATE_ARITY[raw.gate]} entrada(s), recebeu ${inputSides.length}`,
        )
        ok = false
      }
      if (!ok) return null
      return {
        kind: 'gate',
        gate: raw.gate as GateType,
        rotation: raw.rotation as Direction,
        inputSides: raw.inputSides as Direction[],
        outputSide: raw.outputSide as Direction,
      }
    }
    default:
      errors.add(`${path}.kind`, 'deve ser empty, source, sink, wire ou gate')
      return null
  }
}

function validateFixedCells(raw: unknown, grid: GridSize, errors: Errors): readonly FixedCell[] | null {
  if (!Array.isArray(raw)) {
    errors.add('fixedCells', 'deve ser uma lista de células fixas')
    return null
  }
  const result: FixedCell[] = []
  let ok = true
  raw.forEach((entry, index) => {
    const path = `fixedCells[${index}]`
    if (!isRecord(entry)) {
      errors.add(path, 'deve ser um objeto com "coord" e "cell"')
      ok = false
      return
    }
    const coord = entry.coord
    if (
      !isRecord(coord) ||
      !isNonNegativeInt(coord.x) ||
      !isNonNegativeInt(coord.y) ||
      (coord.x as number) >= grid.width ||
      (coord.y as number) >= grid.height
    ) {
      errors.add(`${path}.coord`, `deve ter x/y inteiros dentro do grid (${grid.width}x${grid.height})`)
      ok = false
      return
    }
    const cell = validateCell(entry.cell, `${path}.cell`, errors)
    if (cell === null) {
      ok = false
      return
    }
    result.push({ coord: { x: coord.x as number, y: coord.y as number }, cell })
  })
  return ok ? result : null
}

function validateInventory(raw: unknown, errors: Errors): LevelInventory | null {
  if (!isRecord(raw)) {
    errors.add('inventory', 'deve ser um objeto com "wires" e "gates"')
    return null
  }
  let ok = true
  const wires = raw.wires
  if (wires !== null && !isNonNegativeInt(wires)) {
    errors.add('inventory.wires', 'deve ser um inteiro maior ou igual a zero, ou null (sem limite)')
    ok = false
  }
  const gatesRaw = raw.gates
  if (!isRecord(gatesRaw)) {
    errors.add('inventory.gates', 'deve ser um objeto com contagens por tipo de porta')
    return null
  }
  const gates: Partial<Record<GateType, number | null>> = {}
  for (const gateType of GATE_TYPES) {
    if (!(gateType in gatesRaw)) continue
    const value = gatesRaw[gateType]
    if (value !== null && !isNonNegativeInt(value)) {
      errors.add(`inventory.gates.${gateType}`, 'deve ser um inteiro maior ou igual a zero, ou null (sem limite)')
      ok = false
      continue
    }
    gates[gateType] = value as number | null
  }
  if (!ok) return null
  return { wires: wires as number | null, gates }
}

function validateHints(raw: unknown, errors: Errors): LevelHints | null {
  if (!Array.isArray(raw) || raw.length !== 2 || typeof raw[0] !== 'string' || typeof raw[1] !== 'string') {
    errors.add('hints', 'deve ser uma lista com exatamente duas strings [dica 1, dica 2]')
    return null
  }
  return [raw[0], raw[1]]
}

function validateStarThresholds(raw: unknown, errors: Errors): StarThresholds | null {
  if (!isRecord(raw)) {
    errors.add('starThresholds', 'deve ser um objeto com "maxPieces" e "maxGates"')
    return null
  }
  let ok = true
  if (!isNonNegativeInt(raw.maxPieces)) {
    errors.add('starThresholds.maxPieces', 'deve ser um inteiro maior ou igual a zero')
    ok = false
  }
  if (!isNonNegativeInt(raw.maxGates)) {
    errors.add('starThresholds.maxGates', 'deve ser um inteiro maior ou igual a zero')
    ok = false
  }
  return ok ? { maxPieces: raw.maxPieces as number, maxGates: raw.maxGates as number } : null
}

/**
 * Valida um valor já desserializado (objeto JS) contra o schema de
 * `LevelSpec` (SDD §3.4/§3.6). Nunca lança — erros viram `errors[]`.
 */
export function validateLevelSpec(raw: unknown): SchemaValidationResult {
  const errors = new Errors()

  if (!isRecord(raw)) {
    errors.add('$', 'a fase deve ser um objeto JSON')
    return { ok: false, errors: errors.items }
  }

  if (raw.schemaVersion !== LEVEL_SCHEMA_VERSION) {
    errors.add(
      'schemaVersion',
      `versão ${String(raw.schemaVersion)} não é suportada (esperado ${LEVEL_SCHEMA_VERSION})`,
    )
  }
  if (typeof raw.id !== 'string' || raw.id.trim() === '') {
    errors.add('id', 'deve ser uma string não vazia')
  }
  if (typeof raw.name !== 'string' || raw.name.trim() === '') {
    errors.add('name', 'deve ser uma string não vazia')
  }
  if (raw.expression !== undefined && typeof raw.expression !== 'string') {
    errors.add('expression', 'quando presente, deve ser uma string')
  }

  const grid = validateGrid(raw.grid, errors)
  const fixedCells = grid !== null ? validateFixedCells(raw.fixedCells, grid, errors) : null
  const inventory = validateInventory(raw.inventory, errors)
  const hints = validateHints(raw.hints, errors)
  const starThresholds = validateStarThresholds(raw.starThresholds, errors)

  if (
    errors.hasAny ||
    grid === null ||
    fixedCells === null ||
    inventory === null ||
    hints === null ||
    starThresholds === null
  ) {
    return { ok: false, errors: errors.items }
  }

  const value: LevelSpec = {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: raw.id as string,
    name: raw.name as string,
    grid,
    fixedCells,
    inventory,
    hints,
    starThresholds,
    ...(typeof raw.expression === 'string' ? { expression: raw.expression } : {}),
  }
  return { ok: true, value }
}

/**
 * Faz o parse de texto JSON e valida contra o schema numa única chamada —
 * uso direto pelo import do editor. JSON malformado vira um único erro
 * legível, nunca uma exceção não tratada.
 */
export function parseLevelSpecJson(raw: string): SchemaValidationResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    return { ok: false, errors: [`JSON inválido: não foi possível interpretar o texto (${reason})`] }
  }
  return validateLevelSpec(parsed)
}
