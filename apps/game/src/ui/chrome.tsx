/**
 * Peças de chrome reutilizáveis: botão de ícone, cabeçalho de tela e linha de
 * estrelas. Todos os alvos têm >= 44px (CSS), com `aria-label` explícito.
 */
import type { ComponentChildren } from 'preact'
import { IconBack, IconStar } from './icons'

export interface IconButtonProps {
  readonly label: string
  readonly onClick?: () => void
  readonly disabled?: boolean
  readonly className?: string
  readonly children?: ComponentChildren
}

export function IconButton({
  label,
  onClick,
  disabled,
  className,
  children,
}: IconButtonProps) {
  return (
    <button
      type="button"
      className={`icon-btn${className ? ` ${className}` : ''}`}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

export interface ScreenHeaderProps {
  readonly title: string
  readonly onBack?: () => void
  readonly backLabel?: string
  readonly action?: ComponentChildren
}

export function ScreenHeader({ title, onBack, backLabel = 'Voltar', action }: ScreenHeaderProps) {
  return (
    <header className="screen-header safe-top">
      {onBack ? (
        <IconButton label={backLabel} onClick={onBack}>
          <IconBack />
        </IconButton>
      ) : (
        <span className="icon-btn" aria-hidden="true" style="visibility:hidden" />
      )}
      <h1 className="screen-header__title">{title}</h1>
      {action ?? <span aria-hidden="true" style="visibility:hidden;width:44px;height:44px" />}
    </header>
  )
}

export interface StarRowProps {
  /** Quantas estrelas foram conquistadas (0 a 3). */
  readonly earned: number
  readonly total?: number
  readonly small?: boolean
  readonly label: string
}

/** Três estrelas, preenchidas conforme o progresso da fase (SDD §9.E). */
export function StarRow({ earned, total = 3, small, label }: StarRowProps) {
  const className = `stars${small ? ' star--small' : ''}`
  return (
    <span
      className={className}
      role="img"
      aria-label={`${label}: ${earned} de ${total} estrelas`}
    >
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`star${i < earned ? ' star--earned' : ''}`}>
          <IconStar earned={i < earned} />
        </span>
      ))}
    </span>
  )
}
