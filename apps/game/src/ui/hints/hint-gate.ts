/**
 * Gate da dica de nível 2 (SDD §9.C.2): "solução parcial" só desbloqueia
 * depois de uma simulação que falhou OU de 60s decorridos na fase — nunca
 * antes, para não virar botão de pular. Uma condição já basta; não são
 * cumulativas.
 */
export const HINT_LEVEL_2_UNLOCK_SECONDS = 60

export interface HintUnlockState {
  readonly failedOnce: boolean
  readonly elapsedMs: number
}

export function isHintLevel2Unlocked({ failedOnce, elapsedMs }: HintUnlockState): boolean {
  return failedOnce || elapsedMs >= HINT_LEVEL_2_UNLOCK_SECONDS * 1000
}

/** Nível máximo de dica alcançável no estado atual (SDD §9.C.2: nunca há nível 3). */
export function maxHintLevel(state: HintUnlockState): 1 | 2 {
  return isHintLevel2Unlocked(state) ? 2 : 1
}
