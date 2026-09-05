/**
 * Testes do modal de resultado (MI-10, estendidos na MI-21): vitória com 3/2/1
 * estrelas (estrelas nomeadas + explicação da perdida + selo de dica) e erro
 * com diagnóstico legível em PT-BR sempre acompanhado de highlight de célula.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/preact'
import { ResultModal, type ResultOutcome, type VictoryDetails } from './result-modal'

const NOP = () => undefined

function victory(overrides: Partial<VictoryDetails>): ResultOutcome {
  return {
    kind: 'win',
    stars: 3,
    usedGates: 0,
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

  it('com 2 estrelas explica a terceira perdida (portas usadas x limite) sem revelar a solução e oferece tentar de novo', () => {
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

  it('com 1 estrela explica a estrela de portas perdida sem revelar a solução', () => {
    render(
      <ResultModal
        outcome={victory({ stars: 1, usedGates: 3, gateLimit: 0 })}
        levelName="Só os dois"
        hasNext
        onNext={NOP}
        onRetry={NOP}
        onExit={NOP}
      />,
    )

    expect(screen.getByText('Circuito completo')).toBeTruthy()
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

  it('exibe o selo "resolvida com dica" quando a fase foi vencida com a dica de nível 2', () => {
    render(
      <ResultModal
        outcome={victory({ stars: 2, usedHint: true })}
        levelName="Com ajuda"
        hasNext
        onNext={NOP}
        onRetry={NOP}
        onExit={NOP}
      />,
    )

    expect(screen.getByTestId('hint-seal')).toBeTruthy()
    expect(screen.getByText('Resolvida com dica')).toBeTruthy()
  })

  it('sem uso de dica, não exibe o selo', () => {
    render(
      <ResultModal
        outcome={victory({ stars: 3, usedHint: false })}
        levelName="Sem ajuda"
        hasNext
        onNext={NOP}
        onRetry={NOP}
        onExit={NOP}
      />,
    )

    expect(screen.queryByTestId('hint-seal')).toBeNull()
  })
})

describe('ResultModal · erro', () => {
  it('traduz um issue da simulação em diagnóstico legível (PT-BR) com highlight da célula', () => {
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
    expect(screen.getByText('Coluna 2, linha 3')).toBeTruthy()
  })

  it('destaca todas as células de um diagnóstico com múltiplas células', () => {
    render(
      <ResultModal
        outcome={{
          kind: 'error',
          issues: [
            {
              kind: 'unpowered-gate',
              cells: [
                { x: 0, y: 0 },
                { x: 2, y: 1 },
              ],
            },
          ],
          sinks: [],
        }}
        levelName="Porta faminta"
        hasNext
        onNext={NOP}
        onRetry={NOP}
        onExit={NOP}
      />,
    )

    expect(screen.getAllByTestId('diagnostic-cell')).toHaveLength(2)
    expect(screen.getByText('Coluna 1, linha 1')).toBeTruthy()
    expect(screen.getByText('Coluna 3, linha 2')).toBeTruthy()
  })

  it('nunca renderiza um diagnóstico cujo issue não tem células para destacar', () => {
    render(
      <ResultModal
        outcome={{
          kind: 'error',
          issues: [
            { kind: 'short', cells: [] },
            { kind: 'floating', cells: [{ x: 4, y: 4 }] },
          ],
          sinks: [],
        }}
        levelName="Sem destaque"
        hasNext
        onNext={NOP}
        onRetry={NOP}
        onExit={NOP}
      />,
    )

    // O issue sem cells[] não aparece — nenhum diagnóstico sem highlight.
    expect(screen.queryByText('Dois donos no mesmo fio')).toBeNull()
    // O issue com cells[] aparece normalmente, com seu highlight.
    expect(screen.getByText('Fio sem ninguém falando')).toBeTruthy()
    expect(screen.getAllByTestId('diagnostic-cell')).toHaveLength(1)
  })

  it('sem issues, diagnostica o destino insatisfeito (esperado × obtido) destacando a célula do sink', () => {
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
    expect(screen.getByText('Coluna 4, linha 1')).toBeTruthy()
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
