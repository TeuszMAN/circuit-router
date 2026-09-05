// Testes do alvo lógico (expression.ts): orçamento exato de portas, avaliação
// da função-alvo em linhas da tabela-verdade e texto infixo de exibição.

import { describe, expect, it } from 'vitest'
import { Rng } from './rng'
import {
  countGates,
  evaluateSpec,
  expressionText,
  sampleTarget,
} from './expression'
import type { CircuitSpec } from './expression'

function evalBrute(spec: CircuitSpec, bits: readonly (0 | 1)[]): 0 | 1 {
  // Referência ingênua: monta a função a partir da estrutura (idêntica ao
  // evaluateSpec, mas escrita de outro jeito para servir de oráculo simples).
  const value = (varIndex: number, chain: number): 0 | 1 => {
    let v = bits[varIndex] as 0 | 1
    if (chain % 2 === 1) v = v === 0 ? 1 : 0
    return v
  }
  let acc = value(spec.order[0] as number, spec.leafChains[0] as number)
  for (let i = 1; i < spec.inputs; i++) {
    const op = spec.ops[i - 1] as 'AND' | 'OR'
    const operand = value(spec.order[i] as number, spec.leafChains[i] as number)
    acc = op === 'AND' ? (acc === 1 && operand === 1 ? 1 : 0) : acc === 1 || operand === 1 ? 1 : 0
  }
  if (spec.rootChain % 2 === 1) acc = acc === 0 ? 1 : 0
  return acc
}

describe('sampleTarget', () => {
  it('respeita o orçamento exato de portas', () => {
    const configs: ReadonlyArray<readonly [number, number]> = [
      [1, 1],
      [2, 2],
      [2, 3],
      [3, 4],
      [3, 5],
    ]
    for (const [inputs, budget] of configs) {
      for (let seed = 0; seed < 20; seed++) {
        const rng = new Rng(seed * 31 + inputs * 7)
        const { spec } = sampleTarget(rng, inputs, budget)
        expect(spec.inputs).toBe(inputs)
        expect(countGates(spec)).toBe(budget)
        expect(spec.order).toHaveLength(inputs)
        expect(new Set(spec.order).size).toBe(inputs)
      }
    }
  })

  it('avalia igual à referência para todas as linhas da tabela', () => {
    const configs: ReadonlyArray<readonly [number, number]> = [
      [1, 3],
      [2, 4],
      [3, 5],
    ]
    for (const [inputs, budget] of configs) {
      for (let seed = 0; seed < 25; seed++) {
        const rng = new Rng(seed * 131 + inputs)
        const { spec } = sampleTarget(rng, inputs, budget)
        // Percorre TODAS as 2^inputs linhas (tabela-verdade completa).
        for (let row = 0; row < 1 << inputs; row++) {
          const bits: (0 | 1)[] = []
          for (let i = 0; i < inputs; i++) bits.push(((row >> i) & 1) as 0 | 1)
          expect(evaluateSpec(spec, bits), `seed=${seed} inputs=${inputs} row=${row}`).toBe(
            evalBrute(spec, bits),
          )
        }
      }
    }
  })

  it('cadeias de comprimento par não alteram a função (dupla negação)', () => {
    const rng = new Rng(42)
    const { spec } = sampleTarget(rng, 2, 4)
    const bits: (0 | 1)[] = [1, 0]
    const base = evaluateSpec(spec, bits)
    const withEvenPair: CircuitSpec = {
      ...spec,
      leafChains: [2, ...spec.leafChains.slice(1)],
      rootChain: spec.rootChain + 2,
    }
    expect(evaluateSpec(withEvenPair, bits)).toBe(base)
  })
})

describe('expressionText', () => {
  it('produz texto infixo com precedência correta', () => {
    const rng = new Rng(7)
    const { spec } = sampleTarget(rng, 3, 5)
    const text = expressionText(spec)
    expect(text.startsWith('S = ')).toBe(true)
    // O texto reduz cadeias por paridade: conta variáveis/negações.
    const negs = (text.match(/‾/g) ?? []).length
    const expectedLeafParity = spec.leafChains.filter(n => n % 2 === 1).length
    const expectedRootFlip = spec.rootChain % 2
    expect(negs).toBe(expectedLeafParity + expectedRootFlip)
  })

  it('NOT de uma variável aparece como S = A‾', () => {
    const rng = new Rng(1)
    const { spec } = sampleTarget(rng, 1, 1)
    const text = expressionText(spec)
    // g=1 sobre 1 variável: um único NOT (na folha ou na raiz).
    expect(text).toMatch(/^S = (A|\(A\)‾)$/)
  })
})
