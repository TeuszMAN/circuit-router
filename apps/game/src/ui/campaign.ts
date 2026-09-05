/**
 * Fonte de fases da UI — catálogo provisório (MI-10).
 *
 * A campanha definitiva (6 packs, 24 fases, MI-07) ainda não existe no
 * monorepo: `@circuit/content` expõe textos e glossário, mas o índice de packs
 * é stub. Enquanto isso o shell usa esta lista-bootstrap de 3 fases manuais,
 * válidas contra o schema de `LevelSpec`. Quando MI-07/MI-17 entregarem os
 * packs, este módulo é substituído por um carregador de `@circuit/content`
 * mantendo a mesma superfície (`LevelSummary[]` + resolução por id).
 */
import type { LevelSpec } from '@circuit/core/model'
import { LEVEL_SCHEMA_VERSION } from '@circuit/core/model'

/** Linha exibida no seletor de fases. */
export interface LevelSummary {
  readonly id: string
  readonly name: string
}

export interface Campaign {
  readonly summaries: readonly LevelSummary[]
  level(id: string): LevelSpec | undefined
}

const EMPTY_GATES: LevelSpec['inventory']['gates'] = { AND: 0, OR: 0, NOT: 0 }

function spec(
  id: string,
  name: string,
  width: number,
  height: number,
  fixedCells: LevelSpec['fixedCells'],
  maxPieces: number,
  hints: LevelSpec['hints'],
): LevelSpec {
  return {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id,
    name,
    grid: { width, height },
    fixedCells,
    inventory: { wires: null, gates: { ...EMPTY_GATES } },
    hints,
    starThresholds: { maxPieces, maxGates: 0 },
  }
}

/**
 * Fases-bootstrap (trocar por packs reais da MI-07):
 *  1. Primeira rota   — só fios (Pack 1);
 *  2. Primeira negação — NOT fixo, lacunas de fio (Pack 2);
 *  3. Só os dois       — AND fixo, lacunas de fio (Pack 3).
 */
export const BOOTSTRAP_CAMPAIGN: readonly LevelSpec[] = [
  spec(
    'bootstrap-01-primeira-rota',
    'Primeira rota',
    4,
    1,
    [
      { coord: { x: 0, y: 0 }, cell: { kind: 'source', value: 1, outputSide: 'E' } },
      { coord: { x: 3, y: 0 }, cell: { kind: 'sink', expected: 1, inputSide: 'W' } },
    ],
    2,
    [
      'O sinal já está pronto na fonte. Falta só um caminho para ele chegar ao destino.',
      'Toque na ferramenta de fio e deslize da fonte até o destino, célula a célula.',
    ],
  ),
  spec(
    'bootstrap-02-primeira-negacao',
    'Primeira negação',
    5,
    1,
    [
      { coord: { x: 0, y: 0 }, cell: { kind: 'source', value: 0, outputSide: 'E' } },
      {
        coord: { x: 2, y: 0 },
        cell: {
          kind: 'gate',
          gate: 'NOT',
          rotation: 'E',
          inputSides: ['W'],
          outputSide: 'E',
        },
      },
      { coord: { x: 4, y: 0 }, cell: { kind: 'sink', expected: 1, inputSide: 'W' } },
    ],
    2,
    [
      'A fonte manda 0, mas o destino espera 1. Que peça devolve o oposto do que recebe?',
      'O NOT já está no tabuleiro: ligue a fonte à entrada dele e a saída dele ao destino.',
    ],
  ),
  spec(
    'bootstrap-03-so-os-dois',
    'Só os dois',
    5,
    2,
    [
      { coord: { x: 0, y: 1 }, cell: { kind: 'source', value: 1, outputSide: 'E' } },
      { coord: { x: 2, y: 0 }, cell: { kind: 'source', value: 1, outputSide: 'S' } },
      {
        coord: { x: 2, y: 1 },
        cell: {
          kind: 'gate',
          gate: 'AND',
          rotation: 'E',
          inputSides: ['W', 'N'],
          outputSide: 'E',
        },
      },
      { coord: { x: 4, y: 1 }, cell: { kind: 'sink', expected: 1, inputSide: 'W' } },
    ],
    2,
    [
      'As duas fontes valem 1, mas o destino só acende com as duas juntas chegando à porta certa.',
      'Um AND já está entre as fontes e o destino: complete os dois trechos que faltam com fio.',
    ],
  ),
]

export function bootstrapCampaign(): Campaign {
  const byId = new Map<string, LevelSpec>(BOOTSTRAP_CAMPAIGN.map(l => [l.id, l]))
  return {
    summaries: BOOTSTRAP_CAMPAIGN.map(l => ({ id: l.id, name: l.name })),
    level(id) {
      return byId.get(id)
    },
  }
}
