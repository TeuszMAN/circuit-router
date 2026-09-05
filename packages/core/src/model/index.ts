export const CORE_VERSION = '0.0.1'

export type { Coord, Direction } from './geometry'
export type { Signal } from './signal'
export {
  GATE_ARITY,
} from './cell'
export type {
  Cell,
  CellKind,
  EmptyCell,
  GateCell,
  GateType,
  SinkCell,
  SourceCell,
  WireCell,
} from './cell'
export {
  LEVEL_SCHEMA_VERSION,
} from './level'
export type {
  FixedCell,
  GridSize,
  LevelHints,
  LevelInventory,
  LevelSpec,
  StarThresholds,
} from './level'
export type { BoardState, PlacedCell } from './board-state'
export type {
  IssueKind,
  SimulationIssue,
  SimulationResult,
  SinkStatus,
} from './simulation'
