import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/preact'
import type { Coord, LevelSpec } from '@circuit/core/model'
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

describe('jogabilidade pela composição real (ponteiro → editor → simulação → UI)', () => {
  it('fase 1: entra pelo menu, corrige falha, monta em etapas, desfaz/refaz, vence, persiste e avança', async () => {
    const level = levels[0]!
    const { state, storage } = await mount(level, true)
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
