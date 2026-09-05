/**
 * Modal de resultado da simulação (MI-10).
 *
 * Vitória — estrelas nomeadas (SDD §9.E): "Circuito completo", "Rota limpa" e
 * "Lógica mínima"; quando faltam estrelas, explica a que ficou perdida e
 * oferece "Tentar de novo" ao lado de "Próxima fase".
 * Erro — diagnóstico em três camadas legíveis (SDD §9.C.1), textos vindos de
 * @circuit/content/text.
 */
import {
  NEXT_LEVEL_LABEL,
  STARS,
  TRY_AGAIN_LABEL,
  WIN_TITLE,
  formatSinkMismatch,
  messageForIssue,
  starLostExplanation,
} from '@circuit/content/text'
import type { SimulationIssue, SinkStatus } from '@circuit/core/model'
import { IconStar } from '../icons'

export interface VictoryDetails {
  readonly kind: 'win'
  readonly stars: 1 | 2 | 3
  readonly usedPieces: number
  readonly usedGates: number
  readonly pieceLimit: number
  readonly gateLimit: number
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

/** Explicação da estrela de peças perdida (estilo do catálogo de conteúdo). */
function lostPiecesExplanation(used: number, limit: number): string {
  return `Você usou ${used} peças; dá para fazer com ${limit}. Existe uma rota mais limpa escondida aqui.`
}

/** Um diagnóstico por kind — evita repetir o mesmo texto para o mesmo erro. */
function dedupeIssues(issues: readonly SimulationIssue[]): readonly SimulationIssue[] {
  const byKind = new Map<SimulationIssue['kind'], SimulationIssue>()
  for (const issue of issues) {
    if (!byKind.has(issue.kind)) byKind.set(issue.kind, issue)
  }
  return [...byKind.values()]
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
  if (details.stars < 2) {
    lost.push(lostPiecesExplanation(details.usedPieces, details.pieceLimit))
  }
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
  const unsatisfied = sinks.filter(sink => !sink.satisfied)

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
        {issues.length > 0
          ? dedupeIssues(issues).map(issue => {
              const message = messageForIssue(issue.kind)
              return (
                <div key={issue.kind} className="diagnostic">
                  <p className="diagnostic__title">{message.titulo}</p>
                  <p className="diagnostic__body">{message.explicacao}</p>
                  <p className="diagnostic__action">
                    <strong>Sugestão: </strong>
                    {message.acaoSugerida}
                  </p>
                </div>
              )
            })
          : unsatisfied.map(sink => {
              const message = formatSinkMismatch(sink.expected, sink.actual)
              return (
                <div key={`${sink.coord.x}-${sink.coord.y}`} className="diagnostic">
                  <p className="diagnostic__title">{message.titulo}</p>
                  <p className="diagnostic__body">{message.explicacao}</p>
                  <p className="diagnostic__action">
                    <strong>Sugestão: </strong>
                    {message.acaoSugerida}
                  </p>
                </div>
              )
            })}
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
