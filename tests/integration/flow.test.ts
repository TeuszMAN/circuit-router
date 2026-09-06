// Testes de integração (MI-16): fluxo completo carregar → editar → simular →
// vencer → persistir → avançar; round-trip de save. Usa storage em memória
// (sem localStorage real), seguindo o padrão dos testes de persist (MI-06).
// Sem dependência de DOM ou Preact — environment: node.

import { describe, expect, test, beforeEach } from 'vitest'
import type { LevelSpec, BoardState, PlacedCell } from '@circuit/core/model'
import { LevelEditor } from '@circuit/core/state'
import { simulate } from '@circuit/core/sim'
import { SaveStore } from '@circuit/core/persist'
import type { StorageLike } from '@circuit/core/persist'
import { PACKS } from '@circuit/content/packs'

// ---------------------------------------------------------------------------
// Storage em memória (mesma abordagem de packages/core/src/persist/save.test.ts)
// ---------------------------------------------------------------------------

function makeMemoryStorage(): StorageLike {
  const store = new Map<string, string>()
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value) },
    removeItem: (key: string) => { store.delete(key) },
  }
}

// ---------------------------------------------------------------------------
// Helpers: calcular estrelas
// ---------------------------------------------------------------------------

function computeStars(
  level: LevelSpec,
  board: BoardState,
): 0 | 1 | 2 | 3 {
  const result = simulate(level, board)
  if (!result.ok) return 0
  const pieces = board.placedCells.length
  const gates = board.placedCells.filter(p => p.cell.kind === 'gate').length
  // ★1 = resolver; ★2 = resolver com ≤ maxPieces peças; ★3 = resolver com ≤ maxGates portas
  // Stars are cumulative: 3 requires all conditions to be met simultaneously
  if (gates <= level.starThresholds.maxGates && pieces <= level.starThresholds.maxPieces) return 3
  if (pieces <= level.starThresholds.maxPieces) return 2
  return 1
}

// ---------------------------------------------------------------------------
// Fase p1-1 como referência de fluxo básico
// ---------------------------------------------------------------------------

