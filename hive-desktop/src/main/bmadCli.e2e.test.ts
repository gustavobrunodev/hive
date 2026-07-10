import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { createConfigStore } from './configStore'
import { createProcessRunner } from './processRunner'
import { createBmadService, type BmadEvent } from './bmadService'
import { listWithDiscovery } from './workflowCatalog'

/**
 * Real-CLI E2E smoke (task T20, R8.1/R8.2, design.md §8's "one integration/
 * E2E smoke against a real throwaway workspace ... gated in CI as it needs
 * the real CLIs"). Excluded from the fast default suite (vitest.config.ts) —
 * run via `npm run test:e2e`.
 *
 * Drives the real, unmocked path every other test in this codebase fakes:
 * `npx bmad-method install`/`update` against a real throwaway directory,
 * through the real `BmadService`/`ProcessRunner` this app ships. This is the
 * strongest available proof that T0's captured command/output shape (and
 * T8/T10/T17's parsing built against it) still holds against the real CLI —
 * not just against fixture data frozen at T0's capture time.
 *
 * **Known gap, stated plainly rather than glossed over**: there is no real
 * `claude` CLI binary in this sandbox (confirmed absent — see claudeCliAdapter
 * task report), so the chat/PRD-generation leg of R8.1 ("new chat -> Create a
 * PRD -> PRD.md appears in explorer") cannot be driven for real here. That
 * leg is covered instead by: (a) ClaudeCliAdapter/AgentService/Chat/IntentGrid
 * unit+component tests against a scripted fake process, and (b) a live
 * Playwright pass against the real DS bundle with `window.hive` stubbed
 * (T19's task report) proving the UI wiring itself — click PRD -> streaming
 * indicator -> (in a real run) chat tokens -> FsService's real watcher (this
 * file's own `listTree`/watcher path IS exercised for real by fsService.test.ts
 * against a real temp dir) picks up the new file. The actual BMAD-install and
 * BMAD-update halves below ARE fully real, no gap there.
 */
describe('E2E smoke — real bmad-method CLI (T20)', () => {
  let workspace: string

  beforeAll(() => {
    workspace = mkdtempSync(join(tmpdir(), 'hive-e2e-smoke-'))
  })

  afterAll(() => {
    rmSync(workspace, { recursive: true, force: true })
  })

  it('R8.1 (install half): a fresh workspace installs via the real CLI and ends provisioned', async () => {
    const configStore = createConfigStore(mkdtempSync(join(tmpdir(), 'hive-e2e-userdata-')))
    const processRunner = createProcessRunner()
    const bmadService = createBmadService(processRunner, configStore)

    const events: BmadEvent[] = []
    for await (const event of bmadService.install(workspace)) {
      events.push(event)
    }

    expect(events.at(-1)).toEqual({ type: 'done', ok: true })
    expect(events.some((e) => e.type === 'step')).toBe(true)
    expect(configStore.getConfig().provisioned).toBe(true)

    // The real, on-disk provisioning signal T0/T11 verified — not just the
    // in-memory ConfigStore flag above.
    expect(existsSync(join(workspace, '_bmad', '_config', 'manifest.yaml'))).toBe(true)
    // The PRD skill T17's curated catalog wires to must actually exist in a
    // fresh real install, or the catalog's "wired" claim is stale.
    expect(existsSync(join(workspace, '.claude', 'skills', 'bmad-prd', 'SKILL.md'))).toBe(true)
  })

  it('R8.2 (relaunch/update half): re-running against the now-provisioned workspace quick-updates and ends done', async () => {
    const configStore = createConfigStore(mkdtempSync(join(tmpdir(), 'hive-e2e-userdata-')))
    configStore.setProvisioned(true)
    const processRunner = createProcessRunner()
    const bmadService = createBmadService(processRunner, configStore)

    const events: BmadEvent[] = []
    for await (const event of bmadService.update(workspace)) {
      events.push(event)
    }

    expect(events.at(-1)).toEqual({ type: 'done', ok: true })
    expect(events.some((e) => e.type === 'error')).toBe(false)
  })

  it('WorkflowCatalog.listWithDiscovery reads the real installed bmad-help.csv and keeps prd wired', async () => {
    const entries = await listWithDiscovery(workspace)
    const prd = entries.find((entry) => entry.key === 'prd')
    expect(prd?.status).toBe('wired')
    // Real discovery should find more than just the curated five once a
    // real BMAD module (bmm) is installed.
    expect(entries.length).toBeGreaterThan(5)
  })
})
