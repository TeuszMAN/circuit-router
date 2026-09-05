/**
 * Tela de configurações — mute, tema, haptics e reduzir animação.
 * Preferências persistidas via AppState (SaveStore, MI-06); consumidas pelas
 * camadas de áudio (MI-12), entrada (MI-09) e render (MI-08) quando existirem.
 */
import type { AppState, ThemeSetting } from '../state'
import { ScreenHeader } from '../chrome'

export interface SettingsProps {
  readonly state: AppState
  readonly onBack: () => void
}

const THEME_OPTIONS: ReadonlyArray<{ readonly value: ThemeSetting; readonly label: string }> = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
  { value: 'auto', label: 'Automático' },
]

function SwitchRow({
  label,
  hint,
  checked,
  onChange,
}: {
  readonly label: string
  readonly hint: string
  readonly checked: boolean
  readonly onChange: (next: boolean) => void
}) {
  return (
    <div className="setting-row">
      <span className="setting-row__text">
        <span className="setting-row__label">{label}</span>
        <br />
        <span className="setting-row__hint">{hint}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className="switch"
        onClick={() => onChange(!checked)}
      />
    </div>
  )
}

export function SettingsScreen({ state, onBack }: SettingsProps) {
  return (
    <div className="app-screen">
      <ScreenHeader title="Configurações" onBack={onBack} backLabel="Voltar" />

      <div className="settings">
        <section className="setting-group" aria-label="Áudio">
          <SwitchRow
            label="Som"
            hint="Efeitos sonoros e música ambiente"
            checked={!state.muted.value}
            onChange={next => state.setSettings({ muted: !next })}
          />
        </section>

        <section className="setting-group" aria-label="Toque">
          <SwitchRow
            label="Vibração"
            hint="Resposta tátil ao colocar e apagar peças"
            checked={state.haptics.value}
            onChange={next => state.setSettings({ haptics: next })}
          />
        </section>

        <section className="setting-group" aria-label="Aparência">
          <div className="setting-row">
            <span className="setting-row__text">
              <span className="setting-row__label">Tema</span>
              <br />
              <span className="setting-row__hint">Aparência das telas e do tabuleiro</span>
            </span>
          </div>
          <div className="setting-row">
            <div className="segmented" role="group" aria-label="Tema">
              {THEME_OPTIONS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={state.theme.value === option.value}
                  className="segmented__option"
                  onClick={() => state.setSettings({ theme: option.value })}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <SwitchRow
            label="Reduzir animação"
            hint="Desliga efeitos de movimento (SDD §8.5)"
            checked={state.reducedMotion.value}
            onChange={next => state.setSettings({ reducedMotion: next })}
          />
        </section>
      </div>
    </div>
  )
}
