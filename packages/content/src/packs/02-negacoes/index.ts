import primeiraNegacao from './p2-1'
import chaveVirada from './p2-2'
import contraCorrente from './p2-3'
import duplaNegacao from './p2-4'

export { primeiraNegacao, chaveVirada, contraCorrente, duplaNegacao }

/** Pack 2 — "Negações": as 4 fases, em ordem de jogo. */
export const NEGACOES_LEVELS = [primeiraNegacao, chaveVirada, contraCorrente, duplaNegacao] as const
