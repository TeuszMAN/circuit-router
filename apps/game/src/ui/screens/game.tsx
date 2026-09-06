/**
 * Tela de jogo: tabuleiro + HUD mobile-first (MI-10).
 *
 * Fronteira desta tarefa é o SHELL — o tabuleiro em si é desenhado pelo
 * `BoardRenderer` (MI-08) e a entrada pelo `InputController` (MI-09), recebidos
 * aqui por contrato (`services`) e NUNCA instanciados. O host monta
 * renderer/input num container quando o pai os fornece; sem eles, exibe o
 * placeholder do canvas. A composição board↔editor (MI-15) alimentará
 * `services.getBoard()` e os comandos do HUD.
 */
import { useSignal } from '@preact/signals'
import { useEffect, useRef } from 'preact/hooks'
import { simulate } from '@circuit/core/sim'
import type { BoardState, LevelSpec, SimulationResult } from '@circuit/core/model'
import type { AudioBus, BoardRenderer, InputController } from '../../app/contracts'
import type { AppState } from '../state'
import { requestConcept } from '../concept'
import { IconButton } from '../chrome'
import { IconBulb, IconPause, IconPlay, IconQuestion, IconRedo, IconTrash, IconUndo } from '../icons'
import { ToolPalette, type Tool } from '../hud/tool-palette'
import { PauseOverlay } from '../hud/pause-overlay'
import { ResultModal, type ResultOutcome } from '../result-modal'
import { useGameComposition } from '../../app/composition'
import { HintBanner, useHintController } from '../hints'

/** Camada de serviços opcionais que o shell recebe de fora (MI-08/09/12/15). */
export interface GameServices {
  readonly renderer?: BoardRenderer | null
  readonly input?: InputController | null
  readonly audio?: AudioBus | null
  /** Estado editável corrente — a composição (MI-15) passa o editor. */
  readonly getBoard?: () => BoardState
  /** Substitui a simulação padrão do core (raro; MI-15 pode precisar). */
  readonly simulate?: (level: LevelSpec, board: BoardState) => SimulationResult
  readonly canUndo?: boolean
  readonly canRedo?: boolean
  readonly canClear?: boolean
  readonly onUndo?: () => void
  readonly onRedo?: () => void
  readonly onClear?: () => void
}

export interface GameScreenProps {
  readonly level: LevelSpec
  readonly state: AppState
  /** Próxima fase da campanha, ou null quando esta é a última. */
  readonly nextLevelId: string | null
  readonly services?: GameServices
  readonly onOpenNext: (levelId: string) => void
  readonly onExit: () => void
  readonly onHome: () => void
}

function emptyBoard(levelId: string): BoardState {
  return { levelId, placedCells: [] }
}

function countBoard(board: BoardState): { readonly pieces: number; readonly gates: number } {
  let gates = 0
  for (const placed of board.placedCells) {
    if (placed.cell.kind === 'gate') gates += 1
  }
  return { pieces: board.placedCells.length, gates }
}

/** Estrelas da vitória (SDD §5.2/§9.E): ★2 peças, ★3 portas. */
export function starsFor(level: LevelSpec, board: BoardState): 1 | 2 | 3 {
  const { pieces, gates } = countBoard(board)
  let stars: 1 | 2 | 3 = 1
  if (pieces <= level.starThresholds.maxPieces) stars = 2
  if (gates <= level.starThresholds.maxGates) stars = 3
  return stars
}

/** Host do canvas: monta renderer/entrada por contrato quando fornecidos. */
function BoardHost({
  renderer,
  input,
  placeholder,
}: {
  readonly renderer?: BoardRenderer | null
  readonly input?: InputController | null
  readonly placeholder: string
}) {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = host.current
    if (!element) return
    renderer?.mount(element)
    input?.attach(element)
    return () => {
      input?.detach()
      renderer?.unmount()
    }
  }, [renderer, input])

  const hasRenderer = renderer !== undefined && renderer !== null

  return (
    <div
      ref={host}
      className="board-slot"
      data-testid="board-slot"
      style={hasRenderer ? 'padding:0;display:block' : undefined}
    >
      {hasRenderer ? null : (
        <p className="board-slot__placeholder">
          <span aria-hidden="true" style="font-size:2.2rem;line-height:1">
            ╋
          </span>
          {placeholder}
        </p>
      )}
    </div>
  )
}

