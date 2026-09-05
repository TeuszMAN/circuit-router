/**
 * Ponto de extensão do painel de conceito "?" (SDD §9.C.3).
 *
 * O painel completo (definição + tabela-verdade interativa + glossário) é a
 * MI-20. Até lá o HUD já expõe o botão "?" e qualquer módulo pode pedir o
 * painel chamando `requestConcept(term?)`; a MI-20 registra o handler real via
 * `setConceptRequestHandler`.
 */
export type ConceptRequestHandler = (term?: string) => void

let handler: ConceptRequestHandler | null = null

/** Registra quem abre o painel de conceito (chamado pela MI-20). */
export function setConceptRequestHandler(next: ConceptRequestHandler | null): void {
  handler = next
}

/** Pede o painel de conceito, opcionalmente contextual a um termo/porta. */
export function requestConcept(term?: string): void {
  handler?.(term)
}
