import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CanvasBoardRenderer } from './canvas-board-renderer'
import {
  installCanvas2DMock,
  makeFrame,
  makeInertFrame,
  makeIssue,
  makeMatchMedia,
  makeRafDriver,
  makeResizeObserverDriver,
  paintCount,
  type FakeContext,
} from './renderer-test-helpers'

// Durações da timeline de sinal (signal-animation.ts) — usadas para avançar o
// relógio fake da animação além do fim e além da primeira janela.
const STEP = 190
const FADE = 160
const HOLD = 480
const TOTAL = STEP + FADE + HOLD

describe('CanvasBoardRenderer — ciclo de vida e DPR', () => {
  let container: HTMLElement
  let ctx: FakeContext
  let restoreCanvas: () => void

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    const mock = installCanvas2DMock()
    ctx = mock.ctx
    restoreCanvas = mock.restore
  })

  afterEach(() => {
    restoreCanvas()
    container.remove()
  })

  function mountRenderer(options?: ConstructorParameters<typeof CanvasBoardRenderer>[0]) {
    const renderer = new CanvasBoardRenderer(options)
    renderer.mount(container)
    return renderer
  }

  it('monta um <canvas> dentro do container', () => {
    mountRenderer()
    expect(container.childElementCount).toBe(1)
    const canvas = container.firstElementChild as HTMLCanvasElement
    expect(canvas.tagName).toBe('CANVAS')
  })

  it('desmonta removendo o canvas do DOM', () => {
    const renderer = mountRenderer()
    renderer.unmount()
    expect(container.childElementCount).toBe(0)
  })

  it('resize dimensiona o backing store pelo DPR e o CSS pelo tamanho lógico', () => {
    const renderer = mountRenderer()
    renderer.resize(200, 100, 2)
    const canvas = container.firstElementChild as HTMLCanvasElement
    expect(canvas.width).toBe(400)
    expect(canvas.height).toBe(200)
    expect(canvas.style.width).toBe('200px')
    expect(canvas.style.height).toBe('100px')
  })

  it('continua nítido em DPR 1 e 3 e ignora DPR inválido', () => {
    const renderer = mountRenderer()
    const canvas = container.firstElementChild as HTMLCanvasElement
    renderer.resize(100, 50, 1)
    expect(canvas.width).toBe(100)
    renderer.resize(100, 50, 3)
    expect(canvas.width).toBe(300)
    renderer.resize(100, 50, 0)
    expect(canvas.width).toBe(100) // DPR 0 cai para 1
  })

  it('ResizeObserver observa o container e redimensiona quando ele muda', () => {
    const driver = makeResizeObserverDriver()
    const renderer = mountRenderer({ ResizeObserver: driver.ctor })
    expect(driver.instances).toHaveLength(1)
    expect(driver.instances[0]?.observe).toHaveBeenCalledWith(container)

    const canvas = container.firstElementChild as HTMLCanvasElement
    driver.instances[0]?.fire(320, 180)
    expect(canvas.width).toBe(320)
    expect(canvas.style.height).toBe('180px')
  })

  it('desconecta o ResizeObserver ao desmontar', () => {
    const driver = makeResizeObserverDriver()
    const renderer = mountRenderer({ ResizeObserver: driver.ctor })
    renderer.unmount()
    expect(driver.instances[0]?.disconnect).toHaveBeenCalled()
  })
})

