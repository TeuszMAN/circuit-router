/**
 * Estado da aplicação em signals (MI-10). Uma instância por app: telas leem
 * os signals e re-renderizam sozinhas. Persistência delegada ao
 * `SaveStore` do core (@circuit/core/persist, MI-06) — a UI nunca reimplementa
 * migração/recuperação de save (SDD §10).
 */
import { signal, type Signal } from '@preact/signals'
import {
  SaveStore,
  type LevelProgress,
  type LevelResultInput,
  type SaveSettings,
  type StorageLike,
} from '@circuit/core/persist'

export type ThemeSetting = 'light' | 'dark' | 'auto'

/** Roteamento simples por signals: uma rota corrente + pilha de voltar. */
export type Route =
  | { readonly name: 'menu' }
  | { readonly name: 'levels' }
  | { readonly name: 'game'; readonly levelId: string }
  | { readonly name: 'settings' }

export interface AppState {
  readonly route: Signal<Route>
  navigate(next: Route): void
  /** Volta para a rota anterior (pilha). Sem pilha, volta ao menu. */
  back(): void
  /** Troca de tela descartando o histórico (ex.: sair da fase). */
  reset(next: Route): void

  readonly progress: Signal<Readonly<Record<string, LevelProgress>>>
  readonly muted: Signal<boolean>
  readonly theme: Signal<ThemeSetting>
  readonly haptics: Signal<boolean>
  readonly reducedMotion: Signal<boolean>

  setSettings(patch: Partial<SaveSettings>): void
  recordResult(levelId: string, result: LevelResultInput): void
  progressFor(levelId: string): LevelProgress | undefined
}

/** Storage em memória (testes e render fora do navegador). */
export function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>()
  return {
    getItem(key) {
      return map.get(key) ?? null
    },
    setItem(key, value) {
      map.set(key, value)
    },
    removeItem(key) {
      map.delete(key)
    },
  }
}

export function createAppState(storage?: StorageLike): AppState {
  const save = new SaveStore(storage ?? createMemoryStorage())

  const route = signal<Route>({ name: 'menu' })
  const backStack: Route[] = []

  const progress = signal<Readonly<Record<string, LevelProgress>>>(save.data.levels)
  const muted = signal(save.settings.muted)
  const theme = signal<ThemeSetting>(save.settings.theme)
  const haptics = signal(save.settings.haptics)
  const reducedMotion = signal(save.settings.reducedMotion)

  return {
    route,
    navigate(next) {
      backStack.push(route.value)
      route.value = next
    },
    back() {
      const previous = backStack.pop()
      route.value = previous ?? { name: 'menu' }
    },
    reset(next) {
      backStack.length = 0
      route.value = next
    },

    progress,
    muted,
    theme,
    haptics,
    reducedMotion,

    setSettings(patch) {
      const updated = save.updateSettings(patch)
      muted.value = updated.muted
      theme.value = updated.theme
      haptics.value = updated.haptics
      reducedMotion.value = updated.reducedMotion
    },

    recordResult(levelId, result) {
      save.recordLevelResult(levelId, result)
      const stored = save.levelProgress(levelId)
      if (stored === undefined) return
      progress.value = { ...progress.value, [levelId]: stored }
    },

    progressFor(levelId) {
      return progress.value[levelId]
    },
  }
}

/** Guard: aplica tema/movimento resolvidos no <html> (efeito do shell). */
export function resolveTheme(
  themeSetting: ThemeSetting,
  prefersDark: boolean,
): 'light' | 'dark' {
  if (themeSetting === 'auto') return prefersDark ? 'dark' : 'light'
  return themeSetting
}
