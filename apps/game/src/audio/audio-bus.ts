/**
 * Áudio com WebAudio (MI-12): `WebAudioBus` implementa a interface
 * `AudioBus` do contrato (apps/game/src/app/contracts.ts).
 *
 * Design:
 * - O `AudioContext` só é criado no primeiro `unlock()` (chamado a partir de
 *   um gesto do usuário). Antes disso não existe contexto nem nó de áudio —
 *   zero warning de autoplay e nada toca antes de interação (aceite MI-12).
 * - SFX curtos 100% sintetizados (osciladores + envelopes de ganho): nenhum
 *   arquivo de áudio entra no bundle (SDD: "sem arquivos pesados").
 * - Música ambiente leve: pad de acordes em loop, agendado com lookahead,
 *   com fade in/out no próprio bus da música.
 * - O mute é aplicado num `gain` mestre que silencia SFX e música juntos.
 *   O valor em si é persistido fora daqui: quem compõe passa o estado salvo
 *   em `initialMuted` (ex.: `save.settings.muted` do SaveStore, MI-06) e
 *   grava mudanças via `onMutedChange` — assim o mute sobrevive a recargas
 *   sem o áudio conhecer a camada de persistência.
 * - `suspend()`/`resume()` e o listener de `visibilitychange` seguram o
 *   contexto quando a aba é escondida (economia + política de autoplay).
 */

import type { AudioBus, SoundEffect } from '../app/contracts'

export interface AudioBusOptions {
  /** Estado de mute na criação — tipicamente `save.settings.muted`. */
  readonly initialMuted?: boolean
  /** Volume mestre (0..1). Padrão: 1. */
  readonly volume?: number
  /** Música ambiente desejada? Nada toca antes do `unlock()`. Padrão: true. */
  readonly musicEnabled?: boolean
  /** Fábrica do contexto (testes injetam um mock). Padrão: `new AudioContext()`. */
  readonly contextFactory?: () => AudioContext
  /** Notifica mudanças de mute para quem persiste (ex.: SaveStore). */
  readonly onMutedChange?: (muted: boolean) => void
}

/** Intervalo (s) entre o início de cada acorde do pad ambiente. */
const MUSIC_STEP = 2.4
/** Quanto tempo (s) à frente o scheduler agenda a cada tick. */
const MUSIC_LOOKAHEAD = 0.7
/** Tick do scheduler da música em ms (wall clock). */
const MUSIC_TICK_MS = 250

/**
 * Progressão do pad ambiente: C — Am — F — G, vozes suaves em seno.
 * Cada acorde é um trio de frequências (Hz).
 */
const CHORD_PROGRESSION: ReadonlyArray<readonly [number, number, number]> = [
  [261.63, 329.63, 392.0], // C4 E4 G4
  [220.0, 261.63, 329.63], // A3 C4 E4
  [174.61, 261.63, 349.23], // F3 C4 F4
  [196.0, 246.94, 293.66], // G3 B3 D4
]

/** Um tom sintetizado: oscilador + envelope de ganho. */
interface ToneSpec {
  readonly type: OscillatorType
  /** Frequência inicial (Hz). */
  readonly from: number
  /** Frequência final (Hz) — varredura exponencial. */
  readonly to: number
  /** Instante de início relativo ao `when` do efeito (s). */
  readonly delay: number
  /** Duração do corpo do tom (s). */
  readonly duration: number
  /** Pico do envelope (0..1). */
  readonly peak: number
}

const SFX_RECIPES: Readonly<Record<SoundEffect, readonly ToneSpec[]>> = {
  // Colocar peça: "ploc" curto e macio, descendo.
  place: [
    { type: 'triangle', from: 250, to: 170, delay: 0, duration: 0.06, peak: 0.2 },
  ],
  // Apagar: "toc" mais grave, descendo devagar.
  erase: [
    { type: 'sine', from: 180, to: 110, delay: 0, duration: 0.09, peak: 0.16 },
  ],
  // Rotacionar: blip agudo subindo, bem curto.
  rotate: [
    { type: 'sine', from: 500, to: 660, delay: 0, duration: 0.05, peak: 0.1 },
  ],
  // Sucesso: arpejo C5 → E5 → G5 (acorde maior resolvido).
  success: [
    { type: 'sine', from: 523.25, to: 523.25, delay: 0, duration: 0.18, peak: 0.14 },
    { type: 'sine', from: 659.25, to: 659.25, delay: 0.09, duration: 0.18, peak: 0.14 },
    { type: 'sine', from: 783.99, to: 783.99, delay: 0.18, duration: 0.22, peak: 0.14 },
  ],
  // Erro: "brr" áspero e grave — aviso, não punição.
  error: [
    { type: 'square', from: 190, to: 130, delay: 0, duration: 0.15, peak: 0.05 },
    { type: 'sine', from: 96, to: 70, delay: 0.02, duration: 0.2, peak: 0.08 },
  ],
}

