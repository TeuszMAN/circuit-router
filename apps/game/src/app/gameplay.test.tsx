import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/preact'
import type { Coord, Direction, LevelSpec, PlacedCell } from '@circuit/core/model'
import { solveLevel } from '@circuit/core/gen'
import { PACKS } from '@circuit/content/packs'
import { AppShell } from '../ui/app-shell'
import { createAppState, createMemoryStorage } from '../ui/state'
import { createCampaign } from './content'
import { CanvasBoardRenderer } from '../board'
import { computeBoardLayout, cellRect } from '../board/geometry'
import { installCanvas2DMock, makeResizeObserverDriver } from '../board/renderer-test-helpers'

const levels = PACKS.flatMap(pack => pack.levels)
const campaign = createCampaign()
let restoreCanvas: () => void
let observer: ReturnType<typeof makeResizeObserverDriver>
let renderSpy: MockInstance<CanvasBoardRenderer['render']>

beforeEach(() => {
  restoreCanvas = installCanvas2DMock().restore
  observer = makeResizeObserverDriver()
  vi.stubGlobal('ResizeObserver', observer.ctor)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0, y: 0, left: 0, top: 0, width: 500, height: 300, right: 500, bottom: 300,
    toJSON: () => ({}),
  })
  renderSpy = vi.spyOn(CanvasBoardRenderer.prototype, 'render')
})

