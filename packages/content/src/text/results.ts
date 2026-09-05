// Textos de resultado, estrelas e selos (SDD §9.E). As três estrelas são
// nomeadas — cada uma atesta um nível de compreensão, nunca destreza ou tempo.

export type StarTier = 1 | 2 | 3

export interface StarInfo {
  readonly tier: StarTier
  readonly name: string
  readonly description: string
}

/** Nome e descrição das estrelas (SDD §9.E). */
export const STARS: readonly StarInfo[] = [
  {
    tier: 1,
    name: 'Circuito completo',
    description: 'Você produziu o comportamento pedido: o circuito funciona.',
  },
  {
    tier: 2,
    name: 'Rota limpa',
    description: 'Você roteou sem desperdício — menos peças, mesma função.',
  },
  {
    tier: 3,
    name: 'Lógica mínima',
    description:
      'Você encontrou uma simplificação lógica: o mesmo resultado com menos portas.',
  },
]

export function starInfo(tier: StarTier): StarInfo {
  const star = STARS.find(s => s.tier === tier)
  if (!star) throw new Error(`estrela inexistente: ${tier}`)
  return star
}

/** Selo exibido no seletor de fases quando a fase foi vencida com dica. */
export const HINT_SEAL_LABEL = 'Resolvida com dica'

/** Título do modal de vitória. */
export const WIN_TITLE = 'Fase concluída!'

/**
 * Explicação da estrela perdida (SDD §9.E): revela que existe uma
 * simplificação, nunca qual é.
 */
export function starLostExplanation(usedPortas: number, limitPortas: number): string {
  return `Você usou ${usedPortas} portas; dá para fazer com ${limitPortas}. Existe uma simplificação escondida aqui.`
}

/** Ação oferecida junto com "Próxima fase" quando faltou estrela. */
export const TRY_AGAIN_LABEL = 'Tentar de novo'
export const NEXT_LEVEL_LABEL = 'Próxima fase'
