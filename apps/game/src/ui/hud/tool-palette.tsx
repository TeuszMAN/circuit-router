/**
 * Paleta de peças do HUD — fio, AND, OR, NOT e borracha. Alvos >= 44px;
 * ferramenta ativa marcada com aria-pressed. A seleção é local à sessão de
 * jogo; quem traduz toque em comandos (MI-15) lê `activeTool`.
 */
import type { Signal } from '@preact/signals'
import type { JSX } from 'preact'
import type { LevelInventory } from '@circuit/core/model'
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
  readonly inventory?: LevelInventory
  readonly remaining?: LevelInventory
}

export function ToolPalette({ activeTool, onSelect, inventory, remaining }: ToolPaletteProps) {
  return (
    <div className="palette" role="toolbar" aria-label="Ferramentas de desenho">
      {TOOLS.map(def => {
        const pressed = activeTool.value === def.tool
        const gate = def.tool !== 'wire' && def.tool !== 'erase' ? def.tool : null
        const unavailable = gate !== null && inventory !== undefined && (inventory.gates[gate] ?? 0) === 0 && inventory.gates[gate] !== null
        const count = def.tool === 'wire' ? remaining?.wires : gate ? remaining?.gates[gate] : undefined
        return (
          <button
            key={def.tool}
            type="button"
            className="palette__tool"
            aria-pressed={pressed}
            aria-label={`Ferramenta ${def.label}`}
            disabled={unavailable}
            onClick={() => {
              activeTool.value = def.tool
              onSelect?.(def.tool)
            }}
          >
            {def.icon}
            <span>{def.label}</span>
            {count !== undefined ? <span aria-hidden="true">{count === null ? '∞' : count}</span> : null}
          </button>
        )
      })}
    </div>
  )
}
