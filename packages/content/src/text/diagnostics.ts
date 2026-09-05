// Catálogo de mensagens de diagnóstico (SDD §9.C.1). A engine devolve
// `issues[]` tipados; a UI traduz cada `kind` em três camadas: título curto,
// explicação de aprendiz e ação sugerida. Regras: tom neutro-curioso, nunca
// vocabulário de implementação na primeira camada, sempre apontar o erro no
// tabuleiro (highlight fica com o renderer). Sem dependência de DOM.

import type { IssueKind } from '@circuit/core/model'

export type DiagnosticKind = IssueKind | 'sink-mismatch'

export interface DiagnosticMessage {
  readonly kind: DiagnosticKind
  readonly titulo: string
  readonly explicacao: string
  readonly acaoSugerida: string
}

/** Mensagens por `issue.kind` da simulação (SDD §9.C.1). */
export const ISSUE_MESSAGES: Readonly<Record<IssueKind, DiagnosticMessage>> = {
  short: {
    kind: 'short',
    titulo: 'Dois donos no mesmo fio',
    explicacao:
      'Dois sinais diferentes estão brigando no mesmo fio: um manda 0, o outro manda 1, e o fio não consegue ser os dois. Na eletrônica de verdade, isso é um curto-circuito.',
    acaoSugerida: 'Separe os caminhos ou faça os dois passarem por uma porta.',
  },
  cycle: {
    kind: 'cycle',
    titulo: 'Um fio que depende de si mesmo',
    explicacao:
      'Esta saída volta como a própria entrada. Para saber o valor, ela precisaria já saber o valor — a pergunta se morde.',
    acaoSugerida: 'Quebre o laço: alguma entrada precisa vir de fora.',
  },
  floating: {
    kind: 'floating',
    titulo: 'Fio sem ninguém falando',
    explicacao:
      'Este fio não está ligado a nenhuma fonte. Ele não vale 0 — ele simplesmente não tem valor ainda.',
    acaoSugerida: 'Ligue este trecho a uma fonte ou à saída de uma porta.',
  },
  'unpowered-gate': {
    kind: 'unpowered-gate',
    titulo: 'Porta com entrada faltando',
    explicacao:
      'Esta porta espera receber sinais em todas as entradas e ainda falta pelo menos um. Sem todos os sinais, ela não sabe o que responder.',
    acaoSugerida: 'Alimente o lado destacado da porta.',
  },
}

/** Caso especial: o circuito fecha, mas um destino recebeu o valor errado. */
export const SINK_MISMATCH_TEMPLATE: DiagnosticMessage = {
  kind: 'sink-mismatch',
  titulo: 'Quase lá',
  explicacao:
    'O circuito funciona, mas o destino esperava {esperado} e recebeu {obtido}.',
  acaoSugerida: 'Confira a tabela-verdade da porta no painel de conceito (?).',
}

/** Mensagem para um `issue.kind` da simulação. */
export function messageForIssue(kind: IssueKind): DiagnosticMessage {
  return ISSUE_MESSAGES[kind]
}

/**
 * Monta a mensagem de destino insatisfeito substituindo os placeholders
 * {esperado} e {obtido} (SDD §9.C.1). `actual` pode ser undefined (fio sem
 * sinal) — nesse caso o texto diz "nada (sem sinal)", nunca a palavra "undefined".
 */
export function formatSinkMismatch(expected: 0 | 1, actual: 0 | 1 | undefined): DiagnosticMessage {
  const obtido = actual === undefined ? 'nada (sem sinal)' : String(actual)
  return {
    ...SINK_MISMATCH_TEMPLATE,
    explicacao: SINK_MISMATCH_TEMPLATE.explicacao
      .replace('{esperado}', String(expected))
      .replace('{obtido}', obtido),
  }
}
