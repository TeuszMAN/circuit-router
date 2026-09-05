/**
 * Coordenada absoluta em células no grid do tabuleiro (origem 0,0 no canto
 * superior esquerdo). Puramente estrutural — não valida limites de grid.
 */
export interface Coord {
  readonly x: number
  readonly y: number
}

/**
 * Direção cardeal usada tanto para lados de célula (entrada/saída de porta,
 * conexão de fio) quanto para rotação de peças. Não há diagonais.
 */
export type Direction = 'N' | 'S' | 'E' | 'W'