describe('CanvasBoardRenderer — conversão célula↔pixel (cellAt)', () => {
  let container: HTMLElement
  let restoreCanvas: () => void

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    restoreCanvas = installCanvas2DMock().restore
  })

  afterEach(() => {
    restoreCanvas()
    container.remove()
  })

  function readyRenderer(width: number, height: number, dpr = 1) {
    const renderer = new CanvasBoardRenderer()
    renderer.mount(container)
    renderer.resize(width, height, dpr)
    renderer.render(makeFrame()) // grid 3×1
    return renderer
  }

  it('converte px do container em célula do grid 3×1 (célula 100px)', () => {
    const renderer = readyRenderer(300, 100)
    expect(renderer.cellAt(10, 10)).toEqual({ x: 0, y: 0 })
    expect(renderer.cellAt(150, 50)).toEqual({ x: 1, y: 0 })
    expect(renderer.cellAt(299, 99)).toEqual({ x: 2, y: 0 })
  })

  it('devolve null fora do grid (excesso centralizado e bordas)', () => {
    const renderer = readyRenderer(400, 100) // sobra 100px na horizontal
    expect(renderer.cellAt(10, 50)).toBeNull() // excesso à esquerda
    expect(renderer.cellAt(360, 50)).toBeNull() // excesso à direita (borda em 350)
    expect(renderer.cellAt(200, 101)).toBeNull() // abaixo do grid
    expect(renderer.cellAt(310, 50)).toEqual({ x: 2, y: 0 }) // dentro do grid
  })

  it('é independente do DPR — hit-test em px CSS', () => {
    const crisp = readyRenderer(300, 100, 3)
    expect(crisp.cellAt(250, 50)).toEqual({ x: 2, y: 0 })
  })

  it('devolve null antes de qualquer resize/render (sem layout)', () => {
    const renderer = new CanvasBoardRenderer()
    renderer.mount(container)
    expect(renderer.cellAt(10, 10)).toBeNull()
  })
})

describe('CanvasBoardRenderer — repintura sob demanda (dirty flag)', () => {
  let container: HTMLElement
  let ctx: FakeContext
  let restoreCanvas: () => void

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    const mock = installCanvas2DMock()
    ctx = mock.ctx
    restoreCanvas = mock.restore
  })

  afterEach(() => {
    restoreCanvas()
    container.remove()
  })

  it('não repinta quando o mesmo frame é renderizado de novo', () => {
    const renderer = new CanvasBoardRenderer({ matchMedia: makeMatchMedia(true) })
    renderer.mount(container)
    renderer.resize(300, 100, 1)
    renderer.render(makeInertFrame()) // sem fio → sem animação, repintura síncrona
    const before = paintCount(ctx)
    renderer.render(makeInertFrame()) // mesmo conteúdo e overlay
    expect(paintCount(ctx)).toBe(before)
  })

  it('repinta quando só a seleção muda (overlay), sem reanimar', () => {
    const raf = makeRafDriver()
    const renderer = new CanvasBoardRenderer({
      requestAnimationFrame: raf.requestAnimationFrame,
      cancelAnimationFrame: raf.cancelAnimationFrame,
      matchMedia: makeMatchMedia(true), // corte seco: nada anima
    })
    renderer.mount(container)
    renderer.resize(300, 100, 1)
    renderer.render(makeFrame())
    const before = paintCount(ctx)
    renderer.render(makeFrame({ selected: { x: 1, y: 0 } }))
    expect(paintCount(ctx)).toBe(before + 1)
    expect(raf.pending()).toBe(0)
  })

  it('repinta e re-simula quando o conteúdo do tabuleiro muda', () => {
    const renderer = new CanvasBoardRenderer({ matchMedia: makeMatchMedia(true) })
    renderer.mount(container)
    renderer.resize(300, 100, 1)
    renderer.render(makeInertFrame())
    const before = paintCount(ctx)
    renderer.render(makeFrame()) // coloca o fio → novo estado elétrico
    expect(paintCount(ctx)).toBeGreaterThan(before)
  })
})

