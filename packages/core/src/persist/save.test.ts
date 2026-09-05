// Testes da persistência versionada (MI-06): round-trip, migração, recuperação
// de save corrompido e merge de melhor resultado — tudo sobre storage em
// memória (sem depender de localStorage).

import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  SAVE_SCHEMA_VERSION,
  SaveStore,
  emptySave,
  type SaveData,
  type StorageLike,
} from './index'

/** Storage em memória (aceite da MI-06: testes sem localStorage real). */
class MemoryStorage implements StorageLike {
  private readonly map = new Map<string, string>()

  getItem(key: string): string | null {
    return this.map.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value)
  }

  removeItem(key: string): void {
    this.map.delete(key)
  }

  dump(): string {
    return this.map.get('circuit-router-save') ?? ''
  }
}

function seed(storage: MemoryStorage, data: unknown): void {
  storage.setItem('circuit-router-save', JSON.stringify(data))
}

describe('SaveStore: round-trip (MI-06)', () => {
  it('save padrão começa vazio e com a versão atual', () => {
    const store = new SaveStore(new MemoryStorage())
    expect(store.data.schemaVersion).toBe(SAVE_SCHEMA_VERSION)
    expect(store.data.levels).toEqual({})
    expect(store.data.settings).toEqual(DEFAULT_SETTINGS)
    expect(store.recoveredFromCorruption).toBe(false)
  })

  it('round-trip salvar/carregar preserva tudo', () => {
    const storage = new MemoryStorage()
    const store = new SaveStore(storage)
    store.recordLevelResult('pack-1-01', { stars: 2, pieces: 5, gates: 1 })
    store.updateSettings({ muted: true, theme: 'dark' })
    store.saveDraft('sandbox-1', { label: 'meu circuito', levelSpec: { grid: 2 }, boardState: [] })

    // Novo store sobre o mesmo storage: tudo preservado.
    const reloaded = new SaveStore(storage)
    expect(reloaded.levelProgress('pack-1-01')?.stars).toBe(2)
    expect(reloaded.levelProgress('pack-1-01')?.bestPieces).toBe(5)
    expect(reloaded.settings.muted).toBe(true)
    expect(reloaded.settings.theme).toBe('dark')
    expect(reloaded.draft('sandbox-1')?.label).toBe('meu circuito')
    expect(reloaded.data.schemaVersion).toBe(SAVE_SCHEMA_VERSION)
  })

  it('recordLevelResult faz merge com o melhor anterior', () => {
    const storage = new MemoryStorage()
    const store = new SaveStore(storage)
    store.recordLevelResult('lvl', { stars: 1, pieces: 10, gates: 4 })
    store.recordLevelResult('lvl', { stars: 2, pieces: 7, gates: 3 })
    store.recordLevelResult('lvl', { stars: 2, pieces: 9, gates: 4, withHint: true })
    const progress = store.levelProgress('lvl')
    expect(progress?.stars).toBe(2)
    expect(progress?.bestPieces).toBe(7)
    expect(progress?.bestGates).toBe(3)
    expect(progress?.completedWithHint).toBe(true)
  })

  it('rascunho é sobrescrito, deletado e listado corretamente', () => {
    const storage = new MemoryStorage()
    const store = new SaveStore(storage)
    store.saveDraft('a', { label: 'v1', levelSpec: 1, boardState: 1 })
    store.saveDraft('a', { label: 'v2', levelSpec: 2, boardState: 2 })
    expect(store.draft('a')?.label).toBe('v2')
    expect(store.deleteDraft('a')).toBe(true)
    expect(store.deleteDraft('a')).toBe(false)
    expect(store.draft('a')).toBeUndefined()
  })

  it('reset limpa o storage e volta ao padrão', () => {
    const storage = new MemoryStorage()
    const store = new SaveStore(storage)
    store.recordLevelResult('x', { stars: 3 })
    store.reset()
    expect(store.data.levels).toEqual({})
    expect(storage.getItem('circuit-router-save')).toBeNull()
  })
})

describe('SaveStore: robustez (MI-06)', () => {
  it('JSON malformado -> save padrão, sem lançar', () => {
    const storage = new MemoryStorage()
    storage.setItem('circuit-router-save', '{oops! isto não é json')
    const store = new SaveStore(storage)
    expect(store.data.levels).toEqual({})
    expect(store.data.schemaVersion).toBe(SAVE_SCHEMA_VERSION)
    expect(store.recoveredFromCorruption).toBe(true)
  })

  it('save de versão futura desconhecida -> padrão, sem lançar', () => {
    const storage = new MemoryStorage()
    seed(storage, { schemaVersion: 99, levels: { a: { stars: 3 } } })
    const store = new SaveStore(storage)
    expect(store.data.levels).toEqual({})
    expect(store.recoveredFromCorruption).toBe(true)
  })

  it('entradas inválidas dentro de um save válido são descartadas, não quebram', () => {
    const storage = new MemoryStorage()
    seed(storage, {
      schemaVersion: SAVE_SCHEMA_VERSION,
      levels: {
        ok: { stars: 2 },
        estrelaInvalida: { stars: 7 },
        naoObjeto: 'x',
      },
      settings: { muted: 'sim', theme: 'neon', haptics: true, reducedMotion: false },
      sandboxDrafts: {},
    })
    const store = new SaveStore(storage)
    expect(store.levelProgress('ok')?.stars).toBe(2)
    expect(store.levelProgress('estrelaInvalida')).toBeUndefined()
    expect(store.settings.muted).toBe(false) // inválido -> default
    expect(store.settings.theme).toBe('auto')
    expect(store.recoveredFromCorruption).toBe(false)
  })

  it('storage que lança em getItem não derruba o store', () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error('quota')
      },
      setItem: () => undefined,
      removeItem: () => undefined,
    }
    const store = new SaveStore(broken)
    expect(store.data).toEqual(emptySave())
  })
})

describe('SaveStore: migrações (MI-06)', () => {
  it('save da versão 0 é migrado para a versão atual preservando estrelas', () => {
    const storage = new MemoryStorage()
    seed(storage, {
      schemaVersion: 0,
      starsByLevel: { 'pack-1': { stars: 1 }, 'pack-2': { stars: 3 } },
      settings: { muted: true, theme: 'light', haptics: false, reducedMotion: true },
    })
    const store = new SaveStore(storage)
    expect(store.data.schemaVersion).toBe(SAVE_SCHEMA_VERSION)
    expect(store.levelProgress('pack-1')?.stars).toBe(1)
    expect(store.levelProgress('pack-2')?.stars).toBe(3)
    expect(store.settings.muted).toBe(true)
    expect(store.settings.theme).toBe('light')
    expect(store.settings.haptics).toBe(false)
    expect(store.recoveredFromCorruption).toBe(false)

    // A migração persiste o resultado (nova escrita já na versão atual).
    expect(storage.dump()).toContain(`"schemaVersion":${SAVE_SCHEMA_VERSION}`)
  })
})
