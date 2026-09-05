/** Faixa de dica exibida sobre o tabuleiro (SDD §9.C.2). */
export interface HintBannerProps {
  readonly label: string
  readonly text: string
  readonly onClose: () => void
}

export function HintBanner({ label, text, onClose }: HintBannerProps) {
  return (
    <div className="hint-banner" data-testid="hint-banner">
      <div className="hint-banner__head">
        <span>{label}</span>
        <button type="button" aria-label="Fechar dica" onClick={onClose}>
          ✕
        </button>
      </div>
      <p>{text}</p>
    </div>
  )
}
