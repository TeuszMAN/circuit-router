/**
 * Testes da tela de configurações (MI-10): alternar mute, tema, haptics e
 * reduzir animação persiste no estado (e no storage por trás dele).
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/preact'
import { SettingsScreen } from './settings'
import { createAppState } from '../state'

afterEach(() => {
  cleanup()
})

describe('SettingsScreen', () => {
  it('renderiza as quatro preferências com os valores padrão', () => {
    const state = createAppState()
    render(<SettingsScreen state={state} onBack={() => undefined} />)

    expect(screen.getByRole('heading', { name: 'Configurações' })).toBeTruthy()
    expect(screen.getByRole('switch', { name: 'Som' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('switch', { name: 'Vibração' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('radiogroup', { name: 'Tema' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Automático' }).getAttribute('aria-checked')).toBe('true')
    expect(
      screen.getByRole('switch', { name: 'Reduzir animação' }).getAttribute('aria-checked'),
    ).toBe('false')
  })

  it('persiste as mudanças no estado (mute, haptics, tema, animação)', () => {
    const state = createAppState()
    render(<SettingsScreen state={state} onBack={() => undefined} />)

    fireEvent.click(screen.getByRole('switch', { name: 'Som' }))
    fireEvent.click(screen.getByRole('switch', { name: 'Vibração' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Escuro' }))
    fireEvent.click(screen.getByRole('switch', { name: 'Reduzir animação' }))

    expect(state.muted.value).toBe(true)
    expect(state.haptics.value).toBe(false)
    expect(state.theme.value).toBe('dark')
    expect(state.reducedMotion.value).toBe(true)
  })
})
