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

export function LevelSelect({
  state,
  levels,
  onPick,
  onBack,
}: LevelSelectProps) {
  const chapters = new Map<
    string,
    {
      name: string
      theme: string
      entries: { level: LevelSummary; index: number }[]
    }
  >()
  for (const [index, level] of levels.entries()) {
    const id = level.pack?.id ?? 'campaign'
    if (!chapters.has(id))
      chapters.set(id, {
        name: level.pack?.name ?? 'Seus circuitos',
        theme: level.pack?.theme ?? 'Uma conexão de cada vez',
        entries: [],
      })
    chapters.get(id)!.entries.push({ level, index })
  }
  const completed = levels.filter(
    (level) => (state.progressFor(level.id)?.stars ?? 0) > 0,
  ).length
  const stars = levels.reduce(
    (total, level) => total + (state.progressFor(level.id)?.stars ?? 0),
    0,
  )
  const next = levels.find((level) => !state.progressFor(level.id)?.stars)?.id
  return (
    <div className="app-screen campaign-screen">
      <ScreenHeader title="Fases" onBack={onBack} backLabel="Voltar ao menu" />
      <main className="levels">
        <div className="campaign-intro">
          <div>
            <p className="eyebrow">Seu percurso</p>
            <h2>
              Da primeira conexão
              <br />
              às grandes ideias.
            </h2>
            <p className="levels__intro">
              Escolha um circuito. Experimente, ajuste e faça o sinal chegar.
            </p>
          </div>
          <div className="campaign-progress">
            <span className="campaign-progress__count">
              {completed}
              <span> / {levels.length}</span>
            </span>
            <span>fases concluídas</span>
            <progress
              value={completed}
              max={Math.max(1, levels.length)}
              aria-label="Progresso da campanha"
            />
            <span className="campaign-progress__stars">
              ★ {stars} de {levels.length * 3} estrelas
            </span>
          </div>
        </div>
        <div className="chapter-grid">
          {[...chapters].map(([id, chapter], chapterIndex) => (
            <section className="chapter" key={id} aria-label={chapter.name}>
              <header className="chapter__head">
                <span className="chapter__number" aria-hidden="true">
                  {String(chapterIndex + 1).padStart(2, '0')}
                </span>
                <div>
                  <h2>{chapter.name}</h2>
                  <p>{chapter.theme}</p>
                </div>
              </header>
              <ol
                className="level-list"
                start={(chapter.entries[0]?.index ?? 0) + 1}
              >
                {chapter.entries.map(({ level, index }) => {
                  const progress = state.progressFor(level.id)
                  const earnedStars = progress?.stars ?? 0
                  return (
                    <li key={level.id}>
                      <button
                        type="button"
                        className={`level-card${level.id === next ? ' level-card--next' : ''}${earnedStars ? ' level-card--complete' : ''}`}
                        onClick={() => onPick(level.id)}
                      >
                        <span className="level-card__num" aria-hidden="true">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <span className="level-card__body">
                          <span className="level-card__name">{level.name}</span>
                          <span className="level-card__meta">
                            <StarRow
                              earned={earnedStars}
                              small
                              label={`Estrelas de ${level.name}`}
                            />
                            {progress?.completedWithHint ? (
                              <span className="hint-seal">
                                {HINT_SEAL_LABEL}
                              </span>
                            ) : null}
                          </span>
                        </span>
                        <span className="level-card__go" aria-hidden="true">
                          <IconChevronRight />
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ol>
            </section>
          ))}
        </div>
      </main>
    </div>
  )
}
