import { vi } from 'vitest'
import type { EngineCapabilities } from '../chat/engineOptions'
import type { EnginePin, EnginePins } from '../chat/enginePins'
import { resetEnginePins } from '../chat/enginePins'

/**
 * The slice of `window.hive` the **run-config** needs: an agent's
 * capabilities, the persisted engine pins, and the agent roster the switcher
 * labels itself from.
 *
 * Every surface that starts a session renders `RunConfigBar` now, which means
 * three suites that used to know nothing about agents suddenly talk to this
 * part of the bridge. Shared rather than hand-rolled per suite, and shaped
 * against `src/preload/index.d.ts` — a stub that drifts from the bridge is the
 * failure `docs/visual-validation.md` records in full.
 */

/** Two models and a three-rung ladder — enough to pin, switch and assert. */
export const RUN_CONFIG_CAPABILITIES: EngineCapabilities = {
  models: [
    { id: '', label: 'Automático', traits: ['cli-default'], group: 'default', resolvedId: 'opus' },
    { id: 'opus', label: 'Opus', group: 'recommended' },
    { id: 'sonnet', label: 'Sonnet', group: 'recommended' }
  ],
  efforts: [
    { id: '', label: 'Automático' },
    { id: 'low', label: 'Baixo' },
    { id: 'high', label: 'Alto' }
  ],
  supportsAttachments: true,
  modelSource: 'detected'
}

export interface HiveRunConfigMock {
  capabilities: ReturnType<typeof vi.fn>
  pins: ReturnType<typeof vi.fn>
  pin: ReturnType<typeof vi.fn>
  agents: ReturnType<typeof vi.fn>
  /** What `pin()` has written, as the store would hold it. */
  stored: EnginePins
}

/**
 * Installs the run-config bridge on `window.hive`, preserving whatever else a
 * suite has already put there.
 *
 * `resetEnginePins()` is not optional: the pin cache is module-level (one read
 * per window, shared by every surface), so without it the second test in a file
 * inherits the first one's answer and the mock is never consulted again.
 */
export function installRunConfigMock(
  overrides: { capabilities?: EngineCapabilities; pins?: EnginePins } = {}
): HiveRunConfigMock {
  resetEnginePins()
  const stored: EnginePins = { ...(overrides.pins ?? {}) }
  const mock: HiveRunConfigMock = {
    capabilities: vi.fn().mockResolvedValue(overrides.capabilities ?? RUN_CONFIG_CAPABILITIES),
    pins: vi.fn().mockImplementation(async () => ({ ...stored })),
    pin: vi.fn().mockImplementation(async (agentId: string, next: EnginePin | null) => {
      if (next === null) delete stored[agentId]
      else stored[agentId] = next
      return { ...stored }
    }),
    agents: vi.fn().mockResolvedValue([
      { id: 'claude-cli', displayName: 'Claude Code' },
      { id: 'copilot-cli', displayName: 'GitHub Copilot' }
    ]),
    stored
  }
  const hive = (window.hive ?? {}) as Record<string, unknown>
  window.hive = {
    ...hive,
    agent: {
      ...((hive.agent as Record<string, unknown>) ?? {}),
      capabilities: mock.capabilities,
      pins: mock.pins,
      pin: mock.pin
    },
    profile: { ...((hive.profile as Record<string, unknown>) ?? {}), agents: mock.agents }
  } as unknown as typeof window.hive
  return mock
}
