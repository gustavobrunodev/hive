import { describe, expect, it, vi } from 'vitest'
import { createStudioSkillRuns } from './studioSkillRuns'
import type { SkillAgent, StudioSkillEvent } from './skillDesignSystem'
import type { AgentEvent } from '../agentAdapter'
import type { ComponentCatalog } from './types'

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

async function drain(stream: AsyncIterable<StudioSkillEvent>): Promise<StudioSkillEvent[]> {
  const seen: StudioSkillEvent[] = []
  for await (const event of stream) seen.push(event)
  return seen
}

describe('createStudioSkillRuns — a generate run (DS-R2)', () => {
  it('reads the Spec and hands it, with the active catalog, to the turn', async () => {
    const agent = agentAnswering(ANSWER)
    const readSpec = vi.fn().mockResolvedValue('## Tela — Login\nUm botão de entrar.')
    const runs = createStudioSkillRuns({
      readSpec,
      catalog: () => CATALOG,
      agentFor: () => agent
    })

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
    const runs = createStudioSkillRuns({
      readSpec: () => Promise.resolve('# spec'),
      catalog: () => CATALOG,
      agentFor
    })

    await drain(
      runs.run({ kind: 'generate', workspace: '/ws', specPath: 'ux.md', screenTitle: 'Login' })
    )

    expect(agentFor).toHaveBeenCalledWith('/ws')
  })

  it('reports an unreadable Spec as a retryable io error, and never asks the agent', async () => {
    const agentFor = vi.fn(() => agentAnswering(ANSWER))
    const runs = createStudioSkillRuns({
      readSpec: () => Promise.reject(new Error('ENOENT: no such file')),
      catalog: () => CATALOG,
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
    const runs = createStudioSkillRuns({
      readSpec: () => Promise.reject('disco cheio'),
      catalog: () => CATALOG,
      agentFor: () => agentAnswering(ANSWER)
    })

    const seen = await drain(
      runs.run({ kind: 'generate', workspace: '/ws', specPath: 'ux.md', screenTitle: 'Login' })
    )

    expect((seen[0] as { error: { message: string } }).error.message).toBe('disco cheio')
  })
})
