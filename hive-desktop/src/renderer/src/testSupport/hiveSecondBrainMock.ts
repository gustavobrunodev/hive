import { vi, type Mock } from 'vitest'

/** Each secondBrain bridge method as a vitest `Mock`, so tests can `.mockResolvedValue(...)` per method. */
export type HiveSecondBrainMock = Record<keyof Window['hive']['secondBrain'], Mock>

/**
 * A fully-stubbed `window.hive.secondBrain` namespace (second-brain M12) for
 * tests that mount UI reading `window.hive` but don't exercise Second Brain —
 * `getVault` resolves to "no vault", `isProvisioned` to false, the streaming
 * install/update return a no-op unsubscribe, and `stageRaw` echoes a benign
 * path. Tests that DO drive Second Brain override the methods they need.
 * Centralized so a new bridge method is a one-file change (the M10 lesson).
 */
export function createHiveSecondBrainMock(): HiveSecondBrainMock {
  return {
    install: vi.fn().mockReturnValue(() => {}),
    update: vi.fn().mockReturnValue(() => {}),
    isProvisioned: vi.fn().mockResolvedValue(false),
    getVault: vi.fn().mockResolvedValue({ path: null, name: null, rawPending: 0 }),
    stageRaw: vi.fn().mockResolvedValue({ relPath: 'second-brain/raw/ingest.md' })
  }
}
