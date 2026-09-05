/**
 * Testes do seletor de fases (MI-10): lista montada a partir de um array
 * fake, com estrelas por fase e selo "resolvida com dica" quando houver.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/preact'
import { LevelSelect } from './level-select'
import { createAppState, type AppState } from '../state'
import type { LevelSummary } from '../campaign'

const FAKE_LEVELS: readonly LevelSummary[] = [
  { id: 'fase-01', name: 'Primeira rota' },
  { id: 'fase-02', name: 'Negações' },
  { id: 'fase-03', name: 'Só os dois' },
]

afterEach(() => {
  cleanup()
})

describe('LevelSelect', () => {
  it('lista as fases recebidas por array fake', () => {
    const state = createAppState()
    render(
      <LevelSelect
        state={state}
        levels={FAKE_LEVELS}
        onPick={() => undefined}
        onBack={() => undefined}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Fases' })).toBeTruthy()
    for (const level of FAKE_LEVELS) {
      expect(screen.getByRole('button', { name: new RegExp(level.name) })).toBeTruthy()
    }
    expect(screen.getAllByRole('button')).toHaveLength(FAKE_LEVELS.length + 1) // cards + voltar
  })

  it('chama onPick com o id ao tocar numa fase', () => {
    const state = createAppState()
    const onPick = vi.fn()
    render(
      <LevelSelect state={state} levels={FAKE_LEVELS} onPick={onPick} onBack={() => undefined} />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Negações/ }))
    expect(onPick).toHaveBeenCalledOnce()
    expect(onPick).toHaveBeenCalledWith('fase-02')
  })

  it('mostra as estrelas do progresso de cada fase', () => {
    const state = createAppState()
    // Fase 1 vencida com ★2; fase 2 nunca jogada.
    state.recordResult('fase-01', { stars: 2, pieces: 3, gates: 1, withHint: false })

    render(
      <LevelSelect
        state={state}
        levels={FAKE_LEVELS}
        onPick={() => undefined}
        onBack={() => undefined}
      />,
    )

    const first = screen.getByRole('button', { name: /Primeira rota/ })
    expect(
      within(first).getByRole('img', { name: 'Estrelas de Primeira rota: 2 de 3 estrelas' }),
    ).toBeTruthy()

    const second = screen.getByRole('button', { name: /Negações/ })
    expect(
      within(second).getByRole('img', { name: 'Estrelas de Negações: 0 de 3 estrelas' }),
    ).toBeTruthy()
  })

  it('exibe o selo de "resolvida com dica" somente na fase marcada', () => {
    const state = createAppState()
    state.recordResult('fase-01', { stars: 1, pieces: 5, gates: 2, withHint: true })
    state.recordResult('fase-02', { stars: 3, pieces: 2, gates: 0, withHint: false })

    render(
      <LevelSelect
        state={state}
        levels={FAKE_LEVELS}
        onPick={() => undefined}
        onBack={() => undefined}
      />,
    )

    const first = screen.getByRole('button', { name: /Primeira rota/ })
    expect(within(first).getByText('Resolvida com dica')).toBeTruthy()

    const second = screen.getByRole('button', { name: /Negações/ })
    expect(within(second).queryByText('Resolvida com dica')).toBeNull()
  })

  it('preserva o progresso (estrelas + selo) entre renders do estado', () => {
    const state: AppState = createAppState()
    const { rerender } = render(
      <LevelSelect state={state} levels={FAKE_LEVELS} onPick={() => undefined} onBack={() => undefined} />,
    )

    state.recordResult('fase-03', { stars: 3, pieces: 2, gates: 0, withHint: true })

    rerender(
      <LevelSelect state={state} levels={FAKE_LEVELS} onPick={() => undefined} onBack={() => undefined} />,
    )

    const third = screen.getByRole('button', { name: /Só os dois/ })
    expect(
      within(third).getByRole('img', { name: 'Estrelas de Só os dois: 3 de 3 estrelas' }),
    ).toBeTruthy()
    expect(within(third).getByText('Resolvida com dica')).toBeTruthy()
  })
})
