/**
 * Design Studio (M18) — the bridge's Tela shapes, mirrored.
 *
 * Structural mirrors of `main/designStudio/screenDetection.ts`, not imports:
 * the renderer never reaches across the process boundary for a type (the
 * convention every other module here follows — see `scm/gitStatus.ts`,
 * `secondBrain/useSecondBrain.ts`).
 */

/** One way a Spec can name a Tela — rendered by name in the empty state (DS-R1 AC-3). */
export type ScreenProbe = 'screenHeading' | 'iaTable'

/** The probes, in the detector's order — the fallback while the Spec is still being read. */
export const SCREEN_PROBES: readonly ScreenProbe[] = ['screenHeading', 'iaTable']

export interface DetectedScreen {
  screenId: string
  title: string
  probe: ScreenProbe
}

export interface ScreenDetectionResult {
  screens: DetectedScreen[]
  probed: readonly ScreenProbe[]
}

/** The two failure shapes the Studio is allowed to have (DS-R17). */
export interface StudioOperationError {
  kind: 'operation'
  scope: 'agent' | 'preview' | 'export' | 'io'
  message: string
  retryable: boolean
}

/** What `window.hive.designStudio.screens()` resolves to. */
export type ScreensResponse = ScreenDetectionResult | StudioOperationError

export function isOperationError(value: ScreensResponse): value is StudioOperationError {
  return 'kind' in value && value.kind === 'operation'
}
