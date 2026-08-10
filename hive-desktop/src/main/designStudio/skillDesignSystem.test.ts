import { describe, expect, it } from 'vitest'
import {
  RESPONSE_CONTRACT,
  buildGeneratePrompt,
  buildIteratePrompt,
  createDesignSkill,
  describeCatalog,
  describeScope,
  parseSkillResponse,
  type SkillAgent,
  type SkillBatch,
  type StudioSkillEvent
} from './skillDesignSystem'
import type { AgentEvent } from '../agentAdapter'
import type { ComponentCatalog, OperationError } from './types'

/**
 * design-studio T6.1 — DS-R11 AC-2 / DS-R2, and the spec's Edge Case "Skill
 * devolve JSON malformado → `OperationError` (não `CapabilityViolation`)".
 *
 * The distinction between the two failure shapes is the whole point of this
 * file, so every refusal here is asserted as a **complete object**, not merely
 * as "something came back": a `CapabilityViolation` with the same message would
 * pass a `toBeTruthy` and would be exactly the bug.
 */

const CATALOG: ComponentCatalog = {
  dsId: 'web-awesome',
  version: '3.11.0',
  components: [
    {
      tag: 'wa-button',
      slots: ['', 'start'],
      props: [
        {
          name: 'variant',
          kind: 'enum',
          values: ['neutral', 'brand', 'success', 'warning', 'danger'],
          group: 'appearance'
        },
        { name: 'disabled', kind: 'boolean', group: 'state' }
      ]
    },
    { tag: 'wa-divider', slots: [], props: [] }
  ]
}

function asError(result: SkillBatch | OperationError): OperationError {
  return result as OperationError
}

describe('skillDesignSystem — the prompt contract is (Spec + catálogo) (DS-R2, DS-R13)', () => {
  it('writes every catalog tag, its slots and each prop with its exact domain', () => {
    const described = describeCatalog(CATALOG)

    expect(described).toContain('wa-button')
    expect(described).toContain('wa-divider')
    expect(described).toContain('variant: neutral | brand | success | warning | danger')
    expect(described).toContain('disabled: boolean')
    expect(described).toContain('slots: (default), start')
    expect(described).toContain('web-awesome 3.11.0')
  })

  it('survives an enum row that arrived off disk with no values, rather than throwing', () => {
    // The catalog is a JSON file built at package time (D-DS-5); an enum whose
    // values did not survive the build must degrade to "no values offered",
    // never to a prompt that cannot be composed at all.
    const described = describeCatalog({
      dsId: 'web-awesome',
      version: '3.11.0',
      components: [
        {
          tag: 'wa-badge',
          slots: [''],
          props: [{ name: 'variant', kind: 'enum', group: 'appearance' }]
        }
      ]
    })

    expect(described).toContain('variant: ')
    expect(described).toContain('wa-badge')
  })

  it('carries the Spec verbatim, the Tela being generated, and the catalog', () => {
    const prompt = buildGeneratePrompt({
      specText: '## Tela — Login\nUm campo de e-mail e um botão de entrar.',
      screenTitle: 'Login',
      catalog: CATALOG
    })

    expect(prompt).toContain('Um campo de e-mail e um botão de entrar.')
    expect(prompt).toContain('Login')
    expect(prompt).toContain('variant: neutral | brand | success | warning | danger')
    expect(prompt).toContain(RESPONSE_CONTRACT)
  })

  it('forbids markup and fences in the same terms the parser enforces', () => {
    expect(RESPONSE_CONTRACT).toContain('no code fences')
    expect(RESPONSE_CONTRACT).toContain('no HTML')
    expect(RESPONSE_CONTRACT).toContain('{"commands": Command[], "message": string}')
  })
})

