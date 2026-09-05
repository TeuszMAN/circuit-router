import type {
  BoardState,
  Coord,
  GateType,
  LevelSpec,
  SimulationIssue,
} from '@circuit/core/model'

/**
 * Tudo que o renderizador precisa para desenhar um frame. Não inclui estado
 * de animação interno (isso é responsabilidade do próprio `BoardRenderer`).
 */
export interface RenderFrame {
  readonly level: LevelSpec
  readonly board: BoardState
  readonly issues: readonly SimulationIssue[]
  readonly selected: Coord | null
}

/**
 * Implementada pela camada de renderização Canvas (MI-08). O resto do app
 * consome só esta interface — nunca toca `CanvasRenderingContext2D`
 * diretamente (ADR-0001 "o Canvas desenha, o DOM não sabe de células").
 */
export interface BoardRenderer {
  mount(container: HTMLElement): void
  unmount(): void
  resize(widthPx: number, heightPx: number, devicePixelRatio: number): void
  render(frame: RenderFrame): void
  /** Converte um ponto em pixels do container para uma célula do grid. */
  cellAt(xPx: number, yPx: number): Coord | null
}

/** Comandos que a entrada emite — nunca muta `BoardState` diretamente. */
export type InputCommand =
  | { readonly type: 'drag-path'; readonly path: readonly Coord[] }
  | { readonly type: 'place-gate'; readonly coord: Coord; readonly gate: GateType }
  | { readonly type: 'rotate'; readonly coord: Coord }
  | { readonly type: 'erase'; readonly coord: Coord }
  | { readonly type: 'clear-board' }
  | { readonly type: 'undo' }
  | { readonly type: 'redo' }

/**
 * Implementada pela camada de entrada por toque (MI-09). Unifica ponteiro,
 * caneta e mouse; emite `InputCommand`s consumidos pelo ponto de composição
 * (MI-15), que os traduz em comandos do core.
 */
export interface InputController {
  attach(element: HTMLElement): void
  detach(): void
  onCommand(listener: (command: InputCommand) => void): () => void
  setZoom(scale: number): void
}

export type SoundEffect = 'place' | 'erase' | 'rotate' | 'success' | 'error'

/** Implementada pela camada de áudio WebAudio (MI-12). */
export interface AudioBus {
  /** Desbloqueia o `AudioContext` — deve ser chamado a partir de um gesto do usuário. */
  unlock(): void
  play(effect: SoundEffect): void
  setMuted(muted: boolean): void
  isMuted(): boolean
  setMusicEnabled(enabled: boolean): void
  suspend(): void
  resume(): void
}
