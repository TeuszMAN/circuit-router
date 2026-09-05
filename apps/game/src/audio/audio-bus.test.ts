/**
 * Testes do WebAudioBus (MI-12) com `AudioContext` mockado: nada toca antes
 * do primeiro gesto; mute silencia tudo e persiste entre recargas; o contexto
 * é suspenso ao esconder a aba e retomado ao voltar; música ambiente só
 * começa após o unlock e com fade.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WebAudioBus } from './audio-bus'

// ---------------------------------------------------------------------------
// Mock de WebAudio (jsdom não implementa AudioContext)
// ---------------------------------------------------------------------------

class MockAudioParam {
  value = 1
  /** Chamadas gravadas: [método, valor?, tempo?]. */
  readonly events: Array<[string, number?, number?]> = []

  setValueAtTime(v: number, t: number): this {
    this.events.push(['set', v, t])
    this.value = v
    return this
  }

  linearRampToValueAtTime(v: number, t: number): this {
    this.events.push(['linear', v, t])
    this.value = v
    return this
  }

  exponentialRampToValueAtTime(v: number, t: number): this {
    this.events.push(['exp', v, t])
    this.value = v
    return this
  }

  cancelScheduledValues(t: number): this {
    this.events.push(['cancel', t])
    return this
  }
}

class MockNode {
  readonly connected: unknown[] = []

  connect(target: unknown): unknown {
    this.connected.push(target)
    return target
  }

  disconnect(): void {
    this.connected.length = 0
  }
}

class MockGain extends MockNode {
  readonly gain = new MockAudioParam()
}

class MockOscillator extends MockNode {
  type = 'sine'
  readonly frequency = new MockAudioParam()
  readonly detune = new MockAudioParam()
  onended: (() => void) | null = null
  readonly startedAt: number[] = []
  readonly stoppedAt: number[] = []

  start(t = 0): void {
    this.startedAt.push(t)
  }

  stop(t = 0): void {
    this.stoppedAt.push(t)
  }
}

class MockAudioContext {
  state: 'running' | 'suspended' = 'suspended'
  currentTime = 0
  readonly sampleRate = 44100
  readonly destination = new MockNode()
  readonly oscillators: MockOscillator[] = []
  readonly gains: MockGain[] = []
  resumeCalls = 0
  suspendCalls = 0
  closed = false

  async resume(): Promise<void> {
    this.resumeCalls += 1
    this.state = 'running'
  }

  async suspend(): Promise<void> {
    this.suspendCalls += 1
    this.state = 'suspended'
  }

  async close(): Promise<void> {
    this.closed = true
  }

  createOscillator(): MockOscillator {
    const osc = new MockOscillator()
    this.oscillators.push(osc)
    return osc
  }

  createGain(): MockGain {
    const gain = new MockGain()
    this.gains.push(gain)
    return gain
  }
}

function createHarness(options: { musicEnabled?: boolean } = {}) {
  const ctx = new MockAudioContext()
  const factory = vi.fn(() => ctx as unknown as AudioContext)
  const bus = new WebAudioBus({
    contextFactory: factory,
    musicEnabled: options.musicEnabled ?? false,
  })
  return { ctx, factory, bus }
}

/** Conta osciladores que realmente começaram a tocar. */
function startedOscillators(ctx: MockAudioContext): number {
  return ctx.oscillators.filter(o => o.startedAt.length > 0).length
}