afterEach(() => {
  cleanup()
  restoreCanvas()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function mount(level: LevelSpec, fromMenu = false) {
  const storage = createMemoryStorage()
  const state = createAppState(storage)
  if (!fromMenu) state.reset({ name: 'game', levelId: level.id })
  const customCampaign = { summaries: [{ id: level.id, name: level.name }], level: () => level }
  await act(async () => { render(<AppShell state={state} campaign={levels.includes(level) ? campaign : customCampaign} />) })
  if (fromMenu) {
    fireEvent.click(screen.getByRole('button', { name: 'Jogar' }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${level.name}`) })) })
  }
  await act(async () => { observer.instances.at(-1)?.fire(500, 300) })
  return { state, storage }
}

async function gesture(level: LevelSpec, path: readonly Coord[]) {
  const host = screen.getByTestId('board-slot')
  const layout = computeBoardLayout(500, 300, level.grid.width, level.grid.height)
  const point = (coord: Coord) => {
    const rect = cellRect(layout, coord.x, coord.y)
    return { clientX: rect.x + rect.w / 2, clientY: rect.y + rect.h / 2 }
  }
  await act(async () => {
    path.forEach((coord, index) => fireEvent(host, new PointerEvent(index === 0 ? 'pointerdown' : 'pointermove', {
      ...point(coord), pointerId: 1, pointerType: 'touch', bubbles: true,
    })))
    fireEvent(host, new PointerEvent('pointerup', {
      ...point(path[path.length - 1]!), pointerId: 1, pointerType: 'touch', bubbles: true,
    }))
  })
}

function board() { return renderSpy.mock.calls.at(-1)![0].board }

const wire = (x: number, y: number, sides: readonly Direction[]): PlacedCell => ({ coord: { x, y }, cell: { kind: 'wire', sides } })
// Referências manuais das três fases fora da topologia suportada pelo solver v1.
const manualSolutions: Record<string, readonly PlacedCell[]> = {
  'p5-2': [wire(1, 0, ['W', 'S']), wire(1, 1, ['N', 'E']), wire(2, 1, ['W', 'E']), wire(3, 1, ['W', 'E'])],
  'p5-3': [wire(1, 1, ['W', 'E']), wire(3, 1, ['W', 'E'])],
  'p6-3': [
    wire(3, 1, ['W', 'E']), wire(4, 1, ['W', 'S']), wire(3, 3, ['W', 'N', 'S']),
    wire(5, 2, ['W', 'N', 'S']), wire(5, 1, ['S', 'E']), wire(5, 3, ['N', 'E']),
    wire(7, 3, ['W', 'N', 'S']), wire(7, 4, ['N', 'S']), wire(3, 4, ['N', 'S']),
    wire(3, 5, ['N', 'E']), wire(4, 5, ['W', 'E']), wire(5, 5, ['W', 'E']), wire(6, 5, ['W', 'E']),
  ],
}

describe('campanha completa montada com eventos de ponteiro', () => {
  for (const level of levels) {
    it(`${level.id}: monta uma solução por gestos, vence e oferece saída`, async () => {
      const solution = manualSolutions[level.id] ?? solveLevel(level).board?.placedCells
      expect(solution).toBeDefined()
      const { state } = await mount(level)
      const steps: Record<Direction, Coord> = { N: { x: 0, y: -1 }, S: { x: 0, y: 1 }, E: { x: 1, y: 0 }, W: { x: -1, y: 0 } }
      const occupied = new Set([...level.fixedCells, ...solution!].filter(p => p.cell.kind !== 'empty').map(p => `${p.coord.x},${p.coord.y}`))
      const seenEdges = new Set<string>()
      for (const { coord, cell } of solution!) {
        if (cell.kind !== 'wire') throw new Error('A referência deve conter apenas fios')
        for (const side of cell.sides) {
          const delta = steps[side]
          const other = { x: coord.x + delta.x, y: coord.y + delta.y }
          if (!occupied.has(`${other.x},${other.y}`)) continue
          const edge = [`${coord.x},${coord.y}`, `${other.x},${other.y}`].sort().join('|')
          if (seenEdges.has(edge)) continue
          seenEdges.add(edge)
          // Não injeta BoardState: cada conexão atravessa input, composição e editor reais.
          await gesture(level, [coord, other])
        }
      }
      fireEvent.click(screen.getByRole('button', { name: 'Simular circuito' }))
      expect(await screen.findByText('Fase concluída!')).toBeTruthy()
      expect(state.progressFor(level.id)?.stars).toBe(3)
      const last = level === levels[levels.length - 1]
      expect(screen.getByRole('button', { name: last ? 'Voltar às fases' : 'Próxima fase' })).toBeTruthy()
    })
  }
})

describe('jogabilidade pela composição real (ponteiro → editor → simulação → UI)', () => {
  it('liga pinch e controles de zoom ao renderizador sem desenhar durante o gesto de dois dedos', async () => {
    const viewportSpy = vi.spyOn(CanvasBoardRenderer.prototype, 'setViewport')
    await mount(levels[0]!)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Aumentar zoom' })) })
    expect(viewportSpy).toHaveBeenLastCalledWith({ zoom: 1.5, pan: { x: 0, y: 0 } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Ajustar tabuleiro' })) })
    const host = screen.getByTestId('board-slot')
    await act(async () => {
      for (const [type, id, x] of [['pointerdown', 1, 200], ['pointerdown', 2, 300], ['pointermove', 2, 400], ['pointerup', 1, 200], ['pointerup', 2, 400]] as const) {
        fireEvent(host, new PointerEvent(type, { pointerId: id, clientX: x, clientY: 150, pointerType: 'touch', bubbles: true }))
      }
    })
    expect(viewportSpy).toHaveBeenLastCalledWith({ zoom: 2, pan: { x: 50, y: 0 } })
    expect(board().placedCells).toEqual([])
  })
  it('fase 1: entra pelo menu, corrige falha, monta em etapas, desfaz/refaz, vence, persiste e avança', async () => {
    const level = levels[0]!
    const { state, storage } = await mount(level, true)
    expect((screen.getByRole('button', { name: 'Ferramenta AND' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/Arraste da fonte até o destino/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Simular circuito' }))
    expect(await screen.findByText('O circuito ainda não fechou')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Continuar tentando' }))
    await gesture(level, [{ x: 0, y: 0 }, { x: 1, y: 0 }])
    await gesture(level, [{ x: 1, y: 0 }, { x: 2, y: 0 }])
    expect(board().placedCells).toHaveLength(1)
    expect(renderSpy.mock.calls.at(-1)![0].issues).toEqual([])
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Desfazer' })) })
    expect(board().placedCells[0]?.cell).toEqual({ kind: 'wire', sides: ['W'] })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Refazer' })) })
    fireEvent.click(screen.getByRole('button', { name: 'Simular circuito' }))
    expect(await screen.findByText('Fase concluída!')).toBeTruthy()
    expect(createAppState(storage).progressFor(level.id)?.stars).toBe(3)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Próxima fase' })) })
    expect(state.route.value).toEqual({ name: 'game', levelId: 'p1-2' })
    expect(board()).toEqual({ levelId: 'p1-2', placedCells: [] })
  })

  it('vence e avança mesmo sem AudioContext e com gravação recusada', async () => {
    const level = levels[0]!
    const { state, storage } = await mount(level)
    vi.spyOn(storage, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError') })
    await gesture(level, [{ x: 0, y: 0 }, { x: 2, y: 0 }])
    fireEvent.click(screen.getByRole('button', { name: 'Simular circuito' }))
    expect(await screen.findByText('Fase concluída!')).toBeTruthy()
    expect(screen.getByText(/O progresso está guardado só nesta sessão/)).toBeTruthy()
    expect(state.progressFor(level.id)?.stars).toBe(3)
    fireEvent.click(screen.getByRole('button', { name: 'Próxima fase' }))
    expect(state.route.value).toEqual({ name: 'game', levelId: 'p1-2' })
  })

  it('vence fan-out com dois arrastos compartilhando uma junção', async () => {
    const level = levels.find(l => l.id === 'p5-1')!
    await mount(level)
    await gesture(level, [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 3, y: 0 }, { x: 4, y: 0 }])
    await gesture(level, [{ x: 3, y: 1 }, { x: 3, y: 2 }, { x: 4, y: 2 }])
    fireEvent.click(screen.getByRole('button', { name: 'Simular circuito' }))
    expect(await screen.findByText('Fase concluída!')).toBeTruthy()
  })

  it('coloca, rotaciona, conecta e apaga uma porta selecionada sem perder a peça ao rotear', async () => {
    const level: LevelSpec = {
      ...levels[0]!, id: 'editable-not', grid: { width: 5, height: 1 },
      fixedCells: [
        { coord: { x: 0, y: 0 }, cell: { kind: 'source', value: 0, outputSide: 'E' } },
        { coord: { x: 4, y: 0 }, cell: { kind: 'sink', expected: 1, inputSide: 'W' } },
      ], inventory: { wires: null, gates: { NOT: 1 } },
    }
    await mount(level)
    fireEvent.click(screen.getByRole('button', { name: 'Ferramenta NOT' }))
    await gesture(level, [{ x: 2, y: 0 }])
    for (let i = 0; i < 4; i++) await gesture(level, [{ x: 2, y: 0 }])
    expect(board().placedCells[0]?.cell).toMatchObject({ kind: 'gate', outputSide: 'E' })
    fireEvent.click(screen.getByRole('button', { name: 'Ferramenta Fio' }))
    await gesture(level, [{ x: 0, y: 0 }, { x: 2, y: 0 }])
    await gesture(level, [{ x: 2, y: 0 }, { x: 4, y: 0 }])
    fireEvent.click(screen.getByRole('button', { name: 'Simular circuito' }))
    expect(await screen.findByText('Fase concluída!')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'Ferramenta Borracha' }))
    await gesture(level, [{ x: 2, y: 0 }])
    expect(board().placedCells.every(p => p.cell.kind === 'wire')).toBe(true)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Desfazer' })) })
    expect(board().placedCells.some(p => p.cell.kind === 'gate')).toBe(true)
  })
})
