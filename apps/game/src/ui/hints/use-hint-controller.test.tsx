/**
 * Testes do controlador de dica (SDD §9.C.2): nível 1 sempre disponível;
 * nível 2 ("solução parcial") permanece bloqueado até 1 simulação falha OU
 * 60s decorridos na fase — qualquer uma das duas já desbloqueia.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/preact'
import { act } from 'preact/test-utils'
import { useHintController } from './use-hint-controller'

const HINTS = ['Empurrão conceitual', 'Solução parcial'] as const

function Harness() {
  const hint = useHintController(HINTS)
  return (
    <div>
      <button type="button" onClick={hint.press}>
        Dica
      </button>
      <button type="button" onClick={hint.notifyFailure}>
        Falhar simulação
      </button>
      <span data-testid="hint-text">{hint.text ?? ''}</span>
      <span data-testid="hint-used">{String(hint.used)}</span>
    </div>
  )
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('useHintController', () => {
  it('nível 1 abre a dica; sem falha e antes de 60s, o segundo toque fecha (nível 2 bloqueado)', () => {
    render(<Harness />)
    const button = screen.getByRole('button', { name: 'Dica' })

    fireEvent.click(button)
    expect(screen.getByTestId('hint-text').textContent).toBe(HINTS[0])

    fireEvent.click(button)
    expect(screen.getByTestId('hint-text').textContent).toBe('')
  })

  it('marca "used" assim que a dica de nível 1 é aberta', () => {
    render(<Harness />)
    expect(screen.getByTestId('hint-used').textContent).toBe('false')

    fireEvent.click(screen.getByRole('button', { name: 'Dica' }))
    expect(screen.getByTestId('hint-used').textContent).toBe('true')
  })

  it('desbloqueia o nível 2 depois de uma simulação que falhou', () => {
    render(<Harness />)
    const button = screen.getByRole('button', { name: 'Dica' })

    fireEvent.click(screen.getByRole('button', { name: 'Falhar simulação' }))
    fireEvent.click(button)
    expect(screen.getByTestId('hint-text').textContent).toBe(HINTS[0])

    fireEvent.click(button)
    expect(screen.getByTestId('hint-text').textContent).toBe(HINTS[1])
  })

  it('desbloqueia o nível 2 após 60s na fase mesmo sem nenhuma falha', () => {
    vi.useFakeTimers()
    render(<Harness />)
    const button = screen.getByRole('button', { name: 'Dica' })

    act(() => {
      vi.advanceTimersByTime(60_000)
    })

    fireEvent.click(button)
    fireEvent.click(button)
    expect(screen.getByTestId('hint-text').textContent).toBe(HINTS[1])
  })

  it('permanece bloqueado antes de 60s sem falha', () => {
    vi.useFakeTimers()
    render(<Harness />)
    const button = screen.getByRole('button', { name: 'Dica' })

    act(() => {
      vi.advanceTimersByTime(59_000)
    })

    fireEvent.click(button)
    fireEvent.click(button)
    expect(screen.getByTestId('hint-text').textContent).toBe('')
  })
})
