// Testes do módulo de textos (MI-19): exaustividade sobre os kinds de
// diagnóstico, ausência de jargão de implementação, placeholders, glossário
// e estrelas. Roda em ambiente node (vitest).

import { describe, expect, test } from 'vitest'
import type { IssueKind } from '@circuit/core/model'
import {
  GLOSSARY,
  glossaryEntry,
} from './glossary'
import {
  ISSUE_MESSAGES,
  SINK_MISMATCH_TEMPLATE,
  formatSinkMismatch,
  messageForIssue,
  type DiagnosticMessage,
} from './diagnostics'
import {
  STARS,
  HINT_SEAL_LABEL,
  starInfo,
  starLostExplanation,
  TRY_AGAIN_LABEL,
  NEXT_LEVEL_LABEL,
  WIN_TITLE,
} from './results'

/** Todos os `IssueKind` declarados no modelo (a engine só emite estes). */
const ALL_ISSUE_KINDS: readonly IssueKind[] = [
  'short',
  'cycle',
  'floating',
  'unpowered-gate',
]

const JARGON_BLACKLIST = [
  'union-find',
  'SCC',
  'driver conflict',
  'exception',
  'null',
  'undefined',
  'issue',
  'kind',
]

function firstLayerTexts(message: DiagnosticMessage): string {
  return `${message.titulo} ${message.explicacao} ${message.acaoSugerida}`
}

describe('catálogo de diagnóstico (MI-19)', () => {
  test('existe mensagem para todo IssueKind do modelo', () => {
    for (const kind of ALL_ISSUE_KINDS) {
      expect(messageForIssue(kind).kind).toBe(kind)
    }
  })

  test('catálogo tem exatamente os kinds do modelo + sink-mismatch', () => {
    const cataloged = new Set([
      ...Object.keys(ISSUE_MESSAGES),
      SINK_MISMATCH_TEMPLATE.kind,
    ])
    for (const kind of ALL_ISSUE_KINDS) {
      expect(cataloged.has(kind)).toBe(true)
    }
    expect(cataloged.has('sink-mismatch')).toBe(true)
  })

  test('nenhuma mensagem de primeira camada contém jargão de implementação', () => {
    const all = [...Object.values(ISSUE_MESSAGES), SINK_MISMATCH_TEMPLATE]
    for (const message of all) {
      const text = firstLayerTexts(message).toLowerCase()
      for (const jargon of JARGON_BLACKLIST) {
        expect(text).not.toContain(jargon)
      }
    }
  })

  test('sink-mismatch declara placeholders e a interpolação os remove', () => {
    expect(SINK_MISMATCH_TEMPLATE.explicacao).toContain('{esperado}')
    expect(SINK_MISMATCH_TEMPLATE.explicacao).toContain('{obtido}')

    const comSinal = formatSinkMismatch(1, 0)
    expect(comSinal.explicacao).toContain('esperava 1 e recebeu 0')
    expect(comSinal.explicacao).not.toMatch(/\{|\}/)

    const semSinal = formatSinkMismatch(1, undefined)
    expect(semSinal.explicacao).toContain('nada (sem sinal)')
    expect(semSinal.explicacao).not.toContain('undefined')
  })

  test('mensagens não estão vazias e têm ação sugerida', () => {
    for (const message of [...Object.values(ISSUE_MESSAGES), SINK_MISMATCH_TEMPLATE]) {
      expect(message.titulo.length).toBeGreaterThan(0)
      expect(message.explicacao.length).toBeGreaterThan(0)
      expect(message.acaoSugerida.length).toBeGreaterThan(0)
    }
  })
})

describe('glossário (MI-19)', () => {
  const REQUIRED_TERMS = [
    'Sinal',
    'Fonte (source)',
    'Destino (sink)',
    'Fio',
    'Net',
    'Curto-circuito',
    'Ciclo',
    'Flutuante',
    'Porta lógica',
    'NOT (inversor)',
    'AND (E)',
    'OR (OU)',
    'XOR (OU exclusivo)',
    'Tabela-verdade',
    'Expressão booleana',
    'Meio-somador',
    'Somador completo',
  ]

  test('cobre todos os termos exigidos pelo SDD §9.D', () => {
    const terms = new Set(GLOSSARY.map(entry => entry.term))
    for (const term of REQUIRED_TERMS) {
      expect(terms.has(term), `verbete ausente: ${term}`).toBe(true)
    }
  })

  test('todo verbete tem explicação não vazia e termo não vazio', () => {
    expect(GLOSSARY.length).toBeGreaterThanOrEqual(24)
    for (const entry of GLOSSARY) {
      expect(entry.term.length).toBeGreaterThan(0)
      expect(entry.explanation.length).toBeGreaterThan(0)
    }
  })

  test('busca por termo funciona', () => {
    expect(glossaryEntry('Net')?.explanation).toContain('net')
    expect(glossaryEntry('termo-inexistente')).toBeUndefined()
  })
})

describe('estrelas e resultados (MI-19)', () => {
  test('três estrelas nomeadas, com descrição', () => {
    expect(STARS).toHaveLength(3)
    expect(STARS.map(s => s.tier)).toEqual([1, 2, 3])
    expect(starInfo(1).name).toBe('Circuito completo')
    expect(starInfo(2).name).toBe('Rota limpa')
    expect(starInfo(3).name).toBe('Lógica mínima')
    for (const star of STARS) {
      expect(star.name.length).toBeGreaterThan(0)
      expect(star.description.length).toBeGreaterThan(0)
    }
  })

  test('explicação de estrela perdida interpola os números', () => {
    const text = starLostExplanation(4, 3)
    expect(text).toContain('4 portas')
    expect(text).toContain('fazer com 3')
    expect(text).not.toMatch(/\{|\}/)
  })

  test('rótulos auxiliares existem', () => {
    expect(WIN_TITLE.length).toBeGreaterThan(0)
    expect(HINT_SEAL_LABEL).toContain('dica')
    expect(TRY_AGAIN_LABEL).toBe('Tentar de novo')
    expect(NEXT_LEVEL_LABEL).toBe('Próxima fase')
  })
})
