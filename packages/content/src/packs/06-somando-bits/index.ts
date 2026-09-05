import primeiroXor from './p6-1'
import meioSomador from './p6-2'
import somadorCompleto from './p6-3'

export { primeiroXor, meioSomador, somadorCompleto }

/** Pack 6 — "Somando bits": as 3 fases, em ordem de jogo. */
export const SOMANDO_BITS_LEVELS = [primeiroXor, meioSomador, somadorCompleto] as const
