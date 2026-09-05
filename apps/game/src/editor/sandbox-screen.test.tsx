/**
 * Testes de fumaça da tela do sandbox (MI-13): colocar peças, simular e ver
 * diagnóstico, exportar e importar sem quebrar a tela.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/preact'
import { SandboxScreen } from './sandbox-screen'
import { createSandboxEditor } from './state'

afterEach(() => {
  cleanup()
})

describe('SandboxScreen', () => {
  it('renderiza o grid padrão e permite colocar uma fonte', () => {
    const editor = createSandboxEditor()
    render(<SandboxScreen editor={editor} />)

    fireEvent.click(screen.getByRole('button', { name: 'Fonte 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'célula 0,0, vazia' }))

    expect(editor.cellAt({ x: 0, y: 0 })).toEqual({ kind: 'source', value: 1, outputSide: 'E' })
  })

  it('simula o circuito e mostra o diagnóstico', () => {
    const editor = createSandboxEditor()
    editor.resizeGrid({ width: 2, height: 1 })
    editor.placeCell({ x: 1, y: 0 }, { kind: 'sink', expected: 1, inputSide: 'W' })
    render(<SandboxScreen editor={editor} />)

    fireEvent.click(screen.getByRole('button', { name: 'Simular circuito' }))

    const diagnostic = screen.getByTestId('sandbox-diagnostic')
    expect(diagnostic.textContent).toContain('Fio sem ninguém falando')
  })

  it('exporta JSON válido e importa de volta sem quebrar a tela', () => {
    const editor = createSandboxEditor()
    editor.resizeGrid({ width: 3, height: 1 })
    editor.placeCell({ x: 0, y: 0 }, { kind: 'source', value: 1, outputSide: 'E' })
    editor.placeCell({ x: 1, y: 0 }, { kind: 'wire', sides: ['W', 'E'] })
    editor.placeCell({ x: 2, y: 0 }, { kind: 'sink', expected: 1, inputSide: 'W' })
    render(<SandboxScreen editor={editor} />)

    fireEvent.click(screen.getByRole('button', { name: 'Exportar JSON' }))
    const exported = screen.getByTestId('sandbox-export-json') as HTMLTextAreaElement
    expect(exported.value).toContain('"kind": "source"')

    const importInput = screen.getByTestId('sandbox-import-input') as HTMLTextAreaElement
    fireEvent.input(importInput, { target: { value: '{ inválido' } })
    fireEvent.click(screen.getByRole('button', { name: 'Importar JSON' }))

    expect(screen.getByTestId('sandbox-import-error').textContent).toContain('JSON inválido')
  })
})
