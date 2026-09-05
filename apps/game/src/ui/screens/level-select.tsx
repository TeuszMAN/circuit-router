/**
 * Seleção de fases — lista com estrelas por fase e selo "resolvida com dica"
 * (SDD §9.C.2/§9.E). Dados vêm da campanha por `summaries`; progresso vem do
 * estado (persistido pelo core, MI-06).
 */
import { HINT_SEAL_LABEL } from '@circuit/content/text'
import type { AppState } from '../state'
import type { LevelSummary } from '../campaign'
import { ScreenHeader, StarRow } from '../chrome'
import { IconChevronRight } from '../icons'

export interface LevelSelectProps {
  readonly state: AppState
  readonly levels: readonly LevelSummary[]
  readonly onPick: (levelId: string) => void
  readonly onBack: () => void
}

export function LevelSelect({ state, levels, onPick, onBack }: LevelSelectProps) {
  return (
    <div className="app-screen">
      <ScreenHeader title="Fases" onBack={onBack} backLabel="Voltar ao menu" />

      <div className="levels">
        <p className="levels__intro">
          Cada fase é um circuito para montar. Vença para ganhar estrelas e
          tente sempre fazer com menos peças.
        </p>

        <ol className="level-list">
          {levels.map((level, index) => {
            const progress = state.progressFor(level.id)
            const earnedStars = progress?.stars ?? 0
            const seal = progress?.completedWithHint === true
            return (
              <li key={level.id}>
                <button
                  type="button"
                  className="level-card"
                  onClick={() => onPick(level.id)}
                >
                  <span className="level-card__num" aria-hidden="true">
                    {index + 1}
                  </span>
                  <span className="level-card__body">
                    <span className="level-card__name">{level.name}</span>
                    <span className="level-card__meta">
                      <StarRow
                        earned={earnedStars}
                        small
                        label={`Estrelas de ${level.name}`}
                      />
                      {seal ? <span className="hint-seal">{HINT_SEAL_LABEL}</span> : null}
                    </span>
                  </span>
                  <span aria-hidden="true">
                    <IconChevronRight />
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
