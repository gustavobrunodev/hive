/**
 * Design Studio (M18) — T6.2. One Skill run, assembled.
 *
 * The Skill itself (`skillDesignSystem.ts`) knows nothing about disk, the
 * active Adapter or the tab: it takes a Spec, a title and a catalog. This is
 * the thin layer that gathers those three from the main process and hands the
 * resulting stream to IPC — deliberately its own module rather than a block
 * inside `index.ts`, so the failure that matters (an unreadable Spec must reach
 * the stage as an `OperationError`, not as an unhandled rejection inside a
 * generator) is testable without an Electron app.
 */

import { createDesignSkill, type SkillAgent, type StudioSkillEvent } from './skillDesignSystem'
import type { ComponentCatalog } from './types'

/** DS-R2: generate the initial tree of one Tela from the Spec on disk. */
export interface StudioGenerateRequest {
  kind: 'generate'
  workspace: string
  /** Workspace-relative path of the UX Spec. Read-only to the Studio. */
  specPath: string
  screenTitle: string
}

export type StudioSkillRequest = StudioGenerateRequest

export interface StudioSkillDeps {
  /** Reads the Spec. Rejects like `fsService.readFile` does. */
  readSpec(workspace: string, specPath: string): Promise<string>
  /** The active Adapter's catalog (DS-R13) — the only source of tags. */
  catalog(): ComponentCatalog
  /** An agent bound to this workspace. One per run: a run is one turn. */
  agentFor(workspace: string): SkillAgent
}

export interface StudioSkillRuns {
  run(request: StudioSkillRequest): AsyncIterable<StudioSkillEvent>
}

export function createStudioSkillRuns(deps: StudioSkillDeps): StudioSkillRuns {
  async function* generate(request: StudioGenerateRequest): AsyncIterable<StudioSkillEvent> {
    let specText: string
    try {
      specText = await deps.readSpec(request.workspace, request.specPath)
    } catch (err) {
      // Scope `io`, not `agent`: nothing was asked of the agent yet, and
      // "tentar de novo" here means re-reading the file (DS-R17, design §6).
      yield {
        type: 'failed',
        error: {
          kind: 'operation',
          scope: 'io',
          message: err instanceof Error ? err.message : String(err),
          retryable: true
        }
      }
      return
    }
    const skill = createDesignSkill(deps.agentFor(request.workspace))
    yield* skill.generateScreen({
      specText,
      screenTitle: request.screenTitle,
      catalog: deps.catalog()
    })
  }

  return {
    run: (request) => generate(request)
  }
}
