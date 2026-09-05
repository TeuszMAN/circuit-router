import primeiroSinal from './p1-1'
import sinalZero from './p1-2'
import desvio from './p1-3'

export { primeiroSinal, sinalZero, desvio }

/** Pack 1 — "Primeiros sinais": as 3 fases, em ordem de jogo. */
export const PRIMEIROS_SINAIS_LEVELS = [primeiroSinal, sinalZero, desvio] as const
