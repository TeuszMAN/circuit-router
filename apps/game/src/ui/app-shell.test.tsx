/**
 * Teste de integração do shell (MI-10): roteamento por signals entre menu,
 * seleção de fases, tela de jogo e configurações, com voltar funcionando.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/preact'
import { AppShell } from './app-shell'
import { createAppState } from './state'
import { BOOTSTRAP_CAMPAIGN } from './campaign'
import { installCanvas2DMock } from '../board/renderer-test-helpers'

const FIRST = BOOTSTRAP_CAMPAIGN[0] as NonNullable<(typeof BOOTSTRAP_CAMPAIGN)[0]>

let restoreCanvas: () => void

beforeEach(() => {
  restoreCanvas = installCanvas2DMock().restore
})

afterEach(() => {
  if (restoreCanvas) restoreCanvas()
  cleanup()
})

describe('AppShell · navegação', () => {
  it('menu → fases → jogo → menu principal (via pausa)', async () => {
    const state = createAppState()
    render(<AppShell state={state} />)

    // Menu inicial com o título do produto.
    expect(screen.getByRole('heading', { name: 'Circuit Router' })).toBeTruthy()

    // Abre a seleção de fases e entra na primeira fase.
    fireEvent.click(screen.getByRole('button', { name: 'Jogar' }))
    expect(await screen.findByRole('heading', { name: 'Fases' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: new RegExp(FIRST.name) }))
    expect(await screen.findByTestId('board-slot')).toBeTruthy()
    expect(screen.getByText(FIRST.name)).toBeTruthy()

    // Pausa → menu principal (histórico limpo).
    fireEvent.click(screen.getByRole('button', { name: 'Pausar' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Menu principal' }))
    expect(await screen.findByRole('heading', { name: 'Circuit Router' })).toBeTruthy()
  })

  it('menu → configurações → voltar ao menu', async () => {
    const state = createAppState()
    render(<AppShell state={state} />)

    fireEvent.click(screen.getByRole('button', { name: 'Configurações' }))
    expect(await screen.findByRole('heading', { name: 'Configurações' })).toBeTruthy()

    const voltar = screen.getAllByRole('button', { name: 'Voltar' })
    fireEvent.click(voltar[0]!)
    expect(await screen.findByRole('heading', { name: 'Circuit Router' })).toBeTruthy()
  })

  it('pausa → voltar às fases retorna à lista (sem entrar no menu)', async () => {
    const state = createAppState()
    // Já entra direto na primeira fase (rota programática).
    state.reset({ name: 'game', levelId: FIRST.id })
    render(<AppShell state={state} />)
    expect(await screen.findByTestId('board-slot')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Pausar' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Voltar às fases' }))
    expect(await screen.findByRole('heading', { name: 'Fases' })).toBeTruthy()
    expect(screen.queryByTestId('board-slot')).toBeNull()
  })

  it('simular dentro do shell abre o modal de diagnóstico (fluxo real)', async () => {
    const state = createAppState()
    state.reset({ name: 'game', levelId: FIRST.id })
    render(<AppShell state={state} />)
    expect(await screen.findByTestId('board-slot')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Simular circuito' }))
    expect(await screen.findByText('O circuito ainda não fechou')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Continuar tentando' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
