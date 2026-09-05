import umSinalDoisDestinos from './p5-1'
import duasFontesUmDestino from './p5-2'
import lacoQueNaoFecha from './p5-3'
import doisCaminhosUmaSaida from './p5-4'
import corredorEmZigueZague from './p5-5'

export { umSinalDoisDestinos, duasFontesUmDestino, lacoQueNaoFecha, doisCaminhosUmaSaida, corredorEmZigueZague }

/** Pack 5 — "Caminhos": as 5 fases, em ordem de jogo. */
export const CAMINHOS_LEVELS = [
  umSinalDoisDestinos,
  duasFontesUmDestino,
  lacoQueNaoFecha,
  doisCaminhosUmaSaida,
  corredorEmZigueZague,
] as const
