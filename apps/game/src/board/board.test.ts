import { describe, expect, it } from 'vitest'

/**
 * Regra de fronteira da MI-08 (aceite): o diretório `board/` não conhece
 * Preact — importa apenas core, contratos e tipos de DOM. Este teste lê os
 * fontes do próprio diretório (via glob raw do Vite, sem fs) e falha se
 * qualquer arquivo referenciar `preact` ou `@preact`.
 */

const sources = import.meta.glob<string>('./*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
})

const PREACT_REFERENCE = /\bfrom\s+['"]@?preact(?:['"/]|$)|require\(\s*['"]@?preact/

describe('fronteira board/ (MI-08)', () => {
  it('contém os fontes do renderizador (guarda do glob)', () => {
    const names = Object.keys(sources)
    expect(names).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/canvas-board-renderer\.ts$/),
        expect.stringMatching(/painters\.ts$/),
        expect.stringMatching(/geometry\.ts$/),
      ]),
    )
  })

  it('nenhum arquivo do diretório importa preact', () => {
    const offenders = Object.entries(sources)
      .filter(([, content]) => PREACT_REFERENCE.test(content))
      .map(([file]) => file)
    expect(offenders).toEqual([])
  })
})
