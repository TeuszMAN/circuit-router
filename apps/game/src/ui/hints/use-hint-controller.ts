/**
 * Estado do botão de dica em dois níveis (SDD §9.C.2). Encapsula o gate de
 * desbloqueio (`hint-gate.ts`) e o ciclo de exibição: nível 0 (fechada) → 1
 * (empurrão conceitual) → 2 (solução parcial, só se desbloqueado) → 0.
 */
import { useSignal } from '@preact/signals'
import { useEffect } from 'preact/hooks'
import type { LevelHints } from '@circuit/core/model'
import { isHintLevel2Unlocked } from './hint-gate'

export interface HintController {
  readonly level: 0 | 1 | 2
  /** Texto da dica no nível atual, ou null com a dica fechada. */
  readonly text: string | null
  readonly bannerLabel: string
  /** A dica de nível 2 já foi usada nesta fase (marca "resolvida com dica"). */
  readonly used: boolean
  press(): void
  close(): void
  /** Chamar quando uma simulação falhar — desbloqueia o nível 2 (SDD §9.C.2). */
  notifyFailure(): void
}

/** Acompanha o tempo decorrido desde a montagem, em ms, atualizado a cada segundo. */
function useElapsedMs(): number {
  const elapsed = useSignal(0)
  useEffect(() => {
    const start = Date.now()
    const id = setInterval(() => {
      elapsed.value = Date.now() - start
    }, 1000)
    return () => clearInterval(id)
  }, [])
  return elapsed.value
}

export function useHintController(hints: LevelHints): HintController {
  const level = useSignal<0 | 1 | 2>(0)
  const used = useSignal(false)
  const failedOnce = useSignal(false)
  const elapsedMs = useElapsedMs()

  const unlocked = isHintLevel2Unlocked({ failedOnce: failedOnce.value, elapsedMs })
  const max: 1 | 2 = unlocked ? 2 : 1

  function press(): void {
    const current = level.value
    let next: 0 | 1 | 2
    if (current === 0) next = 1
    else if (current >= max) next = 0
    else next = (current + 1) as 1 | 2
    level.value = next
    if (next > 0) used.value = true
  }

  function close(): void {
    level.value = 0
  }

  function notifyFailure(): void {
    failedOnce.value = true
  }

  const currentLevel = level.value
  const text = currentLevel === 0 ? null : currentLevel === 1 ? hints[0] : hints[1]
  return {
    level: currentLevel,
    text,
    bannerLabel: currentLevel === 1 ? 'Dica' : 'Dica extra',
    used: used.value,
    press,
    close,
    notifyFailure,
  }
}