describe('CanvasBoardRenderer — prefers-reduced-motion (corte seco)', () => {
  let container: HTMLElement
  let ctx: FakeContext
  let restoreCanvas: () => void

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    const mock = installCanvas2DMock()
    ctx = mock.ctx
    restoreCanvas = mock.restore
  })

  afterEach(() => {
    restoreCanvas()
    container.remove()
  })

  function rendererWith(matches: boolean) {
    const raf = makeRafDriver()
    const renderer = new CanvasBoardRenderer({
      requestAnimationFrame: raf.requestAnimationFrame,
      cancelAnimationFrame: raf.cancelAnimationFrame,
      matchMedia: makeMatchMedia(matches),
    })
    renderer.mount(container)
    renderer.resize(300, 100, 1)
    return { renderer, raf }
  }

  it('com reduce ligado, o frame com traço é pintado direto no estado final — nenhum rAF', () => {
    const { renderer, raf } = rendererWith(true)
    renderer.render(makeFrame()) // fonte→fio→sink: traço existe
    expect(raf.pending()).toBe(0)
    expect(paintCount(ctx)).toBe(1)
  })

  it('sem reduce, o mesmo frame agenda a animação e pinta frame a frame', () => {
    const { renderer, raf } = rendererWith(false)
    renderer.render(makeFrame())
    expect(raf.pending()).toBe(1) // primeiro frame agendado
    expect(paintCount(ctx)).toBe(0) // pintura estática suprimida: animação assume

    raf.step(0) // primeiro tick ancora o relógio
    expect(paintCount(ctx)).toBe(1)
    raf.step(TOTAL + 1) // ultrapassa a duração total
    expect(raf.pending()).toBe(0) // terminou: nenhum frame pendente
    expect(paintCount(ctx)).toBe(2) // último frame estático do estado final
  })

  it('respeita a preferência vinda de window.matchMedia (default do renderer)', () => {
    const raf = makeRafDriver()
    const matchMedia = vi.fn(makeMatchMedia(true))
    vi.stubGlobal('matchMedia', matchMedia)
    const renderer = new CanvasBoardRenderer({
      requestAnimationFrame: raf.requestAnimationFrame,
      cancelAnimationFrame: raf.cancelAnimationFrame,
    })
    renderer.mount(container)
    renderer.resize(300, 100, 1)
    renderer.render(makeFrame())
    expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)')
    expect(raf.pending()).toBe(0)
    vi.unstubAllGlobals()
  })

  it('interrompe a animação em voo se a preferência mudar para reduce', () => {
    let matches = false
    const raf = makeRafDriver()
    const renderer = new CanvasBoardRenderer({
      requestAnimationFrame: raf.requestAnimationFrame,
      cancelAnimationFrame: raf.cancelAnimationFrame,
      matchMedia: () => ({ matches }),
    })
    renderer.mount(container)
    renderer.resize(300, 100, 1)
    renderer.render(makeFrame())
    expect(raf.pending()).toBe(1)
    raf.step(0)
    expect(raf.pending()).toBe(1)
    matches = true
    raf.step(100)
    expect(raf.pending()).toBe(0)
    expect(paintCount(ctx)).toBeGreaterThanOrEqual(2) // final estático pintado
  })
})

describe('CanvasBoardRenderer — diagnósticos e seleção no overlay', () => {
  let container: HTMLElement
  let ctx: FakeContext
  let restoreCanvas: () => void

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    const mock = installCanvas2DMock()
    ctx = mock.ctx
    restoreCanvas = mock.restore
  })

  afterEach(() => {
    restoreCanvas()
    container.remove()
  })

  it('desenha o overlay com as células dos issues do frame', () => {
    const renderer = new CanvasBoardRenderer({ matchMedia: makeMatchMedia(true) })
    renderer.mount(container)
    renderer.resize(300, 100, 1)
    renderer.render(
      makeFrame({
        board: { levelId: 'test-level', placedCells: [] },
        issues: [makeIssue('floating', [1, 0]), makeIssue('floating', [2, 0])],
      }),
    )
    const strokes = (ctx.calls.stroke ?? []).length
    const fills = (ctx.calls.fill ?? []).length
    // Células diagnosticadas: um fill translúcido + um anel (stroke) cada.
    expect(strokes).toBeGreaterThanOrEqual(2)
    expect(fills).toBeGreaterThanOrEqual(2)
  })

  it('aceita todos os kinds de IssueKind sem quebrar a pintura', () => {
    const renderer = new CanvasBoardRenderer({ matchMedia: makeMatchMedia(true) })
    renderer.mount(container)
    renderer.resize(300, 100, 1)
    const frame = makeFrame({
      board: { levelId: 'test-level', placedCells: [] },
      issues: [
        makeIssue('short', [0, 0]),
        makeIssue('cycle', [1, 0]),
        makeIssue('floating', [2, 0]),
      ],
    })
    expect(() => renderer.render(frame)).not.toThrow()
  })
})
