// Persistência versionada de progresso (SDD §10). Envelope
// { schemaVersion, ... } sobre um storage simples (localStorage no app; memória
// nos testes). Migrações entre versões e recuperação segura de save corrompido
// ou ausente. Storage atrás de interface — sync remoto no futuro é um
// adaptador, não uma reescrita (ADR-0001). Sem dependência de DOM.

// ---------------------------------------------------------------------------
// Contratos
// ---------------------------------------------------------------------------

/** Interface mínima de storage (localStorage se encaixa; testes usam memória). */
export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** Progresso por fase: melhor resultado já alcançado (SDD §5.3). */
export interface LevelProgress {
  readonly stars: 0 | 1 | 2 | 3
  /** Menor número de peças com que a fase foi vencida. */
  readonly bestPieces?: number
  /** Menor número de portas com que a fase foi vencida. */
  readonly bestGates?: number
  readonly completedWithHint?: boolean
}

/** Configurações persistidas (SDD §10.2). */
export interface SaveSettings {
  readonly muted: boolean
  readonly theme: 'light' | 'dark' | 'auto'
  readonly haptics: boolean
  readonly reducedMotion: boolean
}

/** Rascunho de sandbox/editor por slot. */
export interface SandboxDraft {
  readonly label: string
  readonly updatedAt: string
  readonly levelSpec: unknown
  readonly boardState: unknown
}

/** Conteúdo completo do save (envelope versionado, SDD §10.1). */
export interface SaveData {
  readonly schemaVersion: number
  readonly levels: Readonly<Record<string, LevelProgress>>
  readonly settings: SaveSettings
  readonly sandboxDrafts: Readonly<Record<string, SandboxDraft>>
}

export const SAVE_SCHEMA_VERSION = 1

export const DEFAULT_SETTINGS: SaveSettings = {
  muted: false,
  theme: 'auto',
  haptics: true,
  reducedMotion: false,
}

export function emptySave(): SaveData {
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    levels: {},
    settings: { ...DEFAULT_SETTINGS },
    sandboxDrafts: {},
  }
}

// ---------------------------------------------------------------------------
// Migrações
// ---------------------------------------------------------------------------

type MigrateFn = (raw: Record<string, unknown>) => Record<string, unknown>

/**
 * Migrações indexadas pela versão DE PARTIDA. O loader aplica em cadeia até
 * chegar em SAVE_SCHEMA_VERSION. Adicione aqui a função vN -> vN+1 sempre que
 * o schema mudar (SDD §10.3).
 */
const MIGRATIONS: Readonly<Record<number, MigrateFn>> = {
  0: raw => ({
    ...raw,
    // v0 (pré-envelope) guardava estrelas soltas em `starsByLevel`.
    levels: raw.levels ?? raw.starsByLevel ?? {},
  }),
}

/** Normaliza um valor parcial vindo do storage, tolerando campos ausentes. */
function normalizeSave(raw: unknown): SaveData | null {
  if (typeof raw !== 'object' || raw === null) return null
  const obj = raw as Record<string, unknown>
  if (typeof obj.schemaVersion !== 'number') return null

  let version = obj.schemaVersion
  if (version < 0 || version > SAVE_SCHEMA_VERSION) return null
  let current: Record<string, unknown> = obj
  while (version < SAVE_SCHEMA_VERSION) {
    const migrate = MIGRATIONS[version]
    if (!migrate) return null
    current = migrate(current)
    version += 1
    current.schemaVersion = version
  }

  const levelsRaw = current.levels
  const levels: Record<string, LevelProgress> = {}
  if (typeof levelsRaw === 'object' && levelsRaw !== null && !Array.isArray(levelsRaw)) {
    for (const [id, value] of Object.entries(levelsRaw as Record<string, unknown>)) {
      if (typeof value !== 'object' || value === null) continue
      const entry = value as Record<string, unknown>
      const stars = entry.stars
      if (typeof stars !== 'number' || stars < 0 || stars > 3) continue
      levels[id] = {
        stars: stars as 0 | 1 | 2 | 3,
        bestPieces: typeof entry.bestPieces === 'number' ? entry.bestPieces : undefined,
        bestGates: typeof entry.bestGates === 'number' ? entry.bestGates : undefined,
        completedWithHint:
          typeof entry.completedWithHint === 'boolean' ? entry.completedWithHint : undefined,
      }
    }
  }

  const settingsRaw = current.settings
  let settings: SaveSettings = { ...DEFAULT_SETTINGS }
  if (typeof settingsRaw === 'object' && settingsRaw !== null) {
    const s = settingsRaw as Record<string, unknown>
    if (typeof s.muted === 'boolean') settings = { ...settings, muted: s.muted }
    if (s.theme === 'light' || s.theme === 'dark' || s.theme === 'auto') {
      settings = { ...settings, theme: s.theme }
    }
    if (typeof s.haptics === 'boolean') settings = { ...settings, haptics: s.haptics }
    if (typeof s.reducedMotion === 'boolean') {
      settings = { ...settings, reducedMotion: s.reducedMotion }
    }
  }

  const drafts: Record<string, SandboxDraft> = {}
  const draftsRaw = current.sandboxDrafts
  if (typeof draftsRaw === 'object' && draftsRaw !== null && !Array.isArray(draftsRaw)) {
    for (const [slot, value] of Object.entries(draftsRaw as Record<string, unknown>)) {
      if (typeof value === 'object' && value !== null) drafts[slot] = value as SandboxDraft
    }
  }

  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    levels,
    settings,
    sandboxDrafts: drafts,
  }
}

