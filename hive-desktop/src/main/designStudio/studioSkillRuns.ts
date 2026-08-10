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
import type { ComponentCatalog, ScreenDocument } from './types'

/** DS-R2: generate the initial tree of one Tela from the Spec on disk. */
export interface StudioGenerateRequest {
  kind: 'generate'
  workspace: string
  /** Workspace-relative path of the UX Spec. Read-only to the Studio. */
  specPath: string
  screenTitle: string
}

/** DS-R10: one iteration turn over a Tela that already exists. */
export interface StudioIterateRequest {
  kind: 'iterate'
  /** The Tela's log in main — the same key `dispatch`/`view` use. */
  key: string
  screenId: string
  title: string
  message: string
  /** DS-R10 AC-1: the selected Component, or `null` for the whole Tela. */
  selectedComponentId: string | null
}

export type StudioSkillRequest = StudioGenerateRequest | StudioIterateRequest

export interface StudioSkillDeps {
  /** Reads the Spec. Rejects like `fsService.readFile` does. */
  readSpec(workspace: string, specPath: string): Promise<string>
  /** The active Adapter's catalog (DS-R13) — the only source of tags. */
  catalog(): ComponentCatalog
  /** An agent bound to this workspace. One per run: a run is one turn. */
  agentFor(workspace: string): SkillAgent
  /**
   * The Tela as its log leaves it. Read at send time, not at request time: the
   * user may have edited by hand between opening the chat and pressing Enter,
   * and a prompt built on a stale tree addresses ids that have moved.
   */
  documentFor(key: string, screenId: string, title: string): ScreenDocument
  /** The workspace the iteration's agent runs in. */
  workspace(): string
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

  function iterate(request: StudioIterateRequest): AsyncIterable<StudioSkillEvent> {
    const skill = createDesignSkill(deps.agentFor(deps.workspace()))
    return skill.iterate({
      message: request.message,
      document: deps.documentFor(request.key, request.screenId, request.title),
      selectedComponentId: request.selectedComponentId,
      catalog: deps.catalog()
    })
  }

  return {
    run: (request) => (request.kind === 'generate' ? generate(request) : iterate(request))
  }
}
