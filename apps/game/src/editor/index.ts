// Modo sandbox e editor de fases (MI-13, SDD §9.5).

export { SandboxScreen } from './sandbox-screen'
export type { SandboxScreenProps } from './sandbox-screen'
export {
  blankSandboxLevel,
  createMemoryStorage,
  createSandboxEditor,
} from './state'
export type { DraftSummary, ImportOutcome, SandboxEditorState } from './state'
export { parseLevelSpecJson, validateLevelSpec } from './schema'
export type {
  SchemaValidationFailure,
  SchemaValidationResult,
  SchemaValidationSuccess,
} from './schema'
