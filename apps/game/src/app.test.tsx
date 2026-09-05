import { describe, expect, it } from 'vitest'
import { render } from 'preact'
import { App } from './app'

describe('App', () => {
  it('renders the app shell', () => {
    const root = document.createElement('div')
    render(<App />, root)
    expect(root.textContent).toContain('Circuit Router')
  })
})
