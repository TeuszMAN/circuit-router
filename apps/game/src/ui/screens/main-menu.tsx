/**
 * Menu principal — porta de entrada do shell. Título/h1 "Circuit Router".
 */
import type { AppState } from '../state'
import { IconGear, IconPlay } from '../icons'

export function MainMenu({ state }: { readonly state: AppState }) {
  return (
    <div className="app-screen">
      <div className="menu safe-top">
        <div className="menu__brand">
          <div className="menu__logo" aria-hidden="true">
            {/* Monograma provisório — substituído por ícone do manifesto (MI-11). */}
            <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <circle cx="4.5" cy="12" r="2" fill="currentColor" stroke="none" />
              <path d="M6.5 12H11" />
              <path d="M13 12h4.5" />
              <circle cx="19.5" cy="12" r="2" fill="currentColor" stroke="none" />
              <path d="M13 8v8M11 8v8M8.5 8v8" opacity="0.4" />
            </svg>
          </div>
          <h1 className="menu__title">Circuit Router</h1>
          <p className="menu__tagline">
            Roteie sinais, ligue portas lógicas e descubra como os circuitos pensam.
          </p>
        </div>

        <nav className="menu__actions" aria-label="Navegação principal">
          <button
            type="button"
            className="btn btn--primary btn--block"
            onClick={() => state.navigate({ name: 'levels' })}
          >
            <IconPlay />
            Jogar
          </button>
          <button
            type="button"
            className="btn btn--secondary btn--block"
            onClick={() => state.navigate({ name: 'settings' })}
          >
            <IconGear />
            Configurações
          </button>
        </nav>

        <p className="menu__footer">
          Circuit Router · jogo educativo de lógica digital
        </p>
      </div>
    </div>
  )
}