function scheduleTone(
  ctx: AudioContext,
  out: AudioNode,
  when: number,
  spec: ToneSpec,
): void {
  const start = when + spec.delay
  const end = start + spec.duration
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  const freq = osc.frequency

  osc.type = spec.type
  // exponentialRamp não aceita 0 — satura em 1 Hz (inaudível no contexto).
  freq.setValueAtTime(Math.max(spec.from, 1), start)
  freq.exponentialRampToValueAtTime(Math.max(spec.to, 1), end)

  const level = gain.gain
  level.setValueAtTime(0.0001, start)
  // Attack curto (evita clique) seguido de decay exponencial natural.
  level.linearRampToValueAtTime(spec.peak, start + 0.008)
  level.exponentialRampToValueAtTime(0.0001, end)

  osc.connect(gain)
  gain.connect(out)
  osc.start(start)
  osc.stop(end + 0.03)
  osc.onended = () => {
    try {
      osc.disconnect()
      gain.disconnect()
    } catch {
      // Nó já removido do grafo — sem ação.
    }
  }
}

export class WebAudioBus implements AudioBus {
  private readonly volume: number
  private musicWanted: boolean
  private readonly contextFactory?: () => AudioContext
  private readonly onMutedChange?: (muted: boolean) => void

  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private unlocked = false
  private muted: boolean
  private disposed = false

  /** Bus da música ambiente (ganho com fade); null quando parada. */
  private musicBus: GainNode | null = null
  private musicTimer: ReturnType<typeof setTimeout> | null = null
  private musicDisconnectTimer: ReturnType<typeof setTimeout> | null = null
  private nextNoteTime = 0
  private chordIndex = 0

  private readonly onVisibilityChange = (): void => {
    if (document.hidden) this.suspend()
    else this.resume()
  }

