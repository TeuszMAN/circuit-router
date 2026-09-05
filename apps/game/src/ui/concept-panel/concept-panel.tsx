/**
 * Painel de conceito "?" (SDD §9.C.3, MI-20). Acessível a qualquer momento,
 * sem pausar nem penalizar: é montado uma vez no shell (`../app-shell.tsx`)
 * como uma sobreposição irmã da tela corrente, então abrir/fechar nunca
 * desmonta o tabuleiro. Mostra o conceito em foco (porta selecionada ou o
 * padrão do pack) com definição, símbolo e tabela-verdade interativa, mais um
 * rodapé de contexto real e o índice do glossário completo. Todo texto vem de
 * `@circuit/content/text` — nenhuma frase de conteúdo é definida aqui.
 */
import { useEffect } from 'preact/hooks'
import type { GateType } from '@circuit/core/model'
import { GLOSSARY, glossaryEntry } from '@circuit/content/text'
import { setConceptRequestHandler } from '../concept'
import { IconGateAND, IconGateNOT, IconGateOR, IconWire } from '../icons'
import { focusFor, truthTable, type ConceptFocus, type TruthRow } from './model'
import { isRowObserved, observedRowsSignal } from './observed'
import {
  closeConcept,
  focusTerm,
  isOpen,
  navigateToTerm,
  openConcept,
  selectedRowIndex,
} from './panel-state'

import './concept-panel.css'

/** Verbete genérico usado no rodapé quando o foco atual não é ele mesmo (SDD §9.C.3). */
const REAL_WORLD_TERM = 'Combinacional'
const INPUT_LABELS = ['A', 'B']

function SymbolFor({ gate, term }: { readonly gate: GateType | null; readonly term: string }) {
  if (gate === 'AND') return <IconGateAND />
  if (gate === 'OR') return <IconGateOR />
  if (gate === 'NOT') return <IconGateNOT />
  if (term === 'Fio') return <IconWire />
  return null
}

function caseSummary(row: TruthRow): string {
  const inputs = row.inputs
    .map((value, index) => `${row.inputs.length > 1 ? INPUT_LABELS[index] : 'Entrada'} = ${value}`)
    .join(', ')
  return `${inputs} → Saída = ${row.output}`
}

function TruthTableView({ gate, rows }: { readonly gate: GateType; readonly rows: readonly TruthRow[] }) {
  // Lê o signal de observações para o componente reagir a novos registros.
  observedRowsSignal().value

  return (
    <table className="concept-table" aria-label={`Tabela-verdade de ${gate}`}>
      <tbody>
        {rows.map((row, index) => {
          const rowObserved = isRowObserved(gate, row.inputs)
          const selected = selectedRowIndex.value === index
          return (
            <tr key={row.inputs.join('')}>
              <td className="concept-table__cell-wrap">
                <button
                  type="button"
                  className={`concept-table__row${selected ? ' concept-table__row--selected' : ''}${
                    rowObserved ? ' concept-table__row--observed' : ' concept-table__row--unobserved'
                  }`}
                  aria-pressed={selected}
                  aria-label={`Linha ${index + 1}: ${caseSummary(row)}`}
                  onClick={() => (selectedRowIndex.value = index)}
                >
                  {row.inputs.map((value, i) => (
                    <span key={i} className="concept-table__value">
                      {row.inputs.length > 1 ? INPUT_LABELS[i] : 'In'}={value}
                    </span>
                  ))}
                  <span className="concept-table__value concept-table__value--output">= {row.output}</span>
                </button>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function ConceptFooter({ focus }: { readonly focus: ConceptFocus }) {
  if (focus.term === REAL_WORLD_TERM) return null
  const entry = glossaryEntry(REAL_WORLD_TERM)
  if (entry === undefined) return null
  return (
    <footer className="concept-panel__footer">
      <h3 className="concept-panel__footer-title">Onde isso aparece de verdade</h3>
      <p>{entry.explanation}</p>
    </footer>
  )
}

export function ConceptPanel() {
  useEffect(() => {
    setConceptRequestHandler(term => openConcept(term))
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') closeConcept()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      setConceptRequestHandler(null)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  if (!isOpen.value) return null

  const focus = focusFor(focusTerm.value)
  const rows = focus.gate !== null ? truthTable(focus.gate) : []
  const selectedRow = selectedRowIndex.value !== null ? rows[selectedRowIndex.value] : undefined

  return (
    <div className="concept-overlay">
      <div
        className="concept-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="concept-panel-title"
      >
        <header className="concept-panel__head">
          <span className="concept-panel__symbol" aria-hidden="true">
            <SymbolFor gate={focus.gate} term={focus.term} />
          </span>
          <h2 id="concept-panel-title" className="concept-panel__title">
            {focus.term}
          </h2>
          <button
            type="button"
            className="concept-panel__close"
            aria-label="Fechar painel de conceito"
            onClick={closeConcept}
          >
            ✕
          </button>
        </header>

        <div className="concept-panel__body">
          {focus.entry !== undefined ? (
            <p className="concept-panel__definition">{focus.entry.explanation}</p>
          ) : null}

          {focus.gate !== null ? (
            <>
              <TruthTableView gate={focus.gate} rows={rows} />
              {selectedRow !== undefined ? (
                <p className="concept-panel__case" data-testid="concept-case">
                  {caseSummary(selectedRow)}
                </p>
              ) : null}
            </>
          ) : null}
        </div>

        <ConceptFooter focus={focus} />

        <section className="concept-panel__index" aria-label="Índice do glossário">
          <h3 className="concept-panel__index-title">Glossário completo</h3>
          <ul className="concept-panel__index-list">
            {GLOSSARY.map(entry => (
              <li key={entry.term}>
                <button
                  type="button"
                  className={`concept-panel__index-item${
                    entry.term === focus.term ? ' concept-panel__index-item--active' : ''
                  }`}
                  aria-current={entry.term === focus.term ? 'true' : undefined}
                  onClick={() => navigateToTerm(entry.term)}
                >
                  {entry.term}
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
