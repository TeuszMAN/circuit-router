import { describe, expect, it } from 'vitest'
import { solveLevel } from '@circuit/core/gen'
import { createMemoryStorage, createSandboxEditor } from './state'

function buildWorkingCircuit(editor: ReturnType<typeof createSandboxEditor>): void {
  editor.resizeGrid({ width: 3, height: 1 })
  editor.placeCell({ x: 0, y: 0 }, { kind: 'source', value: 1, outputSide: 'E' })
  editor.placeCell({ x: 1, y: 0 }, { kind: 'wire', sides: ['W', 'E'] })
  editor.placeCell({ x: 2, y: 0 }, { kind: 'sink', expected: 1, inputSide: 'W' })
}

describe('createSandboxEditor — teste imediato', () => {
  it('simula o circuito desenhado e reporta o diagnóstico', () => {
    const editor = createSandboxEditor()
    buildWorkingCircuit(editor)
    const result = editor.runSimulation()
    expect(result.ok).toBe(true)
    expect(editor.lastResult.value).toBe(result)
  })

  it('reporta sink flutuante quando o circuito está incompleto', () => {
    const editor = createSandboxEditor()
    editor.resizeGrid({ width: 2, height: 1 })
    editor.placeCell({ x: 1, y: 0 }, { kind: 'sink', expected: 1, inputSide: 'W' })
    const result = editor.runSimulation()
    expect(result.ok).toBe(false)
    expect(result.issues.some(i => i.kind === 'floating')).toBe(true)
  })
})

describe('createSandboxEditor — export/import', () => {
  it('faz round-trip export → import preservando a fase', () => {
    const editor = createSandboxEditor()
    buildWorkingCircuit(editor)
    editor.setMeta({ id: 'minha-fase', name: 'Minha fase' })
    editor.setHints(['pense no sinal', 'ligue os três'])

    const before = editor.level.value
    const exported = editor.exportJson()
    expect(exported.ok).toBe(true)
    if (!exported.ok) return

    const other = createSandboxEditor()
    const outcome = other.importJson(exported.json)
    expect(outcome.ok).toBe(true)
    expect(other.level.value).toEqual(before)
  })

  it('a fase exportada de um circuito funcional é validada pelo solver', () => {
    const editor = createSandboxEditor()
    buildWorkingCircuit(editor)
    expect(editor.runSimulation().ok).toBe(true)

    const exported = editor.exportJson()
    expect(exported.ok).toBe(true)
    if (!exported.ok) return

    const parsed = JSON.parse(exported.json)
    const solved = solveLevel(parsed)
    expect(solved.solved).toBe(true)
  })

  it('importar JSON inválido mostra erro claro e não altera a fase atual', () => {
    const editor = createSandboxEditor()
    buildWorkingCircuit(editor)
    const before = editor.level.value

    expect(() => editor.importJson('{ isso não é json')).not.toThrow()
    const outcome = editor.importJson('{ isso não é json')

    expect(outcome.ok).toBe(false)
    expect(outcome.errors?.length).toBeGreaterThan(0)
    expect(editor.lastError.value).toContain('JSON inválido')
    expect(editor.level.value).toBe(before)
  })

  it('importar JSON fora do schema mostra erro claro sem quebrar', () => {
    const editor = createSandboxEditor()
    const before = editor.level.value

    const outcome = editor.importJson(JSON.stringify({ nada: 'a ver' }))

    expect(outcome.ok).toBe(false)
    expect(editor.lastError.value).not.toBeNull()
    expect(editor.level.value).toBe(before)
  })
})

describe('createSandboxEditor — rascunhos persistidos', () => {
  it('o rascunho sobrevive a recarregar a página (mesmo storage, nova instância)', () => {
    const storage = createMemoryStorage()

    const before = createSandboxEditor(storage)
    buildWorkingCircuit(before)
    before.setMeta({ id: 'rascunho-x', name: 'Rascunho X' })
    before.saveDraft('slot-1', 'Meu rascunho')

    // Simula reload da página: nova instância de editor sobre o MESMO storage.
    const afterReload = createSandboxEditor(storage)
    const outcome = afterReload.loadDraft('slot-1')

    expect(outcome.ok).toBe(true)
    expect(afterReload.level.value).toEqual(before.level.value)
  })

  it('lista rascunhos salvos e permite apagar', () => {
    const storage = createMemoryStorage()
    const editor = createSandboxEditor(storage)
    editor.saveDraft('a', 'Rascunho A')
    editor.saveDraft('b', 'Rascunho B')

    expect(editor.listDrafts().map(d => d.slot).sort()).toEqual(['a', 'b'])
    expect(editor.deleteDraft('a')).toBe(true)
    expect(editor.listDrafts().map(d => d.slot)).toEqual(['b'])
  })

  it('carregar um rascunho inexistente retorna erro claro sem quebrar', () => {
    const editor = createSandboxEditor()
    expect(() => editor.loadDraft('nao-existe')).not.toThrow()
    const outcome = editor.loadDraft('nao-existe')
    expect(outcome.ok).toBe(false)
    expect(editor.lastError.value).toContain('não encontrado')
  })
})
