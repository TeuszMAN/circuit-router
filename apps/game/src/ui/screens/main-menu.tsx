import { useSignal } from '@preact/signals'
import { evaluateGate } from '@circuit/core/sim'
import { inverterPreviewHint } from '@circuit/content/text'
import type { AppState } from '../state'
import type { LevelSummary } from '../campaign'
import { IconGear, IconPlay, IconChevronRight } from '../icons'

/** Uma amostra interativa do inversor; não altera o progresso da campanha. */
function CircuitPreview() {
  const input = useSignal<0 | 1>(1)
  // O exemplo usa a mesma tabela-verdade do jogo; a entrada é sempre um bit.
  const output = evaluateGate('NOT', [input.value])!
  return (
    <div className="circuit-preview" data-signal={input.value}>
      <div className="circuit-preview__head">
        <span>O primeiro experimento</span>
        <span className="circuit-preview__live">Interativo</span>
      </div>
      <div className="circuit-preview__board">
        <svg
          viewBox="0 0 360 228"
          aria-hidden="true"
          className="circuit-preview__diagram"
        >
          <path
            className="preview-track preview-track--input"
            d="M60 114H112V70H152"
          />
          <path
            className="preview-track preview-track--output"
            d="M208 70H248V114H300"
          />
          <rect
            x="152"
            y="46"
            width="56"
            height="48"
            rx="12"
            className="preview-chip"
          />
          <text
            x="180"
            y="75"
            text-anchor="middle"
            className="preview-chip-label"
          >
            NOT
          </text>
          <path d="m213 66 5 4-5 4" className="preview-arrow" />
          <circle cx="300" cy="114" r="25" className="preview-destination" />
          <text x="300" y="123" text-anchor="middle" className="preview-value">
            {output}
          </text>
          <text x="60" y="165" text-anchor="middle" className="preview-caption">
            ENTRADA
          </text>
          <text
            x="300"
            y="165"
            text-anchor="middle"
            className="preview-caption"
          >
            SAÍDA
          </text>
          <path d="M150 192h60" className="preview-rule" />
        </svg>
        <button
          className="circuit-preview__source"
          type="button"
          aria-label="Alternar sinal de entrada"
          onClick={() => {
            input.value = output
          }}
        >
          {input.value}
        </button>
      </div>
      <p className="circuit-preview__hint" aria-live="polite">
        {inverterPreviewHint(input.value, output)}
      </p>
    </div>
  )
}

export function MainMenu({
  state,
  levels = [],
}: {
  readonly state: AppState
  readonly levels?: readonly LevelSummary[]
}) {
  const completed = levels.filter(
    (level) => (state.progressFor(level.id)?.stars ?? 0) > 0,
  ).length
  const next = levels.find((level) => !state.progressFor(level.id)?.stars)
  return (
    <div className="app-screen home-screen">
      <header className="home-header safe-top">
        <span className="brand-mark" aria-hidden="true">
          c<span>r</span>
          <i />
        </span>
        <span className="home-header__label">UM JOGO DE LÓGICA DIGITAL</span>
        <button
          type="button"
          className="icon-btn"
          aria-label="Configurações"
          onClick={() => state.navigate({ name: 'settings' })}
        >
          <IconGear />
        </button>
      </header>
      <main className="menu">
        <div className="menu__copy">
          <p className="eyebrow">Conecte. Teste. Descubra.</p>
          <h1 className="menu__title">
            Circuit{' '}
            <span>
              Router
              <span className="menu__route-mark" aria-hidden="true">
                ↗
              </span>
            </span>
          </h1>
          <p className="menu__tagline">
            Pequenas conexões.
            <br /> Grandes ideias.
          </p>
          <p className="menu__description">
            Leve cada sinal ao seu destino e descubra a lógica por trás do
            caminho.
          </p>
          <nav className="menu__actions" aria-label="Navegação principal">
            <button
              type="button"
              className="btn btn--primary menu__play"
              onClick={() => state.navigate({ name: 'levels' })}
            >
              <IconPlay />
              <span>Jogar</span>
              <IconChevronRight />
            </button>
            <p className="menu__next">
              {next
                ? `Próximo desafio: ${next.name}`
                : 'Revisite os circuitos e aperfeiçoe suas rotas.'}
            </p>
          </nav>
        </div>
        <CircuitPreview />
      </main>
      <footer className="home-footer">
        <span className="home-footer__note">
          O caminho é seu. A lógica também.
        </span>
        <span className="home-progress">
          <span>
            {completed} / {levels.length}
          </span>{' '}
          fases concluídas
        </span>
      </footer>
    </div>
  )
}
