import eDeVerdade from './p3-1'
import ouDeVerdade from './p3-2'
import gemeaAnd from './p3-3'
import gemeaOr from './p3-4'
import soUmaLinha from './p3-5'

export { eDeVerdade, ouDeVerdade, gemeaAnd, gemeaOr, soUmaLinha }

/** Pack 3 — "E / OU": as 5 fases, em ordem de jogo. */
export const E_OU_LEVELS = [eDeVerdade, ouDeVerdade, gemeaAnd, gemeaOr, soUmaLinha] as const
