/**
 * Shell da aplicação: aplica tema/movimento no <html>, resolve a rota em
 * signals e monta a tela corrente. Fronteira do shell (MI-10); o tabuleiro em
 * si entra via `GameScreen`/`GameServices` quando MI-08/09/15 existirem.
 */
import { useEffect } from 'preact/hooks'
import type { LevelSpec } from '@circuit/core/model'
import type { AppState } from './state'
import { resolveTheme } from './state'
import { bootstrapCampaign, type Campaign } from './campaign'
import { MainMenu } from './screens/main-menu'
import { LevelSelect } from './screens/level-select'
import { SettingsScreen } from './screens/settings'
import { GameScreen } from './screens/game'

import '../styles/tokens.css'
import '../styles/base.css'
import '../styles/app.css'
import '../styles/game.css'
import '../styles/modal.css'

export interface AppShellProps {
  readonly state: AppState
  /** Campanha (provisória = bootstrap; MI-07/17 trocam pelo conteúdo real). */
  readonly campaign?: Campaign
}

function prefersDarkScheme(): boolean {
  if (typeof window === 'undefined') return false
  if (typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function useSystemTheme(state: AppState): void {
  const theme = state.theme.value
  const reducedMotion = state.reducedMotion.value

  useEffect(() => {
    const root = document.documentElement
    const apply = () => {
      root.dataset.theme = resolveTheme(theme, prefersDarkScheme())
      root.dataset.motion = reducedMotion ? 'reduced' : 'full'
    }
    apply()

    if (theme !== 'auto') return
    let media: MediaQueryList | null = null
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      media = window.matchMedia('(prefers-color-scheme: dark)')
      const onChange = () => apply()
      media.addEventListener('change', onChange)
      return () => media?.removeEventListener('change', onChange)
    }
    return undefined
  }, [theme, reducedMotion])
}

export function AppShell({ state, campaign = bootstrapCampaign() }: AppShellProps) {
  useSystemTheme(state)

  const route = state.route.value

  switch (route.name) {
    case 'menu':
      return <MainMenu state={state} />

    case 'levels':
      return (
        <LevelSelect
          state={state}
          levels={campaign.summaries}
          onPick={levelId => state.navigate({ name: 'game', levelId })}
          onBack={() => state.back()}
        />
      )

    case 'game': {
      const summaries = campaign.summaries
      const spec = campaign.level(route.levelId) ?? firstSpec(campaign)
      const index = summaries.findIndex(entry => entry.id === route.levelId)
      const next = index >= 0 && index < summaries.length - 1 ? summaries[index + 1] : null
      return (
        <GameScreen
          key={spec.id}
          level={spec}
          state={state}
          nextLevelId={next?.id ?? null}
          onOpenNext={levelId => state.reset({ name: 'game', levelId })}
          onExit={() => state.reset({ name: 'levels' })}
          onHome={() => state.reset({ name: 'menu' })}
        />
      )
    }

    case 'settings':
      return <SettingsScreen state={state} onBack={() => state.back()} />
  }
}

/**
 * Fase de segurança: rota apontando para id inexistente (ex.: save com fase
 * removida) cai na primeira fase da campanha em vez de quebrar o shell.
 */
function firstSpec(campaign: Campaign): LevelSpec {
  const first = campaign.summaries[0]
  if (first === undefined) throw new Error('campanha vazia: sem fases para jogar')
  const spec = campaign.level(first.id)
  if (spec === undefined) throw new Error(`fase ausente na campanha: ${first.id}`)
  return spec
}
