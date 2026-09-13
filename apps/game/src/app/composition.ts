import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import type { Signal } from '@preact/signals'
import { LevelEditor } from '@circuit/core/state'
import { simulateWithTrace } from '@circuit/core/sim'
import type { LevelSpec, BoardState, Coord, Direction, SimulationIssue } from '@circuit/core/model'
import { CanvasBoardRenderer } from '../board'
import { PointerInputController } from '../input'
import { WebAudioBus } from '../audio'
import type { GameServices } from '../ui/screens/game'
import type { AppState } from '../ui/state'
import type { Tool } from '../ui/hud/tool-palette'
import type { AudioBus, InputCommand } from './contracts'

// Global audio bus instance (MI-12). It survives across levels.
let globalAudioBus: AudioBus | null = null

export function getAudioBus(state: AppState): AudioBus {
  if (!globalAudioBus) {
    globalAudioBus = new WebAudioBus({
      initialMuted: state.muted.value,
      musicEnabled: true,
      onMutedChange: (muted) => state.setSettings({ muted }),
    })
  }
  return globalAudioBus
}

export function useGameComposition(
  level: LevelSpec,
  activeToolSignal: Signal<Tool>,
  state: AppState
): GameServices {
  const audio = useMemo(() => getAudioBus(state), [state])
  
  // Create editor once per level instance
  const editorRef = useRef<LevelEditor | null>(null)
  if (editorRef.current === null || editorRef.current.level.id !== level.id) {
    editorRef.current = new LevelEditor(level, undefined, { maxHistory: 200 })
  }
  const editor = editorRef.current

  const [board, setBoard] = useState<BoardState>(editor.board)
  const [issues, setIssues] = useState<readonly SimulationIssue[]>([])
  const [selected, setSelected] = useState<Coord | null>(null)
  const [zoom, setZoom] = useState(1)

  const rendererRef = useRef<CanvasBoardRenderer | null>(null)
  const inputRef = useRef<PointerInputController | null>(null)

  if (rendererRef.current === null) {
    rendererRef.current = new CanvasBoardRenderer()
  }
  if (inputRef.current === null) {
    inputRef.current = new PointerInputController({
      cellAt: (x, y) => rendererRef.current?.cellAt(x, y) ?? null,
      getTool: () => activeToolSignal.value,
      hasGateAt: (coord) => {
        const cell = editorRef.current?.cellAt(coord.x, coord.y)
        const tool = activeToolSignal.value
        return cell?.cell.kind === 'gate' && !cell.fixed &&
          (tool === 'wire' || cell.cell.gate === tool)
      },
    })
  }

  const renderer = rendererRef.current
  const input = inputRef.current

  // Expose services
  const services = useMemo<GameServices>(() => ({
    renderer,
    input,
    audio,
    getBoard: () => editor.board,
    simulate: (l, b) => {
      const res = simulateWithTrace(l, b, { trace: true })
      // Keep track of issues for rendering
      setIssues(res.result.issues)
      return res.result
    },
    canUndo: editor.canUndo,
    canRedo: editor.canRedo,
    canClear: editor.board.placedCells.length > 0,
    zoom,
    onZoomIn: () => input.setZoom(input.getZoom() + 0.5),
    onZoomOut: () => input.setZoom(input.getZoom() - 0.5),
    onResetView: () => input.setZoom(1),
    onUndo: () => {
      audio.unlock()
      if (editor.undo()) {
        audio.play('erase')
        setBoard(editor.board)
        setIssues([])
      }
    },
    onRedo: () => {
      audio.unlock()
      if (editor.redo()) {
        audio.play('place')
        setBoard(editor.board)
        setIssues([])
      }
    },
    onClear: () => {
      audio.unlock()
      if (editor.clear()) {
        audio.play('erase')
        setBoard(editor.board)
        setIssues([])
      }
    }
  }), [editor, renderer, input, audio, board, zoom])

  // Sync state to renderer
  useEffect(() => {
    renderer.render({
      level,
      board: editor.board,
      issues,
      selected,
    })
  }, [renderer, level, board, issues, selected])

  // Hook up input commands
  useEffect(() => {
    const handleCommand = (cmd: InputCommand) => {
      audio.unlock()
      const tool = activeToolSignal.value
      
      let changed = false
      if (cmd.type === 'drag-path') {
        if (tool === 'wire') {
          const pathCoords = cmd.path
          const placements = pathCoords.map((coord, i) => {
            const sides: Direction[] = []
            if (i > 0) {
              const prev = pathCoords[i - 1]!
              if (prev.x < coord.x) sides.push('W')
              else if (prev.x > coord.x) sides.push('E')
              else if (prev.y < coord.y) sides.push('N')
              else if (prev.y > coord.y) sides.push('S')
            }
            if (i < pathCoords.length - 1) {
              const next = pathCoords[i + 1]!
              if (next.x < coord.x) sides.push('W')
              else if (next.x > coord.x) sides.push('E')
              else if (next.y < coord.y) sides.push('N')
              else if (next.y > coord.y) sides.push('S')
            }
            // Fallback for single cell wire or if we want to ensure at least one side?
            // Editor allows empty sides.
            return { coord, sides }
          })
          changed = editor.dragWires(placements)
          if (changed) audio.play('place')
        }
      } else if (cmd.type === 'rotate') {
        changed = editor.rotateGate(cmd.coord.x, cmd.coord.y)
        if (changed) audio.play('rotate')
      } else if (cmd.type === 'place-gate') {
        const cell = editor.cellAt(cmd.coord.x, cmd.coord.y)?.cell
        // Selecionar uma porta existente preserva sua orientação.
        if (cell?.kind !== 'gate' || cell.gate !== cmd.gate) {
          changed = editor.placeGate(cmd.coord.x, cmd.coord.y, cmd.gate, 'E')
          if (changed) audio.play('place')
        }
      } else if (cmd.type === 'erase') {
        changed = editor.erase(cmd.coord.x, cmd.coord.y)
        if (changed) audio.play('erase')
      } else if (cmd.type === 'undo') {
        changed = editor.undo()
      } else if (cmd.type === 'redo') {
        changed = editor.redo()
      } else if (cmd.type === 'clear-board') {
        changed = editor.clear()
      }
      
      if (changed) {
        setBoard(editor.board)
        setIssues([])
      }
    }
    
    const unbindCmd = input.onCommand(handleCommand)
    
    const unbindSel = input.onSelectionChange(setSelected)
    const unbindViewport = input.onViewportChange(viewport => {
      renderer.setViewport(viewport)
      setZoom(viewport.zoom)
    })
    
    return () => {
      unbindCmd()
      unbindSel()
      unbindViewport()
    }
  }, [input, editor, activeToolSignal, audio, renderer])

  return services
}