describe('skillDesignSystem — the strict parse accepts the envelope (DS-R11 AC-2)', () => {
  it('returns the Commands and the message from a well-formed answer', () => {
    const result = parseSkillResponse(
      JSON.stringify({
        commands: [
          {
            type: 'AddComponent',
            parentId: null,
            index: 0,
            node: {
              id: 'n1',
              tag: 'wa-button',
              props: { variant: 'brand', disabled: false },
              children: []
            }
          },
          { type: 'SetProp', componentId: 'n1', key: 'variant', value: null }
        ],
        message: 'Adicionei o botão principal.'
      })
    )

    expect(result).toEqual({
      commands: [
        {
          type: 'AddComponent',
          parentId: null,
          index: 0,
          node: {
            id: 'n1',
            tag: 'wa-button',
            props: { variant: 'brand', disabled: false },
            children: []
          }
        },
        { type: 'SetProp', componentId: 'n1', key: 'variant', value: null }
      ],
      message: 'Adicionei o botão principal.'
    })
  })

  it('accepts nested nodes and the three remaining Command types', () => {
    const result = parseSkillResponse(
      JSON.stringify({
        commands: [
          {
            type: 'AddComponent',
            parentId: 'root',
            slot: 'start',
            index: 1,
            node: {
              id: 'n2',
              tag: 'wa-button',
              props: {},
              slot: 'start',
              children: [{ id: 'n3', tag: 'wa-divider', props: {}, children: [] }]
            }
          },
          { type: 'MoveComponent', componentId: 'n3', newParentId: 'root', index: 0 },
          { type: 'RemoveComponent', componentId: 'n2' }
        ]
      })
    )

    expect((result as SkillBatch).commands).toHaveLength(3)
    // An absent `message` is the empty string, not `undefined` — the chat
    // renders it either way rather than printing "undefined".
    expect((result as SkillBatch).message).toBe('')
  })

  it('accepts an empty batch — the limitation answer of DS-R11 AC-5', () => {
    const result = parseSkillResponse(
      '{"commands": [], "message": "O DS ativo não tem um seletor de data."}'
    )

    expect(result).toEqual({
      commands: [],
      message: 'O DS ativo não tem um seletor de data.'
    })
  })
})

describe('skillDesignSystem — a refused answer is an OperationError, never a CapabilityViolation', () => {
  it('refuses markup outright', () => {
    const result = parseSkillResponse('<div class="login"><button>Entrar</button></div>')

    expect(result).toEqual({
      kind: 'operation',
      scope: 'agent',
      message:
        'O agente respondeu com markup. O contrato da Skill é um único objeto JSON — nenhum HTML é aceito.',
      retryable: true
    })
    expect(asError(result).kind).not.toBe('capability')
  })

  it('refuses malformed JSON as an OperationError — a bad turn is not a catalog mismatch', () => {
    const result = parseSkillResponse('{"commands": [')

    expect(result).toEqual({
      kind: 'operation',
      scope: 'agent',
      message: 'A resposta do agente não é JSON válido.',
      retryable: true
    })
    expect(asError(result).kind).not.toBe('capability')
  })

  it('refuses an empty turn', () => {
    expect(parseSkillResponse('   \n ')).toEqual({
      kind: 'operation',
      scope: 'agent',
      message: 'O agente terminou o turno sem responder nada.',
      retryable: true
    })
  })

  it('refuses a fenced answer — the contract says JSON only', () => {
    const result = parseSkillResponse('```json\n{"commands": []}\n```')

    expect(asError(result).kind).toBe('operation')
    expect(asError(result).message).toBe('A resposta do agente não é JSON válido.')
  })

  it('refuses anything that is not the envelope', () => {
    const envelopeMessage =
      'A resposta do agente não tem a forma { "commands": [...], "message": "..." }.'

    expect(asError(parseSkillResponse('[]')).message).toBe(envelopeMessage)
    expect(asError(parseSkillResponse('"pronto"')).message).toBe(envelopeMessage)
    expect(asError(parseSkillResponse('{"commands": {}}')).message).toBe(envelopeMessage)
    expect(asError(parseSkillResponse('{}')).message).toBe(envelopeMessage)
    expect(asError(parseSkillResponse('{"commands": [], "message": 7}')).message).toBe(
      envelopeMessage
    )
  })

  it('refuses a Command outside the closed vocabulary, naming its position', () => {
    const result = parseSkillResponse(
      '{"commands": [{"type":"RemoveComponent","componentId":"n1"},{"type":"SetStyle","css":"color:red"}]}'
    )

    expect(result).toEqual({
      kind: 'operation',
      scope: 'agent',
      message: 'O Command na posição 1 não pertence ao vocabulário fechado do Design Studio.',
      retryable: true
    })
  })

  it('refuses a Command of a known type whose fields are wrong', () => {
    const cases = [
      '{"commands": [{"type":"SetProp","componentId":"n1"}]}',
      '{"commands": [{"type":"SetProp","componentId":"n1","key":"variant","value":{"a":1}}]}',
      '{"commands": [{"type":"AddComponent","parentId":null,"index":-1,"node":{"id":"n1","tag":"wa-button","props":{},"children":[]}}]}',
      '{"commands": [{"type":"AddComponent","parentId":null,"index":0,"node":{"id":"","tag":"wa-button","props":{},"children":[]}}]}',
      '{"commands": [{"type":"AddComponent","parentId":null,"index":0,"node":{"id":"n1","tag":"","props":{},"children":[]}}]}',
      '{"commands": [{"type":"AddComponent","parentId":null,"index":0,"node":{"id":"n1","tag":"wa-button","props":{"x":{"deep":1}},"children":[]}}]}',
      '{"commands": [{"type":"AddComponent","parentId":null,"index":0,"node":{"id":"n1","tag":"wa-button","props":{},"children":[{"id":"n2"}]}}]}',
      '{"commands": [{"type":"AddComponent","parentId":null,"index":0,"node":null}]}',
      '{"commands": [{"type":"MoveComponent","componentId":"n1","newParentId":"n2","index":"first"}]}',
      '{"commands": [{"type":"MoveComponent","componentId":"n1","newParentId":"n2","slot":3,"index":0}]}',
      '{"commands": [{"type":"AddComponent","parentId":7,"index":0,"node":{"id":"n1","tag":"wa-button","props":{},"children":[]}}]}',
      '{"commands": [{"type":"AddComponent","parentId":null,"index":0,"node":{"id":"n1","tag":"wa-button","props":[],"children":[]}}]}',
      '{"commands": [{"type":42,"componentId":"n1"}]}',
      '{"commands": [null]}'
    ]

    for (const raw of cases) {
      expect(asError(parseSkillResponse(raw))).toEqual({
        kind: 'operation',
        scope: 'agent',
        message: 'O Command na posição 0 não pertence ao vocabulário fechado do Design Studio.',
        retryable: true
      })
    }
  })
})

