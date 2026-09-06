import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import type { Signal } from '@preact/signals'
import { LevelEditor } from '@circuit/core/state'
import { simulateWithTrace } from '@circuit/core/sim'
import type { LevelSpec, BoardState, Coord, GateType, SimulationResult } from '@circuit/core/model'
import { CanvasBoardRenderer } from '../board'
import { PointerInputController } from '../input'
import { WebAudioBus } from '../audio'
import type { GameServices } from '../ui/screens/game'
import type { AppState } from '../ui/state'
import type { Tool } from '../ui/hud/tool-palette'
import type { AudioBus } from './contracts'

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
  const [issues, setIssues] = useState<readonly any[]>([])

  const rendererRef = useRef<CanvasBoardRenderer | null>(null)
  const inputRef = useRef<PointerInputController | null>(null)

  if (rendererRef.current === null) {
    rendererRef.current = new CanvasBoardRenderer()
  }
  if (inputRef.current === null) {
    inputRef.current = new PointerInputController({
      cellAt: (x, y) => rendererRef.current?.cellAt(x, y) ?? null,
      hasGateAt: (coord) => {
        const cell = editor.cellAt(coord.x, coord.y)
        return cell?.cell.kind === 'gate'
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
    onUndo: () => {
      audio.unlock()
      if (editor.undo()) {
        audio.play('erase')
        setBoard(editor.board)
      }
    },
    onRedo: () => {
      audio.unlock()
      if (editor.redo()) {
        audio.play('place')
        setBoard(editor.board)
      }
    },
    onClear: () => {
      audio.unlock()
      if (editor.clear()) {
        audio.play('erase')
        setBoard(editor.board)
      }
    }
  }), [editor, renderer, input, audio, board])

  // Sync state to renderer
  useEffect(() => {
    renderer.render({
      level,
      board: editor.board,
      issues,
      selected: input.getSelected()
    })
  }, [renderer, level, board, issues, input.getSelected()])

  // Hook up input commands
  useEffect(() => {
    const handleCommand = (cmd: any) => {
      audio.unlock()
      const tool = activeToolSignal.value
      
      let changed = false
      if (cmd.type === 'drag-path') {
        if (tool === 'wire') {
          const pathCoords: Coord[] = cmd.path
          const placements = pathCoords.map((coord, i) => {
            const sides: ('N' | 'S' | 'E' | 'W')[] = []
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
      }
      
      if (changed) setBoard(editor.board)
    }
    
    const unbindCmd = input.onCommand(handleCommand)
    
    const unbindSel = input.onSelectionChange((coord) => {
      if (!coord) return
      
      audio.unlock()
      const tool = activeToolSignal.value
      let changed = false
      
      if (tool === 'erase') {
        changed = editor.erase(coord.x, coord.y)
        if (changed) audio.play('erase')
      } else if (tool === 'AND' || tool === 'OR' || tool === 'NOT') {
        changed = editor.placeGate(coord.x, coord.y, tool, 'E')
        if (changed) audio.play('place')
      }
      
      if (changed) setBoard(editor.board)
    })
    
    return () => {
      unbindCmd()
      unbindSel()
    }
  }, [input, editor, activeToolSignal, audio])

  return services
}
