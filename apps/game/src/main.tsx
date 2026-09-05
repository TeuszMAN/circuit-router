import { render } from 'preact'
import { AppShell } from './ui/app-shell'
import { createAppState } from './ui/state'

// Estado persistente do shell: localStorage via SaveStore do core (MI-06).
const state = createAppState(window.localStorage)

const root = document.getElementById('app')
if (root) {
  render(<AppShell state={state} />, root)
}
