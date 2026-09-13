/**
 * Tokens de tema do tabuleiro (SDD §8.5). O renderizador nunca hardcoda cor —
 * todo desenho consulta `BoardTheme`. O shell (MI-10) poderá trocar o tema
 * passando outro `Partial<BoardTheme>` ao construtor do renderizador.
 *
 * Bancada azul escura (sinal 1 ciano, sinal 0 coral).
 */

export interface SignalColors {
  /** Valor lógico 1. */
  readonly high: string
  /** Valor lógico 0. */
  readonly low: string
  /** Cor do pulso de propagação (animação do traço). */
  readonly pulse: string
}

export interface IssuePalette {
  readonly short: string
  readonly cycle: string
  readonly floating: string
  readonly unpowered: string
}

export interface BoardTheme {
  /** Fundo do canvas. */
  readonly background: string
  /** Contorno externo do grid. */
  readonly boardFrame: string
  /** Linhas internas do grid. */
  readonly gridLine: string
  /** Fio sem sinal (flutuante / aguardando propagação). */
  readonly wireIdle: string
  /** Fio que recebeu sinal (estado estável pós-animação). */
  readonly wireEnergized: string
  /** Corpo de dispositivos (porta, fonte, sink). */
  readonly chipFill: string
  /** Borda de dispositivos. */
  readonly chipStroke: string
  /** Texto sobre chips (rótulo de porta, valor de fonte/sink). */
  readonly text: string
  /** Cor do marcador de saída da porta. */
  readonly gateOutput: string
  /** Anel de sink ainda não satisfeito. */
  readonly sinkRing: string
  /** Anel de sink satisfeito. */
  readonly sinkSatisfied: string
  /** Contorno da célula selecionada. */
  readonly selected: string
  /** Cores de diagnóstico — uma por `IssueKind`. */
  readonly issue: IssuePalette
  readonly signal: SignalColors
}

export const darkTheme: BoardTheme = {
  background: '#222b45',
  boardFrame: '#45516d',
  gridLine: '#35415e',
  wireIdle: '#8997b5',
  wireEnergized: '#58e0d0',
  chipFill: '#303c59',
  chipStroke: '#96a5c4',
  text: '#edf2ff',
  gateOutput: '#94a3b8',
  sinkRing: '#a3b0cd',
  sinkSatisfied: '#83e3b6',
  selected: '#c6baff',
  issue: {
    short: '#ff3b5c',
    cycle: '#ff9f1c',
    floating: '#8aa0b8',
    unpowered: '#f4a259',
  },
  signal: {
    high: '#58e0d0',
    low: '#ffa394',
    pulse: '#a3f2e8',
  },
}

function mergeSignal(base: SignalColors, patch?: Partial<SignalColors>): SignalColors {
  return { ...base, ...patch }
}

function mergeIssue(base: IssuePalette, patch?: Partial<IssuePalette>): IssuePalette {
  return { ...base, ...patch }
}

/** Funde um tema parcial sobre o escuro padrão (overrides profundos). */
export function withTheme(overrides?: Partial<BoardTheme>): BoardTheme {
  if (!overrides) return darkTheme
  return {
    ...darkTheme,
    ...overrides,
    issue: mergeIssue(darkTheme.issue, overrides.issue),
    signal: mergeSignal(darkTheme.signal, overrides.signal),
  }
}

/** Cor que representa um valor lógico 0/1 (SDD §9.A P1). */
export function valueColor(theme: BoardTheme, value: 0 | 1): string {
  return value === 1 ? theme.signal.high : theme.signal.low
}
