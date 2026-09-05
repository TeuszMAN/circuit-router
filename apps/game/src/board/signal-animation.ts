/**
 * Linha do tempo da animação de propagação (SDD §4.7 → §8.4). Converte o traço
 * passo-a-passo da simulação num cronograma de ativação por célula: cada passo
 * ocupa uma janela fixa e as células daquele passo acendem quando a janela
 * chega. Funções puras — o relógio/`requestAnimationFrame` fica no renderizador.
 */

import type { Coord } from '@circuit/core/model'
import type { SimTraceStep } from '@circuit/core/sim'

export const STEP_MS = 190
export const FADE_MS = 160
export const HOLD_MS = 480
/** Intensidade residual de uma célula já ativada (fica "acesa" após o pulso). */
export const STEADY_INTENSITY = 0.55

export interface SignalTimeline {
  /** Passos do traço, na ordem original da simulação. */
  readonly steps: readonly (readonly Coord[])[]
  /** Chave "x,y" da primeira ativação de cada célula (passo em que recebeu sinal). */
  readonly activationByKey: ReadonlyMap<string, number>
  /** Chaves "x,y" de todas as células que receberam sinal em algum passo. */
  readonly activatedKeys: ReadonlySet<string>
  readonly stepCount: number
}

function keyOf(x: number, y: number): string {
  return `${x},${y}`
}

export function buildSignalTimeline(trace: readonly SimTraceStep[]): SignalTimeline {
  const steps = trace.map((step) => step.cells)
  const activationByKey = new Map<string, number>()
  steps.forEach((cells, index) => {
    for (const cell of cells) {
      const key = keyOf(cell.x, cell.y)
      if (!activationByKey.has(key)) activationByKey.set(key, index)
    }
  })
  return {
    steps,
    activationByKey,
    activatedKeys: new Set(activationByKey.keys()),
    stepCount: steps.length,
  }
}

export function signalTotalMs(timeline: SignalTimeline): number {
  if (timeline.stepCount === 0) return 0
  return timeline.stepCount * STEP_MS + FADE_MS + HOLD_MS
}

/**
 * Intensidade [0..1] do pulso de uma célula ativada no passo `activationStep`
 * no instante `t` (ms desde o início da animação). Sobe até 1 durante a janela
 * do passo e decai até `STEADY_INTENSITY` depois — o sinal "passa" e o fio fica
 * energizado até o fim da animação.
 */
export function pulseIntensity(
  t: number,
  activationStep: number,
  stepMs = STEP_MS,
  fadeMs = FADE_MS,
): number {
  const t0 = activationStep * stepMs
  if (t < t0) return 0
  const rise = Math.min(stepMs * 0.5, 140)
  if (t < t0 + rise) return (t - t0) / rise
  if (t < t0 + stepMs) return 1
  const decayEnd = t0 + stepMs + fadeMs
  if (t < decayEnd) {
    const k = (t - (t0 + stepMs)) / fadeMs
    return 1 - k * (1 - STEADY_INTENSITY)
  }
  return STEADY_INTENSITY
}
