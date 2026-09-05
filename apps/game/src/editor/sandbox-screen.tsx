/**
 * Tela do modo sandbox/editor de fases (MI-13, SDD §9.5): grid livre onde o
 * autor coloca sources/sinks/portas/fios, testa na hora com o motor do core
 * e exporta/importa a fase como `LevelSpec` em JSON. Não instancia
 * `BoardRenderer`/`InputController` — o tabuleiro aqui é uma grade simples de
 * botões (view própria do editor); a composição com o Canvas real fica para
 * o ponto de integração (MI-15), que pode montar este modo como mais uma
 * rota do app.
 */
import { useSignal } from '@preact/signals'
import type { Cell, Coord, Direction, GateType } from '@circuit/core/model'
import { inputSidesFor, rotateCw } from '@circuit/core/state'
import { messageForIssue, formatSinkMismatch } from '@circuit/content/text'
import { ScreenHeader, IconButton } from '../ui/chrome'
import type { SandboxEditorState } from './state'

export interface SandboxScreenProps {
  readonly editor: SandboxEditorState
  readonly onBack?: () => void
}

type Tool = 'source0' | 'source1' | 'sink0' | 'sink1' | 'wire' | GateType | 'erase'

const TOOLS: readonly { readonly tool: Tool; readonly label: string }[] = [
  { tool: 'source0', label: 'Fonte 0' },
  { tool: 'source1', label: 'Fonte 1' },
  { tool: 'sink0', label: 'Destino 0' },
  { tool: 'sink1', label: 'Destino 1' },
  { tool: 'wire', label: 'Fio' },
  { tool: 'AND', label: 'AND' },
  { tool: 'OR', label: 'OR' },
  { tool: 'NOT', label: 'NOT' },
  { tool: 'erase', label: 'Apagar' },
]

const WIRE_SHAPES: readonly (readonly Direction[])[] = [
  ['W', 'E'],
  ['N', 'S'],
  ['N', 'E'],
  ['E', 'S'],
  ['S', 'W'],
  ['W', 'N'],
  ['N', 'E', 'S', 'W'],
]

function sameSides(a: readonly Direction[], b: readonly Direction[]): boolean {
  return a.length === b.length && a.every(d => b.includes(d))
}

function nextWireShape(current: readonly Direction[] | null): readonly Direction[] {
  if (current === null) return WIRE_SHAPES[0] as readonly Direction[]
  const index = WIRE_SHAPES.findIndex(shape => sameSides(shape, current))
  const next = WIRE_SHAPES[(index + 1) % WIRE_SHAPES.length]
  return next as readonly Direction[]
}

function cellGlyph(cell: Cell | undefined): string {
  if (cell === undefined || cell.kind === 'empty') return ''
  if (cell.kind === 'source') return `F${cell.value}`
  if (cell.kind === 'sink') return `D${cell.expected}`
  if (cell.kind === 'wire') return '━'
  return cell.gate[0] as string
}

function cellLabel(coord: Coord, cell: Cell | undefined): string {
  const at = `célula ${coord.x},${coord.y}`
  if (cell === undefined || cell.kind === 'empty') return `${at}, vazia`
  if (cell.kind === 'source') return `${at}, fonte valor ${cell.value}, saída ${cell.outputSide}`
  if (cell.kind === 'sink') return `${at}, destino espera ${cell.expected}, entrada ${cell.inputSide}`
  if (cell.kind === 'wire') return `${at}, fio (${cell.sides.join('/')})`
  return `${at}, porta ${cell.gate}, saída ${cell.outputSide}`
}

function applyTool(editor: SandboxEditorState, tool: Tool, coord: Coord): void {
  if (tool === 'erase') {
    editor.eraseCell(coord)
    return
  }
  const existing = editor.cellAt(coord)

  if (tool === 'wire') {
    const current = existing?.kind === 'wire' ? existing.sides : null
    editor.placeCell(coord, { kind: 'wire', sides: nextWireShape(current) })
    return
  }

  if (tool === 'source0' || tool === 'source1') {
    const value = tool === 'source0' ? 0 : 1
    if (existing?.kind === 'source' && existing.value === value) {
      editor.placeCell(coord, { kind: 'source', value, outputSide: rotateCw(existing.outputSide) })
    } else {
      editor.placeCell(coord, { kind: 'source', value, outputSide: 'E' })
    }
    return
  }

  if (tool === 'sink0' || tool === 'sink1') {
    const expected = tool === 'sink0' ? 0 : 1
    if (existing?.kind === 'sink' && existing.expected === expected) {
      editor.placeCell(coord, { kind: 'sink', expected, inputSide: rotateCw(existing.inputSide) })
    } else {
      editor.placeCell(coord, { kind: 'sink', expected, inputSide: 'W' })
    }
    return
  }

  // Porta lógica: AND | OR | NOT
  const gate = tool
  if (existing?.kind === 'gate' && existing.gate === gate) {
    const rotation = rotateCw(existing.rotation)
    editor.placeCell(coord, {
      kind: 'gate',
      gate,
      rotation,
      inputSides: inputSidesFor(gate, rotation),
      outputSide: rotation,
    })
  } else {
    editor.placeCell(coord, {
      kind: 'gate',
      gate,
      rotation: 'E',
      inputSides: inputSidesFor(gate, 'E'),
      outputSide: 'E',
    })
  }
}

