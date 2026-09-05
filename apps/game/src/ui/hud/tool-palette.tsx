/**
 * Paleta de peças do HUD — fio, AND, OR, NOT e borracha. Alvos >= 44px;
 * ferramenta ativa marcada com aria-pressed. A seleção é local à sessão de
 * jogo; quem traduz toque em comandos (MI-15) lê `activeTool`.
 */
import type { Signal } from '@preact/signals'
import type { JSX } from 'preact'
import {
  IconEraser,
  IconGateAND,
  IconGateNOT,
  IconGateOR,
  IconWire,
} from '../icons'

export type Tool = 'wire' | 'AND' | 'OR' | 'NOT' | 'erase'

export interface ToolDefinition {
  readonly tool: Tool
  readonly label: string
  readonly icon: JSX.Element
}

export const TOOLS: readonly ToolDefinition[] = [
  { tool: 'wire', label: 'Fio', icon: <IconWire /> },
  { tool: 'AND', label: 'AND', icon: <IconGateAND /> },
  { tool: 'OR', label: 'OR', icon: <IconGateOR /> },
  { tool: 'NOT', label: 'NOT', icon: <IconGateNOT /> },
  { tool: 'erase', label: 'Borracha', icon: <IconEraser /> },
]

export interface ToolPaletteProps {
  readonly activeTool: Signal<Tool>
  readonly onSelect?: (tool: Tool) => void
}

export function ToolPalette({ activeTool, onSelect }: ToolPaletteProps) {
  return (
    <div className="palette" role="toolbar" aria-label="Ferramentas de desenho">
      {TOOLS.map(def => {
        const pressed = activeTool.value === def.tool
        return (
          <button
            key={def.tool}
            type="button"
            className="palette__tool"
            aria-pressed={pressed}
            aria-label={`Ferramenta ${def.label}`}
            onClick={() => {
              activeTool.value = def.tool
              onSelect?.(def.tool)
            }}
          >
            {def.icon}
            <span>{def.label}</span>
          </button>
        )
      })}
    </div>
  )
}
