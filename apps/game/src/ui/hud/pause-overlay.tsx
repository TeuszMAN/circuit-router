/**
 * Overlay de pausa/menu da tela de jogo. Pausa não é punição nem timer — o
 * jogo não tem tempo; o menu existe para respirar, mudar de fase ou sair.
 */
import { useEffect } from 'preact/hooks'

export interface PauseOverlayProps {
  readonly levelName: string
  readonly onResume: () => void
  readonly onExit: () => void
  readonly onHome: () => void
}

export function PauseOverlay({ levelName, onResume, onExit, onHome }: PauseOverlayProps) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') onResume()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onResume])

  return (
    <div className="overlay">
      <div
        className="pause-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pause-title"
      >
        <h2 id="pause-title" className="pause-panel__title">
          Pausa
        </h2>
        <p style="color:var(--text-muted);font-size:.92rem;margin-top:-8px">{levelName}</p>
        <button type="button" className="btn btn--primary btn--block" onClick={onResume}>
          Retomar
        </button>
        <button type="button" className="btn btn--secondary btn--block" onClick={onExit}>
          Voltar às fases
        </button>
        <button type="button" className="btn btn--ghost btn--block" onClick={onHome}>
          Menu principal
        </button>
      </div>
    </div>
  )
}
