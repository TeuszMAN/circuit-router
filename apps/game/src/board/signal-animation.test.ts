import { describe, expect, it } from 'vitest'
import {
  buildSignalTimeline,
  FADE_MS,
  HOLD_MS,
  pulseIntensity,
  signalTotalMs,
  STEADY_INTENSITY,
  STEP_MS,
} from './signal-animation'

describe('buildSignalTimeline', () => {
  it('mapeia cada passo do traço para células ativadas no índice do passo', () => {
    const timeline = buildSignalTimeline([
      { cells: [{ x: 1, y: 0 }, { x: 2, y: 0 }] },
      { cells: [{ x: 3, y: 0 }] },
    ])
    expect(timeline.stepCount).toBe(2)
    expect(timeline.activationByKey.get('1,0')).toBe(0)
    expect(timeline.activationByKey.get('2,0')).toBe(0)
    expect(timeline.activationByKey.get('3,0')).toBe(1)
    expect([...timeline.activatedKeys].sort()).toEqual(['1,0', '2,0', '3,0'])
  })

  it('mantém a primeira ativação quando uma célula aparece em vários passos', () => {
    const timeline = buildSignalTimeline([
      { cells: [{ x: 1, y: 0 }] },
      { cells: [{ x: 1, y: 0 }, { x: 4, y: 1 }] },
    ])
    expect(timeline.activationByKey.get('1,0')).toBe(0)
    expect(timeline.activationByKey.get('4,1')).toBe(1)
  })

  it('traço vazio vira timeline sem passos e sem duração', () => {
    const timeline = buildSignalTimeline([])
    expect(timeline.stepCount).toBe(0)
    expect(timeline.activatedKeys.size).toBe(0)
    expect(signalTotalMs(timeline)).toBe(0)
  })
})

describe('pulseIntensity', () => {
  it('fica em 0 antes da janela da célula', () => {
    expect(pulseIntensity(0, 1)).toBe(0)
    expect(pulseIntensity(STEP_MS - 1, 1)).toBe(0)
  })

  it('sobe até 1 dentro da janela do passo e permanece em 1', () => {
    expect(pulseIntensity(STEP_MS + 1, 1)).toBeGreaterThan(0)
    expect(pulseIntensity(STEP_MS * 2 - 1, 1)).toBe(1)
  })

  it('decai até a intensidade estável após a janela', () => {
    const end = 2 * STEP_MS + FADE_MS
    expect(pulseIntensity(end - 1, 1)).toBeGreaterThan(STEADY_INTENSITY)
    expect(pulseIntensity(end, 1)).toBe(STEADY_INTENSITY)
    expect(pulseIntensity(end + HOLD_MS, 1)).toBe(STEADY_INTENSITY)
  })

  it('duração total = passos + fade + hold', () => {
    const timeline = buildSignalTimeline([{ cells: [] }, { cells: [] }, { cells: [] }])
    expect(signalTotalMs(timeline)).toBe(3 * STEP_MS + FADE_MS + HOLD_MS)
  })
})
