import { afterEach, expect, it, vi } from 'vitest'
import { createAppState, createBrowserStorage } from './state'

afterEach(() => vi.restoreAllMocks())

it('inicia o jogo mesmo quando o getter localStorage lança SecurityError', () => {
  vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('SecurityError') })
  const state = createAppState(createBrowserStorage())
  expect(state.route.value).toEqual({ name: 'menu' })
  state.recordResult('p1-1', { stars: 3 })
  expect(state.progressFor('p1-1')?.stars).toBe(3)
  expect(state.storageFailed.value).toBe(true)
})
