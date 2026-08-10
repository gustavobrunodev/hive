import { describe, expect, it, vi } from 'vitest'
import { createStudioSkillRuns, type StudioSkillRuns } from './studioSkillRuns'
import type { SkillAgent, StudioSkillEvent } from './skillDesignSystem'
import type { AgentEvent } from '../agentAdapter'
import type { ComponentCatalog, ScreenDocument } from './types'

/**
 * design-studio T6.2 — DS-R2. What a run gathers before the agent hears
 * anything, and what the stage is told when gathering fails.
 */

const CATALOG: ComponentCatalog = {
  dsId: 'web-awesome',
  version: '3.11.0',
  components: [{ tag: 'wa-button', slots: [''], props: [] }]
}

const ANSWER = '{"commands": [], "message": "pronto"}'

function agentAnswering(answer: string): SkillAgent & { prompts: string[] } {
  const listeners = new Set<(event: AgentEvent) => void>()
  const prompts: string[] = []
  return {
    prompts,
    send(prompt, turnId) {
      prompts.push(prompt)
      for (const listener of listeners) {
        listener({ type: 'token', text: answer, turnId })
        listener({ type: 'done', turnId })
      }
    },
    onEvent(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  }
}

const EMPTY_DOC: ScreenDocument = { screenId: 'login', title: 'Login', root: null }

/** The deps, with the one under test overridden — the rest are inert stand-ins. */
function runsOver(
  overrides: Partial<Parameters<typeof createStudioSkillRuns>[0]>
): StudioSkillRuns {
  return createStudioSkillRuns({
    readSpec: () => Promise.resolve('# spec'),
    catalog: () => CATALOG,
    agentFor: () => agentAnswering(ANSWER),
    documentFor: () => EMPTY_DOC,
    workspace: () => '/ws',
    ...overrides
  })
}

async function drain(stream: AsyncIterable<StudioSkillEvent>): Promise<StudioSkillEvent[]> {
  const seen: StudioSkillEvent[] = []
  for await (const event of stream) seen.push(event)
  return seen
}

describe('createStudioSkillRuns — a generate run (DS-R2)', () => {
  it('reads the Spec and hands it, with the active catalog, to the turn', async () => {
    const agent = agentAnswering(ANSWER)
    const readSpec = vi.fn().mockResolvedValue('## Tela — Login\nUm botão de entrar.')
    const runs = runsOver({ readSpec, agentFor: () => agent })

    const seen = await drain(
      runs.run({ kind: 'generate', workspace: '/ws', specPath: 'ux.md', screenTitle: 'Login' })
    )

    expect(readSpec).toHaveBeenCalledWith('/ws', 'ux.md')
    expect(agent.prompts[0]).toContain('Um botão de entrar.')
    expect(agent.prompts[0]).toContain('wa-button')
    expect(seen.at(-1)).toEqual({ type: 'result', batch: { commands: [], message: 'pronto' } })
  })

  it('binds the agent to the run’s workspace', async () => {
    const agentFor = vi.fn(() => agentAnswering(ANSWER))
    const runs = runsOver({ agentFor })

    await drain(
      runs.run({ kind: 'generate', workspace: '/ws', specPath: 'ux.md', screenTitle: 'Login' })
    )

    expect(agentFor).toHaveBeenCalledWith('/ws')
  })

  it('reports an unreadable Spec as a retryable io error, and never asks the agent', async () => {
    const agentFor = vi.fn(() => agentAnswering(ANSWER))
    const runs = runsOver({
      readSpec: () => Promise.reject(new Error('ENOENT: no such file')),
      agentFor
    })

    const seen = await drain(
      runs.run({ kind: 'generate', workspace: '/ws', specPath: 'ux.md', screenTitle: 'Login' })
    )

    expect(seen).toEqual([
      {
        type: 'failed',
        error: {
          kind: 'operation',
          scope: 'io',
          message: 'ENOENT: no such file',
          retryable: true
        }
      }
    ])
    expect(agentFor).not.toHaveBeenCalled()
  })

  it('survives a rejection that is not an Error', async () => {
    const runs = runsOver({ readSpec: () => Promise.reject('disco cheio') })

    const seen = await drain(
      runs.run({ kind: 'generate', workspace: '/ws', specPath: 'ux.md', screenTitle: 'Login' })
    )

    expect((seen[0] as { error: { message: string } }).error.message).toBe('disco cheio')
  })
})

/**
 * design-studio T6.4 — DS-R10 AC-1. The iteration reads the Tela **at send
 * time**: a prompt built on a stale tree addresses ids that have moved.
 */
describe('createStudioSkillRuns — an iterate run (DS-R10)', () => {
  const DOC: ScreenDocument = {
    screenId: 'login',
    title: 'Login',
    root: { id: 'n1', tag: 'wa-button', props: {}, children: [] }
  }

  const ITERATE = {
    kind: 'iterate' as const,
    key: '/ws ux.md login',
    screenId: 'login',
    title: 'Login',
    message: 'deixe o botão discreto',
    selectedComponentId: 'n1'
  }

  it('reads the Tela by its log key and puts the selection in the prompt', async () => {
    const agent = agentAnswering(ANSWER)
    const documentFor = vi.fn(() => DOC)
    const runs = runsOver({ agentFor: () => agent, documentFor })

    const seen = await drain(runs.run(ITERATE))

    expect(documentFor).toHaveBeenCalledWith('/ws ux.md login', 'login', 'Login')
    expect(agent.prompts[0]).toContain('The user has <wa-button> (id "n1") selected.')
    expect(agent.prompts[0]).toContain('deixe o botão discreto')
    expect(seen.at(-1)).toEqual({ type: 'result', batch: { commands: [], message: 'pronto' } })
  })

  it('scopes to the Tela when nothing is selected', async () => {
    const agent = agentAnswering(ANSWER)
    const runs = runsOver({ agentFor: () => agent, documentFor: () => DOC })

    await drain(runs.run({ ...ITERATE, selectedComponentId: null }))

    expect(agent.prompts[0]).toContain('No Component is selected')
  })

  it('runs the iteration in the active workspace, never reading the Spec again', async () => {
    const agentFor = vi.fn(() => agentAnswering(ANSWER))
    const readSpec = vi.fn().mockResolvedValue('# spec')
    const runs = runsOver({
      agentFor,
      readSpec,
      workspace: () => '/outro-ws',
      documentFor: () => DOC
    })

    await drain(runs.run(ITERATE))

    expect(agentFor).toHaveBeenCalledWith('/outro-ws')
    expect(readSpec).not.toHaveBeenCalled()
  })
})
