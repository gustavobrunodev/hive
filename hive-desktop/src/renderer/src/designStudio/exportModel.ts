/**
 * Design Studio (M18) — T7.4. The Bundle's shapes, mirrored for the renderer.
 *
 * Structural mirrors of `main/designStudio/exportBundle.ts`, not imports: the
 * renderer never reaches across the process boundary for a type, the convention
 * `screens.ts` and `documentModel.ts` follow and `moduleBoundaries.test.ts`
 * enforces.
 */

import type { StudioOperationError } from './screens'

/** One Tela the tab asked for, addressed the way the document service knows it. */
export interface ExportRequest {
  key: string
  screenId: string
  title: string
}

/** Where one Tela landed, or why it did not (DS-R15). */
export type ExportOutcome =
  | { screenId: string; title: string; ok: true; file: string }
  | { screenId: string; title: string; ok: false; error: StudioOperationError }

/** One run of the export. `canceled` is closing the folder picker, not a failure. */
export interface ExportRun {
  canceled: boolean
  outDir: string | null
  outcomes: ExportOutcome[]
}

/** The Telas that failed, which is the only part of a report worth reading twice. */
export function failedOutcomes(
  outcomes: readonly ExportOutcome[]
): Extract<ExportOutcome, { ok: false }>[] {
  return outcomes.filter((outcome): outcome is Extract<ExportOutcome, { ok: false }> => !outcome.ok)
}