describe('fluxo completo: carregar → editar → simular → vencer → persistir → avançar', () => {
  // Campanha completa (packs 1-6)
  const ALL_LEVELS = PACKS.flatMap(p => p.levels)

  test('campanha carregada: 6 packs, 24 fases', () => {
    expect(PACKS).toHaveLength(6)
    expect(ALL_LEVELS).toHaveLength(24)
  })

  test('p1-1: carregar fase', () => {
    const level = ALL_LEVELS.find(l => l.id === 'p1-1')
    expect(level).toBeDefined()
    expect(level!.id).toBe('p1-1')
    expect(level!.grid.width).toBeGreaterThan(0)
    expect(level!.fixedCells.length).toBeGreaterThan(0)
  })

  test('p1-1: editar (colocar fio) via LevelEditor', () => {
    const level = ALL_LEVELS.find(l => l.id === 'p1-1')!
    const editor = new LevelEditor(level)

    // Tabuleiro vazio inicialmente
    expect(editor.board.placedCells).toHaveLength(0)

    // Coloca um fio na única célula livre (x:1, y:0) — p1-1 é 3×1
    const placed = editor.placeWire(1, 0, ['W', 'E'])
    expect(placed).toBe(true)
    expect(editor.board.placedCells).toHaveLength(1)
    expect(editor.board.placedCells[0]!.coord).toEqual({ x: 1, y: 0 })
  })

  test('p1-1: simular → ok = true (vencer)', () => {
    const level = ALL_LEVELS.find(l => l.id === 'p1-1')!
    const editor = new LevelEditor(level)
    editor.placeWire(1, 0, ['W', 'E'])

    const result = simulate(level, editor.board)
    expect(result.ok).toBe(true)
    expect(result.sinks.every(s => s.satisfied)).toBe(true)
    expect(result.issues).toHaveLength(0)
  })

  test('p1-1: persistir progresso (SaveStore em memória)', () => {
    const level = ALL_LEVELS.find(l => l.id === 'p1-1')!
    const editor = new LevelEditor(level)
    editor.placeWire(1, 0, ['W', 'E'])

    const result = simulate(level, editor.board)
    expect(result.ok).toBe(true)

    const storage = makeMemoryStorage()
    const store = new SaveStore(storage)

    // Antes de salvar: sem progresso
    expect(store.levelProgress(level.id)).toBeUndefined()

    // Calcula estrelas e salva
    const stars = computeStars(level, editor.board)
    expect(stars).toBeGreaterThanOrEqual(1)
    const progress = store.recordLevelResult(level.id, {
      stars,
      pieces: editor.board.placedCells.length,
    })

    // Progresso registrado corretamente
    expect(progress.stars).toBe(stars)
    expect(progress.bestPieces).toBe(editor.board.placedCells.length)
    expect(store.levelProgress(level.id)?.stars).toBe(stars)
  })

  test('p1-1 → p1-2: avançar para a próxima fase', () => {
    // Simula fluxo de progressão: vencer p1-1 e avançar para p1-2
    const pack1 = PACKS[0]!
    expect(pack1.levels).toHaveLength(3)

    const [p1_1, p1_2] = pack1.levels
    expect(p1_1!.id).toBe('p1-1')
    expect(p1_2!.id).toBe('p1-2')

    // Vence p1-1
    const editor1 = new LevelEditor(p1_1!)
    editor1.placeWire(1, 0, ['W', 'E'])
    const result1 = simulate(p1_1!, editor1.board)
    expect(result1.ok).toBe(true)

    // Carrega p1-2 — pode criar um editor novo para ela
    const editor2 = new LevelEditor(p1_2!)
    expect(editor2.board.levelId).toBe('p1-2')
    expect(editor2.board.placedCells).toHaveLength(0) // tabuleiro limpo
  })

  test('fluxo: undo/redo funcionando durante edição', () => {
    const level = ALL_LEVELS.find(l => l.id === 'p1-1')!
    const editor = new LevelEditor(level)

    // Coloca um fio
    editor.placeWire(1, 0, ['W', 'E'])
    expect(editor.board.placedCells).toHaveLength(1)

    // Desfaz
    const undone = editor.undo()
    expect(undone).toBe(true)
    expect(editor.board.placedCells).toHaveLength(0)

    // Refaz
    const redone = editor.redo()
    expect(redone).toBe(true)
    expect(editor.board.placedCells).toHaveLength(1)
  })

  test('fluxo: simular circuito incorreto retorna ok=false sem lançar', () => {
    const level = ALL_LEVELS.find(l => l.id === 'p1-1')!
    // Sem peças → sink não alimentado → floating/insatisfeito, mas sem throw
    const emptyBoard: BoardState = { levelId: level.id, placedCells: [] }
    const result = simulate(level, emptyBoard)
    expect(result.ok).toBe(false)
    // Pelo menos um sink insatisfeito
    expect(result.sinks.some(s => !s.satisfied)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Round-trip de save: salvar → carregar preserva progresso e estrelas
// ---------------------------------------------------------------------------

describe('round-trip de save (salvar → carregar preserva progresso/estrelas)', () => {
  const ALL_LEVELS = PACKS.flatMap(p => p.levels)

  test('save de uma fase é persistido e recuperado em nova instância de SaveStore', () => {
    const level = ALL_LEVELS.find(l => l.id === 'p1-1')!
    const storage = makeMemoryStorage()

    // Primeira instância: registra resultado
    const store1 = new SaveStore(storage)
    store1.recordLevelResult(level.id, { stars: 3, pieces: 1, gates: 0 })
    expect(store1.levelProgress(level.id)?.stars).toBe(3)

    // Segunda instância sobre o mesmo storage: deve recuperar o progresso
    const store2 = new SaveStore(storage)
    const progress = store2.levelProgress(level.id)
    expect(progress).toBeDefined()
    expect(progress!.stars).toBe(3)
    expect(progress!.bestPieces).toBe(1)
  })

  test('save de múltiplas fases preserva todas', () => {
    const storage = makeMemoryStorage()
    const store1 = new SaveStore(storage)

    // Registra progresso em 3 fases diferentes
    store1.recordLevelResult('p1-1', { stars: 3, pieces: 1 })
    store1.recordLevelResult('p1-2', { stars: 2, pieces: 2 })
    store1.recordLevelResult('p2-1', { stars: 1, pieces: 3 })

    // Nova instância recupera todas
    const store2 = new SaveStore(storage)
    expect(store2.levelProgress('p1-1')?.stars).toBe(3)
    expect(store2.levelProgress('p1-2')?.stars).toBe(2)
    expect(store2.levelProgress('p2-1')?.stars).toBe(1)
  })

  test('refazer uma fase melhora o resultado mas nunca piora', () => {
    const storage = makeMemoryStorage()
    const store = new SaveStore(storage)

    // Primeiro resultado: 2 estrelas com 3 peças
    store.recordLevelResult('p1-1', { stars: 2, pieces: 3 })
    expect(store.levelProgress('p1-1')?.stars).toBe(2)
    expect(store.levelProgress('p1-1')?.bestPieces).toBe(3)

    // Segundo resultado pior (1 estrela, mais peças) — não deve piorar o salvo
    store.recordLevelResult('p1-1', { stars: 1, pieces: 5 })
    const progress = store.levelProgress('p1-1')!
    expect(progress.stars).toBe(2)    // mantém o melhor
    expect(progress.bestPieces).toBe(3) // mantém o menor

    // Terceiro resultado melhor (3 estrelas, 1 peça) — deve melhorar
    store.recordLevelResult('p1-1', { stars: 3, pieces: 1 })
    const best = store.levelProgress('p1-1')!
    expect(best.stars).toBe(3)
    expect(best.bestPieces).toBe(1)
  })

  test('save corrompido não lança e retorna padrão (sem progresso)', () => {
    const storage = makeMemoryStorage()
    // Injeta JSON inválido no storage
    storage.setItem('circuit-router-save', '{invalid json{{{}')
    const store = new SaveStore(storage)
    expect(store.recoveredFromCorruption).toBe(true)
    expect(store.data.levels).toEqual({})
  })

  test('settings são persistidos e recuperados', () => {
    const storage = makeMemoryStorage()
    const store1 = new SaveStore(storage)
    store1.updateSettings({ muted: true, theme: 'dark' })

    const store2 = new SaveStore(storage)
    expect(store2.settings.muted).toBe(true)
    expect(store2.settings.theme).toBe('dark')
    expect(store2.settings.haptics).toBe(true) // default mantido
  })
})

// ---------------------------------------------------------------------------
// Fluxo de uma fase com portas (p2-1 — Pack 2: NOT)
// ---------------------------------------------------------------------------

describe('fluxo completo com porta NOT (p2-1)', () => {
  const ALL_LEVELS = PACKS.flatMap(p => p.levels)

  test('p2-1: simular a solução correta → ok = true', () => {
    const level = ALL_LEVELS.find(l => l.id === 'p2-1')!
    expect(level).toBeDefined()

    // A fase p2-1 tem 1 NOT fixo e requer fios para conectar fonte → NOT → sink.
    // Usar o solver para obter a solução e validar a simulação
    // (sem importar solveLevel diretamente, use simulate com board do solver)
    // Para manter a fronteira limpa, monta a solução via LevelEditor
    const editor = new LevelEditor(level)

    // p2-1 tem grid 4×1: source(0,0) → NOT(2,0) → sink(3,0)
    // Fio necessário: (1,0) — única célula livre
    editor.placeWire(1, 0, ['W', 'E'])

    const result = simulate(level, editor.board)
    expect(result.ok).toBe(true)
    expect(result.sinks.every(s => s.satisfied)).toBe(true)
  })

  test('p2-1: persistir progresso após vitória', () => {
    const level = ALL_LEVELS.find(l => l.id === 'p2-1')!
    const editor = new LevelEditor(level)
    // p2-1 tem grid 4×1: source(0,0) → NOT(2,0) → sink(3,0)
    // Fio necessário: (1,0) — única célula livre
    editor.placeWire(1, 0, ['W', 'E'])

    const result = simulate(level, editor.board)
    expect(result.ok).toBe(true)

    const storage = makeMemoryStorage()
    const store = new SaveStore(storage)
    const pieces = editor.board.placedCells.length
    const stars = computeStars(level, editor.board)

    const progress = store.recordLevelResult(level.id, { stars, pieces })
    expect(progress.stars).toBeGreaterThanOrEqual(1)
    expect(progress.bestPieces).toBe(pieces)
  })
})

// ---------------------------------------------------------------------------
// Diagnósticos corretos para circuitos com erros
// ---------------------------------------------------------------------------

describe('diagnósticos de simulação (erros pedagógicos)', () => {
  const ALL_LEVELS = PACKS.flatMap(p => p.levels)

  test('p5-2: tentativa natural com dois drivers na mesma net → curto-circuito (short)', () => {
    const level = ALL_LEVELS.find(l => l.id === 'p5-2')!
    expect(level).toBeDefined()

    // Solução ingênua que funde dois sinais opostos (1 e 0) na mesma net
    const naturalShort: PlacedCell[] = [
      { coord: { x: 1, y: 0 }, cell: { kind: 'wire', sides: ['W', 'S'] } },
      { coord: { x: 1, y: 2 }, cell: { kind: 'wire', sides: ['W', 'N'] } },
      { coord: { x: 1, y: 1 }, cell: { kind: 'wire', sides: ['N', 'S', 'E'] } },
      { coord: { x: 2, y: 1 }, cell: { kind: 'wire', sides: ['W', 'E'] } },
      { coord: { x: 3, y: 1 }, cell: { kind: 'wire', sides: ['W', 'E'] } },
    ]

    const board: BoardState = { levelId: level.id, placedCells: naturalShort }
    const result = simulate(level, board)
    expect(result.ok).toBe(false)
    expect(result.issues.some(i => i.kind === 'short')).toBe(true)
  })

  test('p5-3: realimentação do NOT → ciclo combinacional (cycle, não short)', () => {
    const level = ALL_LEVELS.find(l => l.id === 'p5-3')!
    expect(level).toBeDefined()

    // Laço que fecha a saída do NOT de volta para sua entrada
    const feedbackCycle: PlacedCell[] = [
      { coord: { x: 3, y: 1 }, cell: { kind: 'wire', sides: ['W', 'N', 'E'] } },
      { coord: { x: 3, y: 0 }, cell: { kind: 'wire', sides: ['S', 'W'] } },
      { coord: { x: 2, y: 0 }, cell: { kind: 'wire', sides: ['E', 'W'] } },
      { coord: { x: 1, y: 0 }, cell: { kind: 'wire', sides: ['E', 'S'] } },
      { coord: { x: 1, y: 1 }, cell: { kind: 'wire', sides: ['N', 'E'] } },
    ]

    const board: BoardState = { levelId: level.id, placedCells: feedbackCycle }
    const result = simulate(level, board)
    expect(result.ok).toBe(false)
    expect(result.issues.some(i => i.kind === 'cycle')).toBe(true)
    // Certifica que NÃO é reportado como curto (distinção formal SDD §4.5)
    expect(result.issues.some(i => i.kind === 'short')).toBe(false)
  })
})
