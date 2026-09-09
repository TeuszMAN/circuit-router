import { afterEach, expect, it } from 'vitest'
import { paintCells } from './painters'
import { computeBoardLayout } from './geometry'
import { withTheme } from './theme'
import { installCanvas2DMock, makeLevel } from './renderer-test-helpers'

let restore: (() => void) | undefined
afterEach(() => restore?.())

it('distingue uma parede fixa de uma célula livre no desenho', () => {
  const mock = installCanvas2DMock()
  restore = mock.restore
  const level = makeLevel()
  const layout = computeBoardLayout(300, 100, 3, 1, 0)
  paintCells(mock.ctx, layout, withTheme(), {
    ...level, fixedCells: [{ coord: { x: 1, y: 0 }, cell: { kind: 'empty' } }],
  }, [], new Map())
  expect(mock.ctx.calls.fillText).toContainEqual(['×', 150, 50])
  expect(mock.ctx.calls.fill?.length).toBeGreaterThan(0)
})
