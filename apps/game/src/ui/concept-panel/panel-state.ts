/**
 * Estado do painel de conceito em signals (mesma convenção de `../state.ts`).
 * Fica em módulo próprio porque quem abre o painel (`requestConcept`, ver
 * `../concept.ts`) precisa atualizar este estado de fora da árvore de
 * componentes — o handler é registrado uma vez pelo `ConceptPanel` montado no
 * shell (ver `../app-shell.tsx`).
 */
import { signal } from '@preact/signals'
import { glossaryTermForRequest } from './model'

export const isOpen = signal(false)
export const focusTerm = signal(glossaryTermForRequest(undefined))
export const selectedRowIndex = signal<number | null>(null)

/** Abre o painel focado no termo pedido (porta selecionada, fio, ou nenhum = conceito padrão). */
export function openConcept(requested?: string): void {
  focusTerm.value = glossaryTermForRequest(requested)
  selectedRowIndex.value = null
  isOpen.value = true
}

/** Fecha o painel sem alterar nada do tabuleiro — é só uma sobreposição. */
export function closeConcept(): void {
  isOpen.value = false
}

/** Navega para outro verbete a partir do índice do glossário. */
export function navigateToTerm(term: string): void {
  focusTerm.value = term
  selectedRowIndex.value = null
}
