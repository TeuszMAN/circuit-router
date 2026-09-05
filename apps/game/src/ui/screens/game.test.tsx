/**
 * Testes da tela de jogo / HUD (MI-10): elementos do HUD presentes, seleção de
 * ferramenta, simulação abrindo o modal de diagnóstico e dica em dois níveis
 * (a extra só desbloqueia após uma simulação que falhou — SDD §9.C.2).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/preact'
import { GameScreen } from './game'
import { createAppState } from '../state'
import { BOOTSTRAP_CAMPAIGN } from '../campaign'

const LEVEL = BOOTSTRAP_CAMPAIGN[0] as NonNullable<(typeof BOOTSTRAP_CAMPAIGN)[0]>
const NEXT_ID = BOOTSTRAP_CAMPAIGN[1]?.id ?? null

afterEach(() => {
  cleanup()
})

function renderGame(overrides: { readonly nextLevelId?: string | null } = {}) {
  const state = createAppState()
  const onOpenNext = vi.fn()
  const onExit = vi.fn()
  const onHome = vi.fn()
  render(
    <GameScreen
      level={LEVEL}
      state={state}
      nextLevelId={overrides.nextLevelId ?? NEXT_ID}
      onOpenNext={onOpenNext}
      onExit={onExit}
      onHome={onHome}
    />,
  )
  return { state, onOpenNext, onExit, onHome }
}

describe('GameScreen · HUD', () => {
  it('mostra o host do tabuleiro e todos os controles do HUD', () => {
    renderGame()

    expect(screen.getByTestId('board-slot')).toBeTruthy()
    expect(screen.getByText(LEVEL.name)).toBeTruthy()

    for (const label of ['Pausar', 'Painel de conceito']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy()
    }
    for (const label of [
      'Desfazer',
      'Refazer',
      'Limpar tabuleiro',
      'Dica',
      'Simular circuito',
    ]) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy()
    }
    for (const tool of ['Fio', 'AND', 'OR', 'NOT', 'Borracha']) {
      expect(screen.getByRole('button', { name: `Ferramenta ${tool}` })).toBeTruthy()
    }
  })

  it('undo/redo/limpar ficam desabilitados sem a composição do editor', () => {
    renderGame()
    for (const label of ['Desfazer', 'Refazer', 'Limpar tabuleiro']) {
      const button = screen.getByRole('button', { name: label }) as HTMLButtonElement
      expect(button.disabled).toBe(true)
    }
  })

  it('seleciona a ferramenta ativa na paleta', () => {
    renderGame()
    const and = screen.getByRole('button', { name: 'Ferramenta AND' }) as HTMLButtonElement
    const wire = screen.getByRole('button', { name: 'Ferramenta Fio' }) as HTMLButtonElement
    expect(wire.getAttribute('aria-pressed')).toBe('true')
    expect(and.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(and)
    expect(and.getAttribute('aria-pressed')).toBe('true')
    expect(wire.getAttribute('aria-pressed')).toBe('false')
  })

  it('abre a pausa e retoma', () => {
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: 'Pausar' }))
    expect(screen.getByRole('dialog', { name: 'Pausa' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Retomar' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('GameScreen · simulação e dica', () => {
  it('simular um tabuleiro vazio abre o modal de diagnóstico', async () => {
    const { onExit } = renderGame()
    fireEvent.click(screen.getByRole('button', { name: 'Simular circuito' }))

    expect(await screen.findByText('O circuito ainda não fechou')).toBeTruthy()
    expect(screen.getByText('Fio sem ninguém falando')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Continuar tentando' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onExit).not.toHaveBeenCalled()
  })

  it('dica nível 1 abre e fecha; nível 2 só após uma simulação que falhou', async () => {
    renderGame()

    // Primeira dica: nível 1 (empurrão conceitual).
    fireEvent.click(screen.getByRole('button', { name: 'Dica' }))
    expect(screen.getByText(LEVEL.hints[0]!)).toBeTruthy()
    expect(screen.getByText('Dica')).toBeTruthy()

    // Fechar volta a esconder.
    fireEvent.click(screen.getByRole('button', { name: 'Fechar dica' }))
    expect(screen.queryByTestId('hint-banner')).toBeNull()

    // Sem falha, a dica não avança para o nível 2.
    fireEvent.click(screen.getByRole('button', { name: 'Dica' }))
    expect(screen.getByText(LEVEL.hints[0]!)).toBeTruthy()
    expect(screen.queryByText(LEVEL.hints[1]!)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Fechar dica' }))

    // Falha na simulação desbloqueia a dica extra (solução parcial).
    fireEvent.click(screen.getByRole('button', { name: 'Simular circuito' }))
    expect(await screen.findByText('O circuito ainda não fechou')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Continuar tentando' }))

    fireEvent.click(screen.getByRole('button', { name: 'Dica' }))
    expect(screen.getByText(LEVEL.hints[0]!)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Dica' }))
    expect(screen.getByText('Dica extra')).toBeTruthy()
    expect(screen.getByText(LEVEL.hints[1]!)).toBeTruthy()
  })
})
