// Índice da campanha (MI-07/MI-17/MI-18): agrega os packs de fases em ordem
// de jogo. Cada pack carrega o próprio nome/tema e o conceito de Engenharia
// da Computação que introduz (SDD §9.B), além das fases já validadas pelo
// solver (ver packs.test.ts).

import type { LevelSpec } from '@circuit/core/model'
import { PRIMEIROS_SINAIS_LEVELS } from './01-primeiros-sinais'
import { NEGACOES_LEVELS } from './02-negacoes'
import { E_OU_LEVELS } from './03-e-ou'

export * from './01-primeiros-sinais'
export * from './02-negacoes'
export * from './03-e-ou'

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

/** Todos os packs publicados até aqui (packs 1–3, MI-17), em ordem de jogo. */
export const PACKS: readonly LevelPack[] = [PRIMEIROS_SINAIS_PACK, NEGACOES_PACK, E_OU_PACK]
