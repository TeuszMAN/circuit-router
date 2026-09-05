/**
 * Modelo do painel de conceito (SDD §9.C.3). Liga o termo em foco ao
 * glossário de `@circuit/content/text` e monta a tabela-verdade real
 * avaliando cada combinação pelo core (`evaluateGate`) — nenhuma regra de
 * porta nem texto de conteúdo é redefinida aqui, só a costura entre os dois.
 */
import { GATE_ARITY, type GateType } from '@circuit/core/model'
import { evaluateGate } from '@circuit/core/sim'
import { glossaryEntry, type GlossaryEntry } from '@circuit/content/text'

/** Termo do glossário que representa cada ferramenta com tabela-verdade. */
const GATE_TERM: Readonly<Record<GateType, string>> = {
  AND: 'AND (E)',
  OR: 'OR (OU)',
  NOT: 'NOT (inversor)',
}

const WIRE_TERM = 'Fio'
/** Foco padrão quando o HUD pede o painel sem ferramenta selecionada (ex.: borracha ativa). */
const DEFAULT_TERM = 'Porta lógica'

function isGateType(value: string): value is GateType {
  return value === 'AND' || value === 'OR' || value === 'NOT'
}

function gateForTerm(term: string): GateType | null {
  const found = (Object.keys(GATE_TERM) as GateType[]).find(gate => GATE_TERM[gate] === term)
  return found ?? null
}

/**
 * Traduz o que o HUD pediu (`requestConcept`, ver `../concept.ts`) para um
 * termo do glossário. `requested` vem tipado como `Tool` em `../hud/tool-palette`,
 * mas chega aqui como `string` porque o ponto de extensão é deliberadamente
 * desacoplado desse tipo (fronteira MI-10/MI-20).
 */
export function glossaryTermForRequest(requested: string | undefined): string {
  if (requested === undefined) return DEFAULT_TERM
  if (requested === 'wire') return WIRE_TERM
  if (isGateType(requested)) return GATE_TERM[requested]
  return requested
}

export interface ConceptFocus {
  readonly term: string
  readonly entry: GlossaryEntry | undefined
  readonly gate: GateType | null
}

/** Resolve o foco completo (verbete + porta associada, se houver) para um termo do glossário. */
export function focusFor(term: string): ConceptFocus {
  return { term, entry: glossaryEntry(term), gate: gateForTerm(term) }
}

export interface TruthRow {
  readonly inputs: readonly (0 | 1)[]
  readonly output: 0 | 1
}

const ARITY_1_COMBOS: readonly (readonly (0 | 1)[])[] = [[0], [1]]
const ARITY_2_COMBOS: readonly (readonly (0 | 1)[])[] = [
  [0, 0],
  [0, 1],
  [1, 0],
  [1, 1],
]

/** Todas as combinações de entrada da porta, avaliadas pelo core (SDD §4.4). */
export function truthTable(gate: GateType): readonly TruthRow[] {
  const combos = GATE_ARITY[gate] === 1 ? ARITY_1_COMBOS : ARITY_2_COMBOS
  return combos.map(inputs => ({ inputs, output: evaluateGate(gate, inputs) }))
}
