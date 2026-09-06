/**
 * Modal de resultado da simulação (MI-10, ajustado na MI-21).
 *
 * Vitória — estrelas nomeadas (SDD §9.E): "Circuito completo", "Rota limpa" e
 * "Lógica mínima"; quando faltam estrelas, explica a que ficou perdida (sem
 * revelar a solução) e oferece "Tentar de novo" ao lado de "Próxima fase";
 * selo "resolvida com dica" (SDD §9.C.2) quando a fase foi vencida com ajuda.
 * Erro — diagnóstico em três camadas legíveis (SDD §9.C.1), textos vindos de
 * @circuit/content/text, sempre com highlight das células que evidenciam o
 * problema (SDD §4.4 `SimulationIssue.cells`) — nenhum diagnóstico é exibido
 * sem highlight.
 */
import { useEffect } from 'preact/hooks'
import {
  HINT_SEAL_LABEL,
  NEXT_LEVEL_LABEL,
  STARS,
  TRY_AGAIN_LABEL,
  WIN_TITLE,
  formatSinkMismatch,
  messageForIssue,
  starLostExplanation,
} from '@circuit/content/text'
import type { Coord, SimulationIssue, SinkStatus } from '@circuit/core/model'
import { IconStar } from '../icons'

export interface VictoryDetails {
  readonly kind: 'win'
  readonly stars: 1 | 2 | 3
  readonly usedGates: number
  readonly gateLimit: number
  /** A fase foi vencida usando a dica de nível 2 (SDD §9.C.2). */
  readonly usedHint?: boolean
}

export interface FailureDetails {
  readonly kind: 'error'
  readonly issues: readonly SimulationIssue[]
  readonly sinks: readonly SinkStatus[]
}

export type ResultOutcome = VictoryDetails | FailureDetails

export interface ResultModalProps {
  readonly outcome: ResultOutcome
  readonly levelName: string
  /** Há uma fase seguinte na campanha (habilita "Próxima fase"). */
  readonly hasNext: boolean
  /** Fechar o modal e seguir: próxima fase, repetir ou voltar às fases. */
  readonly onNext: () => void
  readonly onRetry: () => void
  readonly onExit: () => void
}

interface Diagnostic {
  readonly key: string
  readonly titulo: string
  readonly explicacao: string
  readonly acaoSugerida: string
  readonly cells: readonly Coord[]
}

/** Um diagnóstico por kind — evita repetir o mesmo texto para o mesmo erro. */
function dedupeIssues(issues: readonly SimulationIssue[]): readonly SimulationIssue[] {
  const byKind = new Map<SimulationIssue['kind'], SimulationIssue>()
  for (const issue of issues) {
    if (!byKind.has(issue.kind)) byKind.set(issue.kind, issue)
  }
  return [...byKind.values()]
}

/**
 * Monta os diagnósticos a exibir: issues da simulação (com suas `cells[]`) ou,
 * na ausência delas, os destinos insatisfeitos (destacando a célula do sink).
 * Nunca inclui um diagnóstico sem célula para destacar (SDD §9.C.1/MI-21).
 */
function buildDiagnostics(
  issues: readonly SimulationIssue[],
  sinks: readonly SinkStatus[],
): readonly Diagnostic[] {
  if (issues.length > 0) {
    return dedupeIssues(issues)
      .map(issue => {
        const message = messageForIssue(issue.kind)
        return {
          key: issue.kind,
          titulo: message.titulo,
          explicacao: message.explicacao,
          acaoSugerida: message.acaoSugerida,
          cells: issue.cells,
        }
      })
      .filter(diagnostic => diagnostic.cells.length > 0)
  }

  return sinks
    .filter(sink => !sink.satisfied)
    .map(sink => {
      const message = formatSinkMismatch(sink.expected, sink.actual)
      return {
        key: `${sink.coord.x}-${sink.coord.y}`,
        titulo: message.titulo,
        explicacao: message.explicacao,
        acaoSugerida: message.acaoSugerida,
        cells: [sink.coord],
      }
    })
    .filter(diagnostic => diagnostic.cells.length > 0)
}

/** Destaque textual das células apontadas pelo diagnóstico (highlight obrigatório). */
function CellHighlight({ cells }: { readonly cells: readonly Coord[] }) {
  return (
    <ul className="diagnostic__cells" aria-label="Células destacadas no tabuleiro">
      {cells.map(cell => (
        <li
          key={`${cell.x}-${cell.y}`}
          className="diagnostic__cell"
          data-testid="diagnostic-cell"
        >
          {`Coluna ${cell.x + 1}, linha ${cell.y + 1}`}
        </li>
      ))}
    </ul>
  )
}