export function GameScreen({
  level,
  state,
  nextLevelId,
  services: externalServices,
  onOpenNext,
  onExit,
  onHome,
}: GameScreenProps) {
  const paused = useSignal(false)
  const outcome = useSignal<ResultOutcome | null>(null)
  const activeTool = useSignal<Tool>('wire')
  const hint = useHintController(level.hints)

  const composedServices = useGameComposition(level, activeTool, state)
  const services = externalServices ?? composedServices

  const { maxGates } = level.starThresholds

  function closeOverlays(): void {
    outcome.value = null
  }

  function runSimulation(): void {
    const board = services?.getBoard?.() ?? emptyBoard(level.id)
    const result =
      services?.simulate !== undefined
        ? services.simulate(level, board)
        : simulate(level, board)

    if (!result.ok) {
      hint.notifyFailure()
      outcome.value = {
        kind: 'error',
        issues: result.issues,
        sinks: result.sinks,
      }
      return
    }

    const { pieces, gates } = countBoard(board)
    const stars = starsFor(level, board)
    // Vitória real: guarda o melhor resultado + marca "resolvida com dica".
    state.recordResult(level.id, {
      stars,
      pieces,
      gates,
      withHint: hint.used,
    })
    hint.close()
    outcome.value = {
      kind: 'win',
      stars,
      usedGates: gates,
      gateLimit: maxGates,
      usedHint: hint.used,
    }
  }

  const canUndo = services?.canUndo === true
  const canRedo = services?.canRedo === true
  const canClear = services?.canClear === true

  return (
    <div className="game">
      <header className="game__topbar safe-top">
        <IconButton label="Pausar" onClick={() => (paused.value = true)}>
          <IconPause />
        </IconButton>
        <h1 className="game__topbar-title">{level.name}</h1>
        <IconButton
          label="Painel de conceito"
          onClick={() => requestConcept(activeTool.value === 'erase' ? undefined : activeTool.value)}
        >
          <IconQuestion />
        </IconButton>
      </header>

      <div className="game__stage">
        <BoardHost
          renderer={services?.renderer}
          input={services?.input}
          placeholder="Monte o circuito aqui — o tabuleiro entra nesta área."
        />

        {hint.text !== null ? (
          <HintBanner label={hint.bannerLabel} text={hint.text} onClose={hint.close} />
        ) : null}

        {paused.value ? (
          <PauseOverlay
            levelName={level.name}
            onResume={() => (paused.value = false)}
            onExit={onExit}
            onHome={onHome}
          />
        ) : null}

        {outcome.value !== null ? (
          <ResultModal
            outcome={outcome.value}
            levelName={level.name}
            hasNext={nextLevelId !== null}
            onNext={() => (nextLevelId !== null ? onOpenNext(nextLevelId) : onExit())}
            onRetry={closeOverlays}
            onExit={onExit}
          />
        ) : null}
      </div>

      <footer className="game__hud">
        <div className="hud-actions" role="group" aria-label="Ações da fase">
          <IconButton
            label="Desfazer"
            onClick={() => services?.onUndo?.()}
            disabled={!canUndo}
          >
            <IconUndo />
          </IconButton>
          <IconButton
            label="Refazer"
            onClick={() => services?.onRedo?.()}
            disabled={!canRedo}
          >
            <IconRedo />
          </IconButton>
          <IconButton
            label="Limpar tabuleiro"
            onClick={() => services?.onClear?.()}
            disabled={!canClear}
          >
            <IconTrash />
          </IconButton>
          <IconButton label="Dica" onClick={hint.press}>
            <IconBulb />
          </IconButton>
          <IconButton label="Simular circuito" onClick={runSimulation}>
            <IconPlay />
          </IconButton>
        </div>
        <ToolPalette activeTool={activeTool} />
      </footer>
    </div>
  )
}
