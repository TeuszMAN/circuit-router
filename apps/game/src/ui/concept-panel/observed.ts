/**
 * Registro de linhas de tabela-verdade já observadas em jogo (SDD §9.C.3):
 * "linhas que o jogador já observou aparecem preenchidas e destacadas; as não
 * observadas ficam em cinza". `recordGateObservation` é o ponto de extensão —
 * quem executa `simulate`/`simulateWithTrace` (composição da MI-15) chama esta
 * função a cada porta avaliada. Até essa fiação existir, todas as linhas
 * começam não observadas, o que é um estado inicial válido (sessão nova).
 */
import { signal } from '@preact/signals'
import type { GateType } from '@circuit/core/model'

function rowKey(gate: GateType, inputs: readonly (0 | 1)[]): string {
  return `${gate}:${inputs.join('')}`
}

const observed = signal<ReadonlySet<string>>(new Set())

/** Marca uma combinação de entradas de uma porta como observada em jogo. */
export function recordGateObservation(gate: GateType, inputs: readonly (0 | 1)[]): void {
  const observedKey = rowKey(gate, inputs)
  if (observed.value.has(observedKey)) return
  observed.value = new Set(observed.value).add(observedKey)
}

/** Lê o sinal de observações (reativo — use dentro de um componente Preact). */
export function observedRowsSignal() {
  return observed
}

export function isRowObserved(gate: GateType, inputs: readonly (0 | 1)[]): boolean {
  return observed.value.has(rowKey(gate, inputs))
}

/** Uso em testes: garante um registro limpo entre casos. */
export function resetObservedRows(): void {
  observed.value = new Set()
}
