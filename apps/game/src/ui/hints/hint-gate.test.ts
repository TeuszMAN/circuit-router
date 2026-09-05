/**
 * Testes do gate da dica de nível 2 (SDD §9.C.2): desbloqueia com 1 simulação
 * falha OU 60s decorridos — permanece bloqueado antes de ambas as condições.
 */
import { describe, expect, it } from 'vitest'
import { HINT_LEVEL_2_UNLOCK_SECONDS, isHintLevel2Unlocked, maxHintLevel } from './hint-gate'

describe('isHintLevel2Unlocked', () => {
  it('permanece bloqueado sem falha e antes dos 60s', () => {
    expect(isHintLevel2Unlocked({ failedOnce: false, elapsedMs: 0 })).toBe(false)
    expect(isHintLevel2Unlocked({ failedOnce: false, elapsedMs: 59_000 })).toBe(false)
  })

  it('desbloqueia com uma simulação falha, independente do tempo', () => {
    expect(isHintLevel2Unlocked({ failedOnce: true, elapsedMs: 0 })).toBe(true)
  })

  it('desbloqueia após 60s, independente de falha', () => {
    const threshold = HINT_LEVEL_2_UNLOCK_SECONDS * 1000
    expect(isHintLevel2Unlocked({ failedOnce: false, elapsedMs: threshold })).toBe(true)
    expect(isHintLevel2Unlocked({ failedOnce: false, elapsedMs: threshold + 1 })).toBe(true)
  })

  it('as duas condições não são cumulativas: qualquer uma já desbloqueia', () => {
    expect(isHintLevel2Unlocked({ failedOnce: true, elapsedMs: 100_000 })).toBe(true)
  })
})

describe('maxHintLevel', () => {
  it('é 1 enquanto bloqueado e 2 quando desbloqueado', () => {
    expect(maxHintLevel({ failedOnce: false, elapsedMs: 0 })).toBe(1)
    expect(maxHintLevel({ failedOnce: true, elapsedMs: 0 })).toBe(2)
  })
})