export function SandboxScreen({ editor, onBack }: SandboxScreenProps) {
  const activeTool = useSignal<Tool>('wire')
  const importText = useSignal('')
  const draftSlot = useSignal('rascunho-1')
  const draftLabel = useSignal('Meu rascunho')
  const exportedJson = useSignal<string | null>(null)
  const exportErrors = useSignal<readonly string[] | null>(null)

  const level = editor.level.value
  const result = editor.lastResult.value

  function runExport(): void {
    const outcome = editor.exportJson()
    if (outcome.ok) {
      exportedJson.value = outcome.json
      exportErrors.value = null
    } else {
      exportedJson.value = null
      exportErrors.value = outcome.errors
    }
  }

  function runImport(): void {
    editor.importJson(importText.value)
  }

  return (
    <div className="sandbox-editor">
      <ScreenHeader title="Sandbox e editor de fases" onBack={onBack} />

      <section aria-label="Metadados da fase">
        <label>
          Nome
          <input
            value={level.name}
            onInput={e => editor.setMeta({ name: (e.target as HTMLInputElement).value })}
          />
        </label>
        <label>
          Identificador
          <input
            value={level.id}
            onInput={e => editor.setMeta({ id: (e.target as HTMLInputElement).value })}
          />
        </label>
      </section>

      <section aria-label="Ferramentas" role="toolbar">
        {TOOLS.map(def => (
          <button
            key={def.tool}
            type="button"
            aria-pressed={activeTool.value === def.tool}
            onClick={() => (activeTool.value = def.tool)}
          >
            {def.label}
          </button>
        ))}
      </section>

      <section aria-label="Grid da fase" data-testid="sandbox-grid">
        {Array.from({ length: level.grid.height }, (_, y) => (
          <div className="sandbox-editor__row" key={y}>
            {Array.from({ length: level.grid.width }, (_, x) => {
              const coord = { x, y }
              const cell = editor.cellAt(coord)
              return (
                <button
                  key={x}
                  type="button"
                  className="sandbox-editor__cell"
                  aria-label={cellLabel(coord, cell)}
                  onClick={() => applyTool(editor, activeTool.value, coord)}
                >
                  {cellGlyph(cell)}
                </button>
              )
            })}
          </div>
        ))}
      </section>

      <section aria-label="Teste imediato">
        <IconButton label="Simular circuito" onClick={() => editor.runSimulation()}>
          Simular
        </IconButton>
        {result !== null ? (
          <div data-testid="sandbox-diagnostic" role="status">
            {result.ok ? (
              <p>Circuito funciona: todos os destinos foram satisfeitos.</p>
            ) : (
              <ul>
                {result.issues.map((issue, i) => {
                  const message = messageForIssue(issue.kind)
                  return (
                    <li key={`issue-${i}`}>
                      <strong>{message.titulo}</strong>: {message.explicacao}
                    </li>
                  )
                })}
                {result.sinks
                  .filter(sink => !sink.satisfied)
                  .map((sink, i) => {
                    const message = formatSinkMismatch(sink.expected, sink.actual)
                    return (
                      <li key={`sink-${i}`}>
                        <strong>{message.titulo}</strong>: {message.explicacao}
                      </li>
                    )
                  })}
              </ul>
            )}
          </div>
        ) : null}
      </section>

      <section aria-label="Exportar fase">
        <IconButton label="Exportar JSON" onClick={runExport}>
          Exportar
        </IconButton>
        {exportedJson.value !== null ? (
          <textarea readOnly data-testid="sandbox-export-json" value={exportedJson.value} />
        ) : null}
        {exportErrors.value !== null ? (
          <ul data-testid="sandbox-export-errors">
            {exportErrors.value.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <section aria-label="Importar fase">
        <textarea
          data-testid="sandbox-import-input"
          value={importText.value}
          onInput={e => (importText.value = (e.target as HTMLTextAreaElement).value)}
        />
        <IconButton label="Importar JSON" onClick={runImport}>
          Importar
        </IconButton>
        {editor.lastError.value !== null ? (
          <p role="alert" data-testid="sandbox-import-error">
            {editor.lastError.value}
          </p>
        ) : null}
      </section>

      <section aria-label="Rascunhos">
        <label>
          Slot
          <input
            value={draftSlot.value}
            onInput={e => (draftSlot.value = (e.target as HTMLInputElement).value)}
          />
        </label>
        <label>
          Nome do rascunho
          <input
            value={draftLabel.value}
            onInput={e => (draftLabel.value = (e.target as HTMLInputElement).value)}
          />
        </label>
        <IconButton
          label="Salvar rascunho"
          onClick={() => editor.saveDraft(draftSlot.value, draftLabel.value)}
        >
          Salvar rascunho
        </IconButton>
        <ul data-testid="sandbox-draft-list">
          {editor.listDrafts().map(draft => (
            <li key={draft.slot}>
              {draft.label}
              <IconButton label={`Carregar ${draft.label}`} onClick={() => editor.loadDraft(draft.slot)}>
                Carregar
              </IconButton>
              <IconButton label={`Apagar ${draft.label}`} onClick={() => editor.deleteDraft(draft.slot)}>
                Apagar
              </IconButton>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
