import { describe, expect, it } from 'vitest'
import { CORE_VERSION } from './index'

describe('core scaffold', () => {
  it('exposes a version placeholder', () => {
    expect(CORE_VERSION).toBe('0.0.1')
  })
})