/**
 * design-studio T6.2 — DS-R2. The turn as the stage sees it: never a silent
 * gap, and never a Component the catalog does not have.
 *
 * The agent is a scripted fake, in the repo's own injectable style — no CLI is
 * spawned, so the suite stays hermetic and the *ordering* of what the user sees
 * is what is under test.
 */

/** A `SkillAgent` whose turn is a script of `AgentEvent`s, replayed on `send`. */
function scriptedAgent(script: AgentEvent[]): SkillAgent & { prompts: string[] } {
  const listeners = new Set<(event: AgentEvent) => void>()
  const prompts: string[] = []
  return {
    prompts,
    send(prompt: string, turnId: string): void {
      prompts.push(prompt)
      for (const event of script) {
        for (const listener of listeners) listener({ ...event, turnId })
      }
    },
    onEvent(listener: (event: AgentEvent) => void): () => void {
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

const GENERATE = { specText: '## Tela — Login', screenTitle: 'Login', catalog: CATALOG }

const ANSWER = JSON.stringify({
  commands: [
    {
      type: 'AddComponent',
      parentId: null,
      index: 0,
      node: { id: 'n1', tag: 'wa-button', props: { variant: 'brand' }, children: [] }
    }
  ],
  message: 'Compus a Tela com um botão.'
})

describe('createDesignSkill — generateScreen keeps the wait covered (DS-R2)', () => {
  it('reports a status before the turn starts, then on tooling, then on writing', async () => {
    const agent = scriptedAgent([
      { type: 'tool', name: 'Read', phase: 'start' },
      { type: 'token', text: ANSWER },
      { type: 'done' }
    ])

    const seen = await drain(createDesignSkill(agent).generateScreen(GENERATE))

    expect(seen.slice(0, 3)).toEqual([
      { type: 'status', phase: 'reading' },
      { type: 'status', phase: 'choosing' },
      { type: 'status', phase: 'composing' }
    ])
  })

  it('ends the turn with the parsed batch', async () => {
    const agent = scriptedAgent([{ type: 'token', text: ANSWER }, { type: 'done' }])

    const seen = await drain(createDesignSkill(agent).generateScreen(GENERATE))

    expect(seen.at(-1)).toEqual({
      type: 'result',
      batch: {
        commands: [
          {
            type: 'AddComponent',
            parentId: null,
            index: 0,
            node: { id: 'n1', tag: 'wa-button', props: { variant: 'brand' }, children: [] }
          }
        ],
        message: 'Compus a Tela com um botão.'
      }
    })
  })

  it('sends the catalog and the Spec in the prompt — the generation has no other source of tags', async () => {
    const agent = scriptedAgent([{ type: 'token', text: ANSWER }, { type: 'done' }])

    await drain(createDesignSkill(agent).generateScreen(GENERATE))

    expect(agent.prompts).toHaveLength(1)
    expect(agent.prompts[0]).toContain('## Tela — Login')
    expect(agent.prompts[0]).toContain('wa-button')
    expect(agent.prompts[0]).toContain('These are the ONLY Components that exist.')
  })

  it('joins a streamed answer across tokens before parsing it', async () => {
    const agent = scriptedAgent([
      { type: 'token', text: '{"commands": [], ' },
      { type: 'token', text: '"message": "nada a fazer"}' },
      { type: 'done' }
    ])

    const seen = await drain(createDesignSkill(agent).generateScreen(GENERATE))

    expect(seen.at(-1)).toEqual({
      type: 'result',
      batch: { commands: [], message: 'nada a fazer' }
    })
  })

  it('turns a failing session into an OperationError the chat can retry (DS-R10 AC-6)', async () => {
    const agent = scriptedAgent([{ type: 'error', message: 'claude: command not found' }])

    const seen = await drain(createDesignSkill(agent).generateScreen(GENERATE))

    expect(seen.at(-1)).toEqual({
      type: 'failed',
      error: {
        kind: 'operation',
        scope: 'agent',
        message: 'claude: command not found',
        retryable: true
      }
    })
  })

  it('reports a malformed answer as failed, not as a result to apply', async () => {
    const agent = scriptedAgent([
      { type: 'token', text: '<section>Login</section>' },
      { type: 'done' }
    ])

    const seen = await drain(createDesignSkill(agent).generateScreen(GENERATE))

    expect(seen.at(-1)).toEqual({
      type: 'failed',
      error: {
        kind: 'operation',
        scope: 'agent',
        message:
          'O agente respondeu com markup. O contrato da Skill é um único objeto JSON — nenhum HTML é aceito.',
        retryable: true
      }
    })
  })

  it('ends a stopped turn with no result and no error', async () => {
    const agent = scriptedAgent([{ type: 'token', text: '{"commands":' }, { type: 'interrupted' }])

    const seen = await drain(createDesignSkill(agent).generateScreen(GENERATE))

    expect(seen).toEqual([
      { type: 'status', phase: 'reading' },
      { type: 'status', phase: 'composing' }
    ])
  })

  it('ignores events belonging to another turn', async () => {
    const listeners = new Set<(event: AgentEvent) => void>()
    const agent: SkillAgent = {
      send(_prompt, turnId) {
        for (const listener of listeners) {
          listener({ type: 'token', text: 'lixo de outro turno', turnId: 'outro' })
          listener({ type: 'token', text: ANSWER, turnId })
          listener({ type: 'done', turnId })
        }
      },
      onEvent(listener) {
        listeners.add(listener)
        return () => listeners.delete(listener)
      }
    }

    const seen = await drain(createDesignSkill(agent).generateScreen(GENERATE))

    expect((seen.at(-1) as { type: string }).type).toBe('result')
  })

  it('unsubscribes once the turn has settled, so a late event cannot reopen it', async () => {
    const agent = scriptedAgent([{ type: 'token', text: ANSWER }, { type: 'done' }])
    const unsubscribed: boolean[] = []
    const wrapped: SkillAgent = {
      send: agent.send,
      onEvent(listener) {
        const off = agent.onEvent(listener)
        return () => {
          unsubscribed.push(true)
          off()
        }
      }
    }

    await drain(createDesignSkill(wrapped).generateScreen(GENERATE))

    expect(unsubscribed).toEqual([true])
  })
})

/**
 * The real case: a CLI answers *after* the consumer is already waiting. The
 * scripted agents above deliver inside `send`, which exercises only the
 * producer-ahead path — this one proves the stream also delivers when the
 * reader got there first, which is how every actual turn behaves.
 */
describe('createDesignSkill — a turn whose events arrive later', () => {
  it('delivers status, result and end to a consumer that is already waiting', async () => {
    const listeners = new Set<(event: AgentEvent) => void>()
    const agent: SkillAgent = {
      send(_prompt, turnId) {
        void (async () => {
          for (const event of [
            { type: 'tool', name: 'Read', phase: 'start' },
            { type: 'token', text: ANSWER },
            { type: 'done' }
          ] as AgentEvent[]) {
            await new Promise((resolve) => setTimeout(resolve, 0))
            for (const listener of listeners) listener({ ...event, turnId })
          }
        })()
      },
      onEvent(listener) {
        listeners.add(listener)
        return () => listeners.delete(listener)
      }
    }

    const seen = await drain(createDesignSkill(agent).generateScreen(GENERATE))

    expect(seen.map((event) => event.type)).toEqual(['status', 'status', 'status', 'result'])
  })

  it('ends a stream whose reader is waiting when the turn is interrupted', async () => {
    const listeners = new Set<(event: AgentEvent) => void>()
    const agent: SkillAgent = {
      send(_prompt, turnId) {
        void (async () => {
          await new Promise((resolve) => setTimeout(resolve, 0))
          for (const listener of listeners) listener({ type: 'interrupted', turnId })
        })()
      },
      onEvent(listener) {
        listeners.add(listener)
        return () => listeners.delete(listener)
      }
    }

    const seen = await drain(createDesignSkill(agent).generateScreen(GENERATE))

    expect(seen).toEqual([{ type: 'status', phase: 'reading' }])
  })
})

/**
 * design-studio T6.4 — DS-R10 AC-1: "Havendo seleção no envio, o pedido é
 * interpretado nesse contexto por padrão."
 *
 * The assertion is about the **prompt**, because that is where the requirement
 * either holds or does not: a selection the surface tracks but never sends is
 * a context the Skill cannot act on.
 */
describe('buildIteratePrompt — the selection is the default context (DS-R10 AC-1)', () => {
  const DOC = {
    screenId: 'login',
    title: 'Login',
    root: {
      id: 'n1',
      tag: 'wa-card',
      props: {},
      children: [{ id: 'n2', tag: 'wa-button', props: { variant: 'brand' }, children: [] }]
    }
  }

  it('names the selected Component by tag and id, and instructs the model to scope to it', () => {
    const prompt = buildIteratePrompt({
      message: 'deixe mais discreto',
      document: DOC,
      selectedComponentId: 'n2',
      catalog: CATALOG
    })

    expect(prompt).toContain('The user has <wa-button> (id "n2") selected.')
    expect(prompt).toContain('Interpret the request in that context by default')
    expect(prompt).toContain('deixe mais discreto')
  })

  it('scopes the request to the Tela when nothing is selected', () => {
    const prompt = buildIteratePrompt({
      message: 'deixe mais discreto',
      document: DOC,
      selectedComponentId: null,
      catalog: CATALOG
    })

    expect(prompt).toContain(
      'No Component is selected. The request is about the whole Tela "Login"'
    )
    expect(prompt).not.toContain('selected. Interpret')
  })

  it('falls back to the Tela when the selected id is no longer in the tree', () => {
    expect(describeScope(DOC, 'n9')).toContain('No Component is selected')
    expect(describeScope({ ...DOC, root: null }, 'n1')).toContain('No Component is selected')
  })

  it('carries the current tree so Commands can address real ids', () => {
    const prompt = buildIteratePrompt({
      message: 'troque a cor',
      document: DOC,
      selectedComponentId: 'n2',
      catalog: CATALOG
    })

    expect(prompt).toContain(JSON.stringify(DOC.root))
  })

  it('carries the catalog and the same response contract as generation', () => {
    const prompt = buildIteratePrompt({
      message: 'adicione um divisor',
      document: DOC,
      selectedComponentId: null,
      catalog: CATALOG
    })

    expect(prompt).toContain('variant: neutral | brand | success | warning | danger')
    expect(prompt).toContain(RESPONSE_CONTRACT)
  })
})

describe('createDesignSkill — iterate runs the same turn machinery (DS-R10)', () => {
  it('sends the iteration prompt and parses the answer into a batch', async () => {
    const answer = JSON.stringify({
      commands: [{ type: 'SetProp', componentId: 'n2', key: 'variant', value: 'neutral' }],
      message: 'Deixei o botão neutro.'
    })
    const agent = scriptedAgent([{ type: 'token', text: answer }, { type: 'done' }])

    const seen = await drain(
      createDesignSkill(agent).iterate({
        message: 'deixe mais discreto',
        document: {
          screenId: 'login',
          title: 'Login',
          root: { id: 'n2', tag: 'wa-button', props: {}, children: [] }
        },
        selectedComponentId: 'n2',
        catalog: CATALOG
      })
    )

    expect(agent.prompts[0]).toContain('The user has <wa-button> (id "n2") selected.')
    expect(seen.at(-1)).toEqual({
      type: 'result',
      batch: {
        commands: [{ type: 'SetProp', componentId: 'n2', key: 'variant', value: 'neutral' }],
        message: 'Deixei o botão neutro.'
      }
    })
  })
})