  constructor(options: AudioBusOptions = {}) {
    this.volume = clamp01(options.volume ?? 1)
    this.muted = options.initialMuted ?? false
    this.musicWanted = options.musicEnabled ?? true
    this.contextFactory = options.contextFactory
    this.onMutedChange = options.onMutedChange
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibilityChange)
    }
  }

  /** Libera recursos: timers, listener e contexto. Idempotente. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibilityChange)
    }
    this.clearMusicTimer()
    if (this.musicDisconnectTimer !== null) {
      clearTimeout(this.musicDisconnectTimer)
      this.musicDisconnectTimer = null
    }
    const ctx = this.ctx
    this.ctx = null
    this.master = null
    this.musicBus = null
    if (ctx) {
      void ctx.close().catch(() => {
        // Falha ao fechar não é fatal (contexto já inativo).
      })
    }
  }

  // -------------------------------------------------------------------------
  // AudioBus
  // -------------------------------------------------------------------------

  unlock(): void {
    if (this.disposed) return
    if (this.ctx === null) {
      const ctx = this.createContext()
      this.ctx = ctx
      const master = ctx.createGain()
      master.gain.value = this.muted ? 0 : this.volume
      master.connect(ctx.destination)
      this.master = master
    }
    this.unlocked = true
    // Chamado a partir de um gesto: a política de autoplay permite retomar.
    void this.ctx.resume().catch(() => {
      // Contexto pode recusar (ex.: gesto não registrado) — apenas silencia.
    })
    this.applyMusicState()
  }

  play(effect: SoundEffect): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master || !this.unlocked || this.muted) return
    if (ctx.state !== 'running') return // suspenso (aba oculta): nada acumula
    const recipes = SFX_RECIPES[effect]
    const when = ctx.currentTime + 0.001
    for (const spec of recipes) scheduleTone(ctx, master, when, spec)
  }

  setMuted(muted: boolean): void {
    if (this.muted === muted) return
    this.muted = muted
    const ctx = this.ctx
    const master = this.master
    if (ctx && master) {
      master.gain.setValueAtTime(muted ? 0 : this.volume, ctx.currentTime)
    }
    this.applyMusicState()
    this.onMutedChange?.(muted)
  }

  isMuted(): boolean {
    return this.muted
  }

  setMusicEnabled(enabled: boolean): void {
    // `musicWanted` é a intenção; a execução respeita unlock/mute (applyMusicState).
    this.musicWanted = enabled
    this.applyMusicState()
  }

  suspend(): void {
    const ctx = this.ctx
    if (!ctx || !this.unlocked) return
    if (ctx.state === 'running') {
      void ctx.suspend().catch(() => {
        // Falha ao suspender não é fatal.
      })
    }
  }

  resume(): void {
    const ctx = this.ctx
    if (!ctx || !this.unlocked) return
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {
        // Sem gesto do usuário o navegador pode recusar — segue silencioso.
      })
    }
  }

  // -------------------------------------------------------------------------
  // Internos
  // -------------------------------------------------------------------------

  private createContext(): AudioContext {
    return this.contextFactory ? this.contextFactory() : new AudioContext()
  }

  /** Liga/desliga a música conforme intenção, unlock e mute. */
  private applyMusicState(): void {
    if (!this.unlocked || this.ctx === null) return
    if (this.musicWanted && !this.muted) this.startMusic()
    else this.stopMusic()
  }

  private startMusic(): void {
    const ctx = this.ctx
    const master = this.master
    // Já tocando, ou contexto/master indisponíveis: nada a fazer.
    if (!ctx || !master || this.musicBus !== null || this.disposed) return
    const bus = ctx.createGain()
    this.musicBus = bus
    const now = ctx.currentTime
    const level = bus.gain
    // Fade in do pad (evita clique e cumpre o "leve com fade" do SDD).
    level.setValueAtTime(0.0001, now)
    level.linearRampToValueAtTime(1, now + 1.0)
    bus.connect(master)
    this.nextNoteTime = now + 0.05
    this.chordIndex = 0
    this.tickMusic()
  }

  private tickMusic(): void {
    const ctx = this.ctx
    if (!ctx || this.musicBus === null) {
      this.musicTimer = null
      return
    }
    if (!this.muted) {
      // Lookahead: agenda os acordes que começam dentro da janela. Com o
      // `currentTime` avançando sozinho, nunca agenda o mesmo instante duas
      // vezes (o ponteiro `nextNoteTime` só anda para frente).
      while (this.nextNoteTime < ctx.currentTime + MUSIC_LOOKAHEAD) {
        const chord = CHORD_PROGRESSION[this.chordIndex % CHORD_PROGRESSION.length]!
        const start = this.nextNoteTime
        for (const freq of chord) {
          scheduleTone(ctx, this.musicBus, start, {
            type: 'sine',
            from: freq,
            to: freq,
            delay: 0,
            duration: MUSIC_STEP - 0.4,
            peak: 0.05,
          })
        }
        this.chordIndex += 1
        this.nextNoteTime += MUSIC_STEP
      }
    }
    this.musicTimer = setTimeout(() => this.tickMusic(), MUSIC_TICK_MS)
  }

  private stopMusic(): void {
    this.clearMusicTimer()
    const ctx = this.ctx
    const bus = this.musicBus
    if (bus === null) return
    this.musicBus = null
    if (ctx) {
      const now = ctx.currentTime
      const level = bus.gain
      // Fade out antes de desconectar (o corte seco estalaria).
      level.cancelScheduledValues(now)
      level.setValueAtTime(Math.max(level.value, 0.0001), now)
      level.linearRampToValueAtTime(0.0001, now + 0.5)
      this.musicDisconnectTimer = setTimeout(() => {
        this.musicDisconnectTimer = null
        try {
          bus.disconnect()
        } catch {
          // Bus já removido.
        }
      }, 600)
    }
  }

  private clearMusicTimer(): void {
    if (this.musicTimer !== null) {
      clearTimeout(this.musicTimer)
      this.musicTimer = null
    }
  }
}

function clamp01(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}