// ---------------------------------------------------------------------------
// SaveStore
// ---------------------------------------------------------------------------

export interface LevelResultInput {
  readonly stars: 0 | 1 | 2 | 3
  readonly pieces?: number
  readonly gates?: number
  readonly withHint?: boolean
}

export class SaveStore {
  private readonly key: string
  private _data: SaveData
  /** Guardado quando o storage estava corrompido e foi descartado. */
  private _recoveredFromCorruption = false

  constructor(
    private readonly storage: StorageLike,
    key = 'circuit-router-save',
  ) {
    this.key = key
    this._data = this.read()
  }

  private read(): SaveData {
    let raw: string | null
    try {
      raw = this.storage.getItem(this.key)
    } catch {
      raw = null
    }
    if (raw === null) return emptySave()
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      // JSON malformado: nunca lançar — recomeça do padrão (SDD §10.3).
      this._recoveredFromCorruption = true
      return emptySave()
    }
    const normalized = normalizeSave(parsed)
    if (normalized === null) {
      this._recoveredFromCorruption = true
      return emptySave()
    }
    // Save de versão anterior: persiste já migrado para não migrar a cada carga.
    const rawVersion =
      typeof parsed === 'object' && parsed !== null
        ? (parsed as { schemaVersion?: unknown }).schemaVersion
        : undefined
    if (typeof rawVersion === 'number' && rawVersion !== SAVE_SCHEMA_VERSION) {
      try {
        this.storage.setItem(this.key, JSON.stringify(normalized))
      } catch {
        // Falha ao persistir migração não é fatal — segue com o dado migrado.
      }
    }
    return normalized
  }

  private persist(): void {
    this.storage.setItem(this.key, JSON.stringify(this._data))
  }

  get data(): SaveData {
    return this._data
  }

  get recoveredFromCorruption(): boolean {
    return this._recoveredFromCorruption
  }

  // -- progresso de fases ---------------------------------------------------

  levelProgress(levelId: string): LevelProgress | undefined {
    return this._data.levels[levelId]
  }

  /**
   * Registra o resultado de uma fase fazendo merge com o melhor anterior
   * (guarda o menor uso de peças/portas e a maior estrela — SDD §5.3).
   */
  recordLevelResult(levelId: string, result: LevelResultInput): LevelProgress {
    const previous = this._data.levels[levelId]
    const progress: LevelProgress = {
      stars: Math.max(previous?.stars ?? 0, result.stars) as 0 | 1 | 2 | 3,
      bestPieces: mergeMin(previous?.bestPieces, result.pieces),
      bestGates: mergeMin(previous?.bestGates, result.gates),
      completedWithHint:
        result.withHint === true
          ? true
          : previous?.completedWithHint ?? false,
    }
    this._data = { ...this._data, levels: { ...this._data.levels, [levelId]: progress } }
    this.persist()
    return progress
  }

  // -- configurações ----------------------------------------------------------

  get settings(): SaveSettings {
    return this._data.settings
  }

  updateSettings(patch: Partial<SaveSettings>): SaveSettings {
    const settings = { ...this._data.settings, ...patch }
    this._data = { ...this._data, settings }
    this.persist()
    return settings
  }

  // -- rascunhos de sandbox/editor -------------------------------------------

  draft(slot: string): SandboxDraft | undefined {
    return this._data.sandboxDrafts[slot]
  }

  saveDraft(slot: string, draft: Omit<SandboxDraft, 'updatedAt'>): SandboxDraft {
    const stored: SandboxDraft = { ...draft, updatedAt: new Date().toISOString() }
    this._data = {
      ...this._data,
      sandboxDrafts: { ...this._data.sandboxDrafts, [slot]: stored },
    }
    this.persist()
    return stored
  }

  deleteDraft(slot: string): boolean {
    if (!(slot in this._data.sandboxDrafts)) return false
    const sandboxDrafts = { ...this._data.sandboxDrafts }
    delete sandboxDrafts[slot]
    this._data = { ...this._data, sandboxDrafts }
    this.persist()
    return true
  }

  /** Apaga todo o save (volta ao padrão). */
  reset(): void {
    this.storage.removeItem(this.key)
    this._data = emptySave()
    this._recoveredFromCorruption = false
  }
}

function mergeMin(a: number | undefined, b: number | undefined): number | undefined {
  if (a === undefined) return b
  if (b === undefined) return a
  return Math.min(a, b)
}
