import primeiroComposto from './p4-1'
import eAntesDeOu from './p4-2'
import ouDentroDoE from './p4-3'
import doisNiveis from './p4-4'

export { primeiroComposto, eAntesDeOu, ouDentroDoE, doisNiveis }

/** Pack 4 — "Compondo": as 4 fases, em ordem de jogo. */
export const COMPONDO_LEVELS = [primeiroComposto, eAntesDeOu, ouDentroDoE, doisNiveis] as const