function VictoryModal({
  details,
  levelName,
  hasNext,
  onNext,
  onRetry,
  onExit,
}: {
  readonly details: VictoryDetails
  readonly levelName: string
  readonly hasNext: boolean
  readonly onNext: () => void
  readonly onRetry: () => void
  readonly onExit: () => void
}) {
  const lost: string[] = []
  if (details.stars < 3) {
    lost.push(starLostExplanation(details.usedGates, details.gateLimit))
  }

  return (
    <div
      className="result-card"
      role="dialog"
      aria-modal="true"
      aria-labelledby="result-title"
    >
      <h2 id="result-title" className="result-card__title">
        {WIN_TITLE}
      </h2>
      <p className="result-card__subtitle">{levelName}</p>
      {details.usedHint === true ? (
        <span className="hint-seal" data-testid="hint-seal">
          {HINT_SEAL_LABEL}
        </span>
      ) : null}

      <ul className="result-stars" style="list-style:none;margin:0;padding:0">
        {STARS.map(star => {
          const earned = star.tier <= details.stars
          return (
            <li
              key={star.tier}
              className={`result-star${earned ? ' result-star--earned' : ''}`}
            >
              <span className="result-star__star" aria-hidden="true">
                <IconStar earned={earned} />
              </span>
              <span>
                <span className="result-star__tier">{`Estrela ${star.tier}`}</span>
                <br />
                <span className="result-star__name">{star.name}</span>
                {earned ? (
                  <>
                    <br />
                    <span className="result-star__desc">{star.description}</span>
                  </>
                ) : null}
              </span>
            </li>
          )
        })}
      </ul>

      {lost.length > 0 ? (
        <div className="result-lost">
          {lost.map(line => (
            <p key={line} style="margin:0 0 6px">
              {line}
            </p>
          ))}
        </div>
      ) : null}

      <div className={`result-actions${details.stars < 3 ? ' result-actions--row' : ''}`}>
        {details.stars < 3 ? (
          <button type="button" className="btn btn--secondary" onClick={onRetry}>
            {TRY_AGAIN_LABEL}
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn--primary"
          onClick={hasNext ? onNext : onExit}
        >
          {hasNext ? NEXT_LEVEL_LABEL : 'Voltar às fases'}
        </button>
      </div>
    </div>
  )
}

function FailureModal({
  levelName,
  issues,
  sinks,
  onRetry,
}: {
  readonly levelName: string
  readonly issues: readonly SimulationIssue[]
  readonly sinks: readonly SinkStatus[]
  readonly onRetry: () => void
}) {
  const diagnostics = buildDiagnostics(issues, sinks)

  return (
    <div
      className="result-card"
      role="dialog"
      aria-modal="true"
      aria-labelledby="result-title"
    >
      <h2 id="result-title" className="result-card__title">
        O circuito ainda não fechou
      </h2>
      <p className="result-card__subtitle">{levelName}</p>

      <div className="diagnostics">
        {diagnostics.map(diagnostic => (
          <div key={diagnostic.key} className="diagnostic">
            <p className="diagnostic__title">{diagnostic.titulo}</p>
            <p className="diagnostic__body">{diagnostic.explicacao}</p>
            <CellHighlight cells={diagnostic.cells} />
            <p className="diagnostic__action">
              <strong>Sugestão: </strong>
              {diagnostic.acaoSugerida}
            </p>
          </div>
        ))}
      </div>

      <div className="result-actions">
        <button type="button" className="btn btn--primary" onClick={onRetry}>
          Continuar tentando
        </button>
      </div>
    </div>
  )
}

export function ResultModal({
  outcome,
  levelName,
  hasNext,
  onNext,
  onRetry,
  onExit,
}: ResultModalProps) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') onRetry()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onRetry])

  return (
    <div className="result-overlay">
      {outcome.kind === 'win' ? (
        <VictoryModal
          details={outcome}
          levelName={levelName}
          hasNext={hasNext}
          onNext={onNext}
          onRetry={onRetry}
          onExit={onExit}
        />
      ) : (
        <FailureModal
          levelName={levelName}
          issues={outcome.issues}
          sinks={outcome.sinks}
          onRetry={onRetry}
        />
      )}
    </div>
  )
}