function masterGain(ctx: MockAudioContext): MockGain {
  const master = ctx.gains.find(g => g.connected.includes(ctx.destination))
  if (!master) throw new Error('master gain não encontrado no grafo')
  return master
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('WebAudioBus · antes da interação', () => {
  it('não cria AudioContext nem toca nada antes do unlock (sem warning de autoplay)', () => {
    const { ctx, factory, bus } = createHarness()
    bus.play('place')
    bus.setMusicEnabled(true)
    bus.setMuted(false)
    expect(factory).not.toHaveBeenCalled()
    expect(ctx.oscillators).toHaveLength(0)
    bus.dispose()
  })

  it('unlock cria o contexto uma única vez e o retoma', () => {
    const { ctx, factory, bus } = createHarness()
    bus.unlock()
    bus.unlock()
    expect(factory).toHaveBeenCalledTimes(1)
    expect(ctx.resumeCalls).toBeGreaterThanOrEqual(1)
    expect(ctx.state).toBe('running')
    bus.dispose()
  })
})

describe('WebAudioBus · efeitos sonoros', () => {
  it('play após o unlock sintetiza os tons do efeito', () => {
    const { ctx, bus } = createHarness()
    bus.unlock()
    expect(startedOscillators(ctx)).toBe(0)

    bus.play('success') // arpejo de 3 notas
    expect(startedOscillators(ctx)).toBe(3)
    bus.dispose()
  })

  it('play com o contexto suspenso não acumula som', () => {
    const { ctx, bus } = createHarness()
    bus.unlock()
    bus.play('place')
    const before = startedOscillators(ctx)

    bus.suspend()
    bus.play('error')
    expect(startedOscillators(ctx)).toBe(before)
    bus.dispose()
  })
})

describe('WebAudioBus · mute', () => {
  it('mute zera o ganho mestre e silencia os próximos efeitos', () => {
    const { ctx, bus } = createHarness()
    bus.unlock()
    bus.play('place')
    const before = startedOscillators(ctx)

    bus.setMuted(true)
    expect(bus.isMuted()).toBe(true)
    expect(masterGain(ctx).gain.value).toBe(0)

    bus.play('error')
    expect(startedOscillators(ctx)).toBe(before)

    bus.setMuted(false)
    expect(masterGain(ctx).gain.value).toBe(1)
    bus.play('place')
    expect(startedOscillators(ctx)).toBe(before + 1)
    bus.dispose()
  })

  it('mute inicial (vindo do save) já nasce aplicado', () => {
    const ctx = new MockAudioContext()
    const bus = new WebAudioBus({
      contextFactory: () => ctx as unknown as AudioContext,
      initialMuted: true,
      musicEnabled: false,
    })
    expect(bus.isMuted()).toBe(true)
    bus.unlock()
    expect(masterGain(ctx).gain.value).toBe(0)
    bus.play('success')
    expect(startedOscillators(ctx)).toBe(0)
    bus.dispose()
  })

  it('persiste entre recargas via onMutedChange + initialMuted', () => {
    let persisted: boolean | undefined
    const ctx1 = new MockAudioContext()
    const bus = new WebAudioBus({
      contextFactory: () => ctx1 as unknown as AudioContext,
      musicEnabled: false,
      onMutedChange: muted => {
        persisted = muted // SaveStore.updateSettings({ muted }) na prática
      },
    })
    bus.unlock()
    bus.setMuted(true)
    bus.setMuted(false)
    bus.setMuted(true)
    expect(persisted).toBe(true)
    bus.dispose()

    const ctx2 = new MockAudioContext()
    const bus2 = new WebAudioBus({
      contextFactory: () => ctx2 as unknown as AudioContext,
      initialMuted: persisted, // valor gravado pelo SaveStore na "recarga"
      musicEnabled: false,
    })
    expect(bus2.isMuted()).toBe(true)
    bus2.unlock()
    expect(masterGain(ctx2).gain.value).toBe(0)
    bus2.play('place')
    expect(startedOscillators(ctx2)).toBe(0)
    bus2.dispose()
  })
})

describe('WebAudioBus · contexto e aba', () => {
  it('esconder a aba suspende o contexto e voltar o retoma', () => {
    const { ctx, bus } = createHarness()
    bus.unlock()
    const resumeAfterUnlock = ctx.resumeCalls

    const original = Object.getOwnPropertyDescriptor(document, 'hidden')
    let hidden = true
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => hidden,
    })
    try {
      document.dispatchEvent(new Event('visibilitychange'))
      expect(ctx.suspendCalls).toBe(1)
      expect(ctx.state).toBe('suspended')

      hidden = false
      document.dispatchEvent(new Event('visibilitychange'))
      expect(ctx.resumeCalls).toBe(resumeAfterUnlock + 1)
      expect(ctx.state).toBe('running')
    } finally {
      if (original) Object.defineProperty(document, 'hidden', original)
      else delete (document as { hidden?: boolean }).hidden
    }
    bus.dispose()
  })
})

describe('WebAudioBus · música ambiente', () => {
  it('não toca antes do unlock mesmo com música habilitada', () => {
    const { ctx, factory, bus } = createHarness({ musicEnabled: true })
    bus.setMusicEnabled(true)
    expect(factory).not.toHaveBeenCalled()
    expect(ctx.oscillators).toHaveLength(0)
    bus.dispose()
  })

  it('começa após o unlock com fade in e para com fade out', () => {
    const { ctx, bus } = createHarness({ musicEnabled: true })
    bus.unlock()
    // Acorde inicial do pad (3 vozes seno) + bus de música com fade.
    const musicOscillators = ctx.oscillators.filter(o => o.startedAt.length > 0)
    expect(musicOscillators.length).toBeGreaterThanOrEqual(3)

    const musicBus = ctx.gains.find(g => g !== masterGain(ctx))
    expect(musicBus).toBeDefined()
    const fadeIn = musicBus!.gain.events.some(
      ([method, value]) => method === 'linear' && value === 1,
    )
    expect(fadeIn).toBe(true)

    bus.setMusicEnabled(false)
    const fadeOut = musicBus!.gain.events.some(
      ([method, value]) => method === 'linear' && value === 0.0001,
    )
    expect(fadeOut).toBe(true)
    bus.dispose()
  })

  it('mute derruba a música junto com os efeitos', () => {
    const { ctx, bus } = createHarness({ musicEnabled: true })
    bus.unlock()
    const musicBus = ctx.gains.find(g => g !== masterGain(ctx))
    expect(musicBus).toBeDefined()

    bus.setMuted(true)
    expect(masterGain(ctx).gain.value).toBe(0)
    bus.setMuted(false)
    bus.dispose()
  })
})
