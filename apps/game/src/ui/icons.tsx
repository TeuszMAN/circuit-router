/**
 * Ícones SVG inline (sem fonte de ícones nem CDN — SDD §12.4). Todos herdam
 * `currentColor`, desenhados em viewBox 0 0 24 24.
 */
import type { JSX } from 'preact'

type SvgProps = JSX.SVGAttributes<SVGSVGElement>

function Svg(props: SvgProps): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    />
  )
}

export function IconBack(): JSX.Element {
  return (
    <Svg>
      <path d="M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20v-2Z" />
    </Svg>
  )
}

export function IconUndo(): JSX.Element {
  return (
    <Svg>
      <path d="M9.5 7.5 5 12l4.5 4.5" />
      <path d="M5 12h7.5a6.5 6.5 0 0 1 0 13" />
    </Svg>
  )
}

export function IconRedo(): JSX.Element {
  return (
    <Svg>
      <path d="m14.5 7.5 4.5 4.5-4.5 4.5" />
      <path d="M19 12h-7.5a6.5 6.5 0 0 0 0 13" />
    </Svg>
  )
}

export function IconTrash(): JSX.Element {
  return (
    <Svg>
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="M6.5 7 8 20h8l1.5-13" />
      <path d="M10 11v6M14 11v6" />
    </Svg>
  )
}

export function IconBulb(): JSX.Element {
  return (
    <Svg>
      <path d="M9 18h6" />
      <path d="M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.4 10.9c.8.6 1.4 1.5 1.4 2.6V18h4v-1.5c0-1.1.6-2 1.4-2.6A6 6 0 0 0 12 3Z" />
    </Svg>
  )
}

export function IconPlay(): JSX.Element {
  return (
    <Svg fill="currentColor" stroke="none">
      <path d="M8 5.5v13l11-6.5-11-6.5Z" />
    </Svg>
  )
}

export function IconPause(): JSX.Element {
  return (
    <Svg fill="currentColor" stroke="none">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </Svg>
  )
}

export function IconGear(): JSX.Element {
  return (
    <Svg>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.8v3M12 18.2v3M21.2 12h-3M5.8 12h-3M18.5 5.5l-2.1 2.1M7.6 16.4l-2.1 2.1M18.5 18.5l-2.1-2.1M7.6 7.6 5.5 5.5" />
    </Svg>
  )
}

export function IconQuestion(): JSX.Element {
  return (
    <Svg>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.3 9a2.9 2.9 0 0 1 5.5 1.2c0 1.8-2.8 2.4-2.8 4" />
      <path d="M12 17.8h.01" />
    </Svg>
  )
}

export interface IconStarProps {
  readonly earned?: boolean
  readonly className?: string
}

export function IconStar({ earned = true, className }: IconStarProps): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      aria-hidden="true"
      focusable="false"
      className={className}
      fill={earned ? 'currentColor' : 'none'}
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linejoin="round"
    >
      <path d="m12 2.5 2.9 6.2 6.6.8-4.9 4.6 1.3 6.6L12 17.2 6.1 20.9l1.3-6.6L2.5 9.5l6.6-.8L12 2.5Z" />
    </svg>
  )
}

/** Símbolo esquemático de fio: caminho com curvas, como o jogador desenha. */
export function IconWire(): JSX.Element {
  return (
    <Svg>
      <path d="M3 19h4.5v-6h5V7h4.5" />
      <circle cx="3" cy="19" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="17" cy="7" r="1.6" fill="currentColor" stroke="none" />
    </Svg>
  )
}

/** Porta AND: corpo em "D" (costas retas, frente curva). */
export function IconGateAND(): JSX.Element {
  return (
    <Svg>
      <path d="M4 5h7a7 7 0 0 1 0 14H4V5Z" />
      <path d="M3 9.5h1M3 14.5h1" />
      <path d="M18 12h3" />
    </Svg>
  )
}

/** Porta OR: costas curvas (frente e verso convexos). */
export function IconGateOR(): JSX.Element {
  return (
    <Svg>
      <path d="M6 5h6.5a7 7 0 0 1 0 14H6" />
      <path d="M6 5c1.5 2 2.3 4.4 2.3 7S7.5 17 6 19" />
      <path d="M19.5 12H21" />
    </Svg>
  )
}

/** Porta NOT: triângulo com bolha na saída. */
export function IconGateNOT(): JSX.Element {
  return (
    <Svg>
      <path d="M4 5 14 12 4 19V5Z" />
      <circle cx="16.5" cy="12" r="1.9" />
    </Svg>
  )
}

/** Borracha (apagar peça sob o dedo). */
export function IconEraser(): JSX.Element {
  return (
    <Svg>
      <path d="m7 4 12 12-3 3L4 7l3-3Z" />
      <path d="m13 8 3 3" />
    </Svg>
  )
}

/** Porta genérica em chip da paleta quando houver rotulação textual. */
export function IconChevronRight(): JSX.Element {
  return (
    <Svg>
      <path d="m9 6 6 6-6 6" />
    </Svg>
  )
}
