/**
 * Testes do modal de resultado (MI-10): vitória com 3/2/1 estrelas (estrelas
 * nomeadas + explicação da perdida) e erro com diagnóstico legível em PT-BR.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/preact'
import { ResultModal, type ResultOutcome, type VictoryDetails } from './result-modal'

const NOP = () => undefined

function victory(overrides: Partial<VictoryDetails>): ResultOutcome {
  return {
    kind: 'win',
    stars: 3,
    usedPieces: 2,
    usedGates: 0,
    pieceLimit: 2,
    gateLimit: 0,
    ...overrides,
  }
}

afterEach(() => {
  cleanup()
})

describe('ResultModal · vitória', () => {
  it('com 3 estrelas nomeia as três conquistas e não oferece tentar de novo', () => {
    render(
      <ResultModal
        outcome={victory({ stars: 3 })}
        levelName="Primeira rota"
        hasNext
        onNext={NOP}
        onRetry={NOP}
        onExit={NOP}
      />,
    )

    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText('Fase concluída!')).toBeTruthy()
    for (const name of ['Circuito completo', 'Rota limpa', 'Lógica mínima']) {
      expect(screen.getByText(name)).toBeTruthy()
    }
    expect(screen.queryByText('Tentar de novo')).toBeNull()
    expect(screen.getByRole('button', { name: 'Próxima fase' })).toBeTruthy()
  })

  it('com 2 estrelas explica a terceira perdida e oferece tentar de novo', () => {
    const onNext = vi.fn()
    render(
      <ResultModal
        outcome={victory({ stars: 2, usedGates: 4, gateLimit: 2 })}
        levelName="Negações"
        hasNext
        onNext={onNext}
        onRetry={NOP}
        onExit={NOP}
      />,
    )

    expect(screen.getByText('Rota limpa')).toBeTruthy()
    expect(screen.getByText(/Você usou 4 portas; dá para fazer com 2/)).toBeTruthy()
    const retry = screen.getByRole('button', { name: 'Tentar de novo' })
    const next = screen.getByRole('button', { name: 'Próxima fase' })
    expect(retry).toBeTruthy()
    expect(next).toBeTruthy()

    fireEvent.click(next)
    expect(onNext).toHaveBeenCalledOnce()
  })

  it('com 1 estrela explica as estrelas de peças e de portas perdidas', () => {
    render(
      <ResultModal
        outcome={victory({ stars: 1, usedPieces: 5, pieceLimit: 3, usedGates: 3, gateLimit: 0 })}
        levelName="Só os dois"
        hasNext
        onNext={NOP}
        onRetry={NOP}
        onExit={NOP}
      />,
    )

    expect(screen.getByText('Circuito completo')).toBeTruthy()
    expect(screen.getByText(/Você usou 5 peças; dá para fazer com 3/)).toBeTruthy()
    expect(screen.getByText(/Você usou 3 portas; dá para fazer com 0/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy()
  })

  it('sem próxima fase, o botão primário volta às fases', () => {
    const onExit = vi.fn()
    render(
      <ResultModal
        outcome={victory({ stars: 3 })}
        levelName="Última fase"
        hasNext={false}
        onNext={NOP}
        onRetry={NOP}
        onExit={onExit}
      />,
    )

    const button = screen.getByRole('button', { name: 'Voltar às fases' })
    fireEvent.click(button)
    expect(onExit).toHaveBeenCalledOnce()
  })
})

describe('ResultModal · erro', () => {
  it('traduz um issue da simulação em diagnóstico legível (PT-BR)', () => {
    render(
      <ResultModal
        outcome={{
          kind: 'error',
          issues: [{ kind: 'short', cells: [{ x: 1, y: 2 }] }],
          sinks: [],
        }}
        levelName="Caminhos"
        hasNext
        onNext={NOP}
        onRetry={NOP}
        onExit={NOP}
      />,
    )

    expect(screen.getByText('O circuito ainda não fechou')).toBeTruthy()
    expect(screen.getByText('Dois donos no mesmo fio')).toBeTruthy()
    expect(screen.getByText(/Dois sinais diferentes estão brigando no mesmo fio/)).toBeTruthy()
    expect(screen.getByText(/Separe os caminhos ou faça os dois passarem por uma porta/)).toBeTruthy()
  })

  it('sem issues, diagnostica o destino insatisfeito (esperado × obtido)', () => {
    render(
      <ResultModal
        outcome={{
          kind: 'error',
          issues: [],
          sinks: [
            { coord: { x: 3, y: 0 }, expected: 1, actual: 0, satisfied: false },
          ],
        }}
        levelName="Só os dois"
        hasNext
        onNext={NOP}
        onRetry={NOP}
        onExit={NOP}
      />,
    )

    expect(screen.getByText('Quase lá')).toBeTruthy()
    expect(screen.getByText(/esperava 1 e recebeu 0/)).toBeTruthy()
  })

  it('o botão "continuar tentando" fecha o modal', () => {
    const onRetry = vi.fn()
    render(
      <ResultModal
        outcome={{
          kind: 'error',
          issues: [{ kind: 'floating', cells: [{ x: 0, y: 0 }] }],
          sinks: [],
        }}
        levelName="Primeira rota"
        hasNext
        onNext={NOP}
        onRetry={onRetry}
        onExit={NOP}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Continuar tentando' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})
