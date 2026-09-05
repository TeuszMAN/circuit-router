// Índice da campanha (MI-07/MI-17/MI-18): agrega os packs de fases em ordem
// de jogo. Cada pack carrega o próprio nome/tema e o conceito de Engenharia
// da Computação que introduz (SDD §9.B), além das fases já validadas pelo
// solver ou por simulação explícita (ver packs.test.ts).

import type { LevelSpec } from '@circuit/core/model'
import { PRIMEIROS_SINAIS_LEVELS } from './01-primeiros-sinais'
import { NEGACOES_LEVELS } from './02-negacoes'
import { E_OU_LEVELS } from './03-e-ou'
import { COMPONDO_LEVELS } from './04-compondo'
import { CAMINHOS_LEVELS } from './05-caminhos'
import { SOMANDO_BITS_LEVELS } from './06-somando-bits'

export * from './01-primeiros-sinais'
export * from './02-negacoes'
export * from './03-e-ou'
export * from './04-compondo'
export * from './05-caminhos'
export * from './06-somando-bits'

/** Um pack de fases: identidade, tema didático e as fases que o compõem. */
export interface LevelPack {
  readonly id: string
  readonly name: string
  readonly theme: string
  /** Conceito de Engenharia da Computação introduzido pelo pack (SDD §9.B). */
  readonly concept: string
  readonly levels: readonly LevelSpec[]
}

export const PRIMEIROS_SINAIS_PACK: LevelPack = {
  id: 'pack-01',
  name: 'Primeiros sinais',
  theme: 'Fonte, fio e destino',
  concept: 'Nível lógico binário; condutor; fonte e carga.',
  levels: PRIMEIROS_SINAIS_LEVELS,
}

export const NEGACOES_PACK: LevelPack = {
  id: 'pack-02',
  name: 'Negações',
  theme: 'O inversor e a dupla negação',
  concept: 'Inversor; complemento booleano (Ā); tabela-verdade de 1 entrada.',
  levels: NEGACOES_LEVELS,
}

export const E_OU_PACK: LevelPack = {
  id: 'pack-03',
  name: 'E / OU',
  theme: 'Conjunção, disjunção e a tabela-verdade de 2 entradas',
  concept: 'Conjunção e disjunção; tabela-verdade de 2 entradas; "os dois" vs "pelo menos um".',
  levels: E_OU_LEVELS,
}

export const COMPONDO_PACK: LevelPack = {
  id: 'pack-04',
  name: 'Compondo',
  theme: 'Composição e precedência',
  concept: 'Composição de funções; expressão booleana com precedência (· antes de +); circuito de 2 níveis.',
  levels: COMPONDO_LEVELS,
}

export const CAMINHOS_PACK: LevelPack = {
  id: 'pack-05',
  name: 'Caminhos',
  theme: 'Roteamento, net, curto e ciclo',
  concept: 'Net (nó elétrico) e fan-out; conflito de drivers (curto-circuito); realimentação combinacional (ciclo).',
  levels: CAMINHOS_LEVELS,
}

export const SOMANDO_BITS_PACK: LevelPack = {
  id: 'pack-06',
  name: 'Somando bits',
  theme: 'Aritmética binária em hardware',
  concept: 'Aritmética binária em hardware; meio-somador (soma + vai-um) e somador completo; XOR construído a partir de AND/OR/NOT.',
  levels: SOMANDO_BITS_LEVELS,
}

/** Todos os 6 packs publicados da campanha (MI-17 e MI-18), em ordem de jogo. */
export const PACKS: readonly LevelPack[] = [
  PRIMEIROS_SINAIS_PACK,
  NEGACOES_PACK,
  E_OU_PACK,
  COMPONDO_PACK,
  CAMINHOS_PACK,
  SOMANDO_BITS_PACK,
]
