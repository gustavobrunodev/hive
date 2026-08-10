/**
 * Design Studio (M18) — T6.2. The Skill's stream, mirrored for the renderer.
 *
 * Structural mirrors of `main/designStudio/skillDesignSystem.ts` and
 * `studioSkillRuns.ts`, not imports — the same convention `documentModel.ts`
 * and `screens.ts` already follow, and which `moduleBoundaries.test.ts`
 * enforces.
 *
 * The status is a **phase**, not a sentence: the copy the user reads is pt-BR
 * and lives in `i18n/pt-BR.ts` with every other string. Main sends `'reading'`;
 * the renderer decides it says "Lendo a Spec…".
 */

import type { Command } from './documentModel'
import type { StudioOperationError } from './screens'

export type SkillPhase = 'reading' | 'choosing' | 'composing'

/** DS-R2: generate one Tela's first Component tree from the Spec. */
export interface StudioGenerateRequest {
  kind: 'generate'
  workspace: string
  specPath: string
  screenTitle: string
}

export type StudioSkillRequest = StudioGenerateRequest

export interface SkillBatch {
  commands: Command[]
  /** The Skill's own words — including the "não dá com este DS" of DS-R11 AC-5. */
  message: string
}

export type StudioSkillEvent =
  | { type: 'status'; phase: SkillPhase }
  | { type: 'result'; batch: SkillBatch }
  | { type: 'failed'; error: StudioOperationError }
