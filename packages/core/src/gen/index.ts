// Gerador procedural + solver/validador de fases (MI-05, SDD §9.4).
// Ponto de entrada público do subpath @circuit/core/gen.
//
// Fluxo do gerador (`generateLevel`):
//   1. sorteia um alvo lógico (expressão sobre <= 3 variáveis) com orçamento
//      exato de portas para a dificuldade pedida (expression.ts);
//   2. sintetiza o circuito de referência e o posiciona no grid, podando o
//      tabuleiro com paredes (synthesis.ts);
//   3. VALIDA a fase com o solver antes de entregá-la — o solver prova que
//      existe solução dentro do inventário e a simulação confirma
//      (solver.ts). A fase só sai "pronta" se `solveLevel` passar.
// Determinismo: toda a cadeia é dirigida por um PRNG semeado (rng.ts).

import type { BoardState, LevelSpec } from '../model'
import type { DifficultyEstimate } from './difficulty'
import { estimateDifficulty } from './difficulty'
import type { SolveResult } from './solver'
import { solveLevel } from './solver'
import { Rng } from './rng'
import { expressionText, sampleTarget } from './expression'
import {
  applyInventory,
  buildCandidate,
  buildLevelSpec,
  DIFFICULTY_CONFIGS,
  MAX_DIFFICULTY,
} from './synthesis'
import type { SynthesisConfig } from './synthesis'

export type { DifficultyEstimate, SolveResult, SynthesisConfig }
export { DIFFICULTY_CONFIGS, MAX_DIFFICULTY, estimateDifficulty, solveLevel }

export interface GenerationOptions {
  /** Semente determinística (uint32). Mesma semente => mesma fase byte-idêntica. */
  readonly seed: number
  /** Dificuldade 1..5 (default 3). */
  readonly difficulty?: number
}

export interface GeneratedLevel {
  readonly seed: number
  readonly difficulty: number
  readonly spec: LevelSpec
  /** Solução de referência encontrada pelo solver (para testes/debug). */
  readonly reference: BoardState
  readonly estimate: DifficultyEstimate
}

/** Mistura seed e dificuldade num estado inicial estável entre runtimes. */
function mixSeed(seed: number, difficulty: number): number {
  const a = Math.imul(seed >>> 0, 0x9e3779b1)
  const b = Math.imul(difficulty, 0x85ebca6b)
  return (a ^ b) >>> 0
}

/**
 * Gera uma fase completa e já validada pelo solver. Lança erro apenas em caso
 * de bug interno (fase gerada sem solução) — nunca produz fase insolúvel.
 */
export function generateLevel(options: GenerationOptions): GeneratedLevel {
  const { seed } = options
  const difficulty = options.difficulty ?? 3
  if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > MAX_DIFFICULTY) {
    throw new RangeError(`difficulty deve estar entre 1 e ${MAX_DIFFICULTY}; recebido ${difficulty}`)
  }
  const cfg = DIFFICULTY_CONFIGS[difficulty] as SynthesisConfig
  const rng = new Rng(mixSeed(seed, difficulty))

  const { spec: target, row } = sampleTarget(rng, cfg.inputs, cfg.gates)
  const candidate = buildCandidate(cfg, target, row)
  const id = `gen-${difficulty}-${seed}`
  const name = `Gerada #${seed} (dificuldade ${difficulty})`
  const expression = expressionText(target)
  const provisional = buildLevelSpec(candidate, id, name, expression)

  const solution = solveLevel(provisional)
  if (!solution.solved || !solution.board) {
    throw new Error(
      `gerador: fase interna sem solução (seed=${seed}, difficulty=${difficulty}, reason=${solution.reason ?? '?'})`,
    )
  }

  // Inventário real derivado da solução + folga para rotas alternativas.
  const slack = 2
  const spec = applyInventory(provisional, solution.wiresUsed ?? 0, slack)
  const recheck = solveLevel(spec)
  if (!recheck.solved || !recheck.board) {
    throw new Error(
      `gerador: inventário apertado demais para a solução (seed=${seed}, difficulty=${difficulty})`,
    )
  }

  const estimate = estimateDifficulty(spec, recheck.board)
  return { seed, difficulty, spec, reference: recheck.board, estimate }
}
