/**
 * Testes do painel de conceito (MI-20, SDD §9.C.3): abrir/fechar sobre a tela
 * de jogo sem perder o estado do tabuleiro, seleção de linha da tabela e
 * navegação ao glossário completo.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/preact'
import { glossaryEntry } from '@circuit/content/text'
import { AppShell } from '../app-shell'
import { createAppState } from '../state'
import { BOOTSTRAP_CAMPAIGN } from '../campaign'
import { ConceptPanel } from './concept-panel'
import { closeConcept, navigateToTerm, openConcept } from './panel-state'
import { recordGateObservation, resetObservedRows } from './observed'

const FIRST = BOOTSTRAP_CAMPAIGN[0] as NonNullable<(typeof BOOTSTRAP_CAMPAIGN)[0]>

afterEach(() => {
  cleanup()
  closeConcept()
  resetObservedRows()
})

describe('ConceptPanel · abrir sobre a tela de jogo', () => {
  it('abre e fecha sem perder o estado do tabuleiro (dica e ferramenta ativa)', async () => {
    const state = createAppState()
    state.reset({ name: 'game', levelId: FIRST.id })
    render(<AppShell state={state} />)
    expect(await screen.findByTestId('board-slot')).toBeTruthy()

    // Estado local da tela de jogo: ferramenta AND selecionada e dica aberta.
    fireEvent.click(screen.getByRole('button', { name: 'Ferramenta AND' }))
    fireEvent.click(screen.getByRole('button', { name: 'Dica' }))
    expect(await screen.findByTestId('hint-banner')).toBeTruthy()

    // Abre o painel de conceito sobre a tela — não deve pausar nem substituir a tela.
    fireEvent.click(screen.getByRole('button', { name: 'Painel de conceito' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'AND (E)' })).toBeTruthy()
    expect(screen.getByTestId('board-slot')).toBeTruthy()

    // Fecha o painel: tabuleiro, ferramenta ativa e dica continuam como estavam.
    fireEvent.click(screen.getByRole('button', { name: 'Fechar painel de conceito' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByTestId('board-slot')).toBeTruthy()
    expect(screen.getByTestId('hint-banner')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Ferramenta AND' }).getAttribute('aria-pressed')).toBe(
      'true',
    )
  })

  it('fecha com a tecla Escape', async () => {
    render(<ConceptPanel />)
    openConcept('AND')
    expect(await screen.findByRole('dialog')).toBeTruthy()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('ConceptPanel · tabela-verdade interativa', () => {
  it('tocar numa linha mostra aquele caso', async () => {
    render(<ConceptPanel />)
    openConcept('AND')
    await screen.findByRole('dialog')

    fireEvent.click(screen.getByRole('button', { name: /^Linha 4:/ }))
    expect(screen.getByTestId('concept-case').textContent).toBe('A = 1, B = 1 → Saída = 1')

    fireEvent.click(screen.getByRole('button', { name: /^Linha 1:/ }))
    expect(screen.getByTestId('concept-case').textContent).toBe('A = 0, B = 0 → Saída = 0')
  })

  it('linhas já observadas em jogo aparecem preenchidas; as demais em cinza', async () => {
    recordGateObservation('AND', [1, 1])
    render(<ConceptPanel />)
    openConcept('AND')
    await screen.findByRole('dialog')

    const observedRow = screen.getByRole('button', { name: /^Linha 4:/ })
    const unobservedRow = screen.getByRole('button', { name: /^Linha 1:/ })
    expect(observedRow.className).toContain('concept-table__row--observed')
    expect(unobservedRow.className).toContain('concept-table__row--unobserved')
  })

  it('porta de uma entrada (NOT) mostra só duas linhas', async () => {
    render(<ConceptPanel />)
    openConcept('NOT')
    await screen.findByRole('dialog')

    expect(screen.getByRole('button', { name: /^Linha 1:/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Linha 2:/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Linha 3:/ })).toBeNull()
  })
})

describe('ConceptPanel · glossário completo', () => {
  it('navega para outro verbete pelo índice', async () => {
    render(<ConceptPanel />)
    openConcept('AND')
    await screen.findByRole('dialog')
    expect(screen.getByRole('table')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Ciclo' }))
    expect(screen.getByRole('heading', { name: 'Ciclo' })).toBeTruthy()
    expect(screen.getByText(glossaryEntry('Ciclo')!.explanation)).toBeTruthy()
    // "Ciclo" não é porta: sem tabela-verdade.
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('sem ferramenta selecionada, abre no conceito padrão do painel', async () => {
    render(<ConceptPanel />)
    openConcept(undefined)
    expect(await screen.findByRole('heading', { name: 'Porta lógica' })).toBeTruthy()
  })

  it('rodapé some quando o próprio verbete em foco é o termo do rodapé', async () => {
    render(<ConceptPanel />)
    openConcept('AND')
    await screen.findByRole('dialog')
    expect(screen.getByText('Onde isso aparece de verdade')).toBeTruthy()

    navigateToTerm('Combinacional')
    expect(await screen.findByRole('heading', { name: 'Combinacional' })).toBeTruthy()
    expect(screen.queryByText('Onde isso aparece de verdade')).toBeNull()
  })
})
