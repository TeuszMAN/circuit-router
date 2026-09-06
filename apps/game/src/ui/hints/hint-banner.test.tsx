import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/preact'
import { HintBanner } from './hint-banner'

afterEach(() => {
  cleanup()
})

describe('HintBanner', () => {
  it('mostra o rótulo e o texto da dica, e fecha ao clicar', () => {
    const onClose = vi.fn()
    render(<HintBanner label="Dica extra" text="Ligue a fonte à porta." onClose={onClose} />)

    expect(screen.getByTestId('hint-banner')).toBeTruthy()
    expect(screen.getByText('Dica extra')).toBeTruthy()
    expect(screen.getByText('Ligue a fonte à porta.')).toBeTruthy()

    const closeButton = screen.getByRole('button', { name: 'Fechar dica' })
    expect(closeButton.className).toContain('hint-banner__close')
    fireEvent.click(closeButton)
    expect(onClose).toHaveBeenCalledOnce()
  })
})
