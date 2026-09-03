import { describe, expect, it } from 'vitest'
import {
  answerAllPendingApprovals,
  answerTurnApproval,
  appendTurnApproval,
  appendTurnMcp,
  appendTurnText,
  appendTurnThought,
  applyTurnTool,
  hasPendingApproval,
  rosterSignature,
  settleTurnBlocks,
  trailingTurnText,
  turnText,
  type McpServerReport,
  type TurnBlock
} from './turnTimeline'

/** Compact shape of a timeline, for asserting order without the payloads. */
function shapeOf(blocks: TurnBlock[]): string[] {
  return blocks.map((block) =>
    block.kind === 'tools'
      ? `tools(${block.activities.map((a) => a.name).join(',')})`
      : block.kind === 'approval'
        ? `approval(${block.request.tool})`
        : block.kind === 'mcp'
          ? `mcp(${block.servers.map((server) => `${server.name}:${server.status}`).join(',')})`
          : `text(${block.text})`
  )
}

const approval = (requestId: string, tool = 'Bash'): Parameters<typeof appendTurnApproval>[1] => ({
  requestId,
  tool,
  answer: null
})

describe('turn timeline order', () => {
  it('keeps text, tool calls and permission cards in the order the agent produced them', () => {
    let blocks: TurnBlock[] = []
    blocks = appendTurnText(blocks, 'Vou criar a pasta. ')
    blocks = appendTurnApproval(blocks, approval('req-1'))
    blocks = applyTurnTool(blocks, {
      name: 'Bash',
      detail: 'mkdir -p out',
      toolId: 't1',
      phase: 'start'
    })
    blocks = applyTurnTool(blocks, { name: '', toolId: 't1', phase: 'end', ok: true })
    blocks = appendTurnText(blocks, 'Pronto.')

    // This is the whole point: the question precedes the work, and the work
    // precedes the conclusion — nothing hoisted, nothing pinned to the bottom.
    expect(shapeOf(blocks)).toEqual([
      'text(Vou criar a pasta. )',
      'approval(Bash)',
      'tools(Bash)',
      'text(Pronto.)'
    ])
  })

  it('merges a burst of tool calls into one group, and reopens a group after prose interrupts', () => {
    let blocks: TurnBlock[] = []
    blocks = applyTurnTool(blocks, { name: 'Read', toolId: 'a', phase: 'start' })
    blocks = applyTurnTool(blocks, { name: 'Grep', toolId: 'b', phase: 'start' })
    blocks = appendTurnText(blocks, 'Encontrei.')
    blocks = applyTurnTool(blocks, { name: 'Edit', toolId: 'c', phase: 'start' })

    expect(shapeOf(blocks)).toEqual(['tools(Read,Grep)', 'text(Encontrei.)', 'tools(Edit)'])
  })

  it('accretes streamed chunks into the trailing text block instead of one block per token', () => {
    let blocks: TurnBlock[] = []
    blocks = appendTurnText(blocks, 'Olá')
    blocks = appendTurnText(blocks, ', mundo')
    expect(blocks).toHaveLength(1)
    expect(turnText(blocks)).toBe('Olá, mundo')
    // Empty chunks never open a block (the CLI emits them at turn boundaries).
    expect(appendTurnText(blocks, '')).toBe(blocks)
  })
})

describe('settling tool rows across groups', () => {
  it('settles a row in an earlier group when its result lands after more prose', () => {
    let blocks: TurnBlock[] = []
    blocks = applyTurnTool(blocks, { name: 'Bash', toolId: 'slow', phase: 'start' })
    blocks = appendTurnText(blocks, 'enquanto isso…')
    blocks = applyTurnTool(blocks, { name: 'Read', toolId: 'quick', phase: 'start' })
    blocks = applyTurnTool(blocks, { name: '', toolId: 'slow', phase: 'end', ok: false })

    const first = blocks[0]
    expect(first.kind === 'tools' && first.activities[0].state).toBe('failed')
    const second = blocks[2]
    expect(second.kind === 'tools' && second.activities[0].state).toBe('running')
  })

  it('drops a result that pairs with nothing rather than inventing a row', () => {
    const blocks = appendTurnText([], 'oi')
    expect(applyTurnTool(blocks, { name: '', toolId: 'ghost', phase: 'end', ok: true })).toBe(
      blocks
    )
  })

  it('leaves nothing spinning when the turn ends, and refuses an unanswered permission', () => {
    let blocks: TurnBlock[] = []
    blocks = applyTurnTool(blocks, { name: 'Bash', toolId: 'x', phase: 'start' })
    blocks = appendTurnApproval(blocks, approval('req-open'))
    expect(hasPendingApproval(blocks)).toBe(true)

    const settled = settleTurnBlocks(blocks, 'failed')
    const tools = settled[0]
    expect(tools.kind === 'tools' && tools.activities[0].state).toBe('failed')
    // A card the user can no longer answer must not keep offering buttons.
    expect(hasPendingApproval(settled)).toBe(false)
    const card = settled[1]
    expect(card.kind === 'approval' && card.request.answer).toBe('deny')
  })

  it('returns the same list when a settle would change nothing', () => {
    const blocks = appendTurnText([], 'só texto')
    expect(settleTurnBlocks(blocks, 'ok')).toBe(blocks)
  })
})

describe('permission blocks', () => {
  it('records the verdict in place and ignores a duplicate request id', () => {
    let blocks = appendTurnApproval([], approval('req-1', 'WebFetch'))
    blocks = appendTurnApproval(blocks, approval('req-1', 'WebFetch'))
    expect(blocks).toHaveLength(1)

    const answered = answerTurnApproval(blocks, 'req-1', 'allow-always')
    const card = answered[0]
    expect(card.kind === 'approval' && card.request.answer).toBe('allow-always')
    expect(hasPendingApproval(answered)).toBe(false)
    // An unknown id is a no-op, not a crash: the card may have outlived its turn.
    expect(answerTurnApproval(answered, 'nope', 'allow')).toBe(answered)
  })

  it('the session grant answers every card still open, and leaves settled ones alone', () => {
    let blocks = appendTurnApproval([], approval('req-1', 'Bash'))
    blocks = appendTurnApproval(blocks, approval('req-2', 'WebFetch'))
    blocks = answerTurnApproval(blocks, 'req-1', 'deny')

    const all = answerAllPendingApprovals(blocks, 'allow-session')
    const [first, second] = all
    // A decision already made is a record, not a card to re-answer.
    expect(first.kind === 'approval' && first.request.answer).toBe('deny')
    expect(second.kind === 'approval' && second.request.answer).toBe('allow-session')
    expect(hasPendingApproval(all)).toBe(false)
    // Nothing pending → the same list, so React sees no change to re-render.
    expect(answerAllPendingApprovals(all, 'allow-session')).toBe(all)
  })
})

describe('trailingTurnText', () => {
  it('is the block still being written, and null while the turn ends on work', () => {
    let blocks = appendTurnText([], 'primeiro')
    expect(trailingTurnText(blocks)).toBe('primeiro')
    blocks = applyTurnTool(blocks, { name: 'Read', toolId: 'r', phase: 'start' })
    expect(trailingTurnText(blocks)).toBeNull()
    blocks = appendTurnText(blocks, 'segundo')
    // Only the tail streams; the earlier prose is settled and renders whole.
    expect(trailingTurnText(blocks)).toBe('segundo')
    expect(turnText(blocks)).toBe('primeirosegundo')
  })
})

/**
 * mcp-visibility: the turn's MCP handshake as a block, and the signature that
 * decides whether it is worth announcing at all.
 */
describe('appendTurnMcp', () => {
  const server = (
    name: string,
    status: McpServerReport['status'] = 'connected'
  ): McpServerReport => ({ name, status, tools: [] })

  it('opens a block at the point in the turn where the handshake happened', () => {
    const blocks = appendTurnMcp([], [server('playwright')])
    expect(shapeOf(blocks)).toEqual(['mcp(playwright:connected)'])
  })

  it('appends nothing for a turn with no MCP servers', () => {
    const blocks: TurnBlock[] = []
    expect(appendTurnMcp(blocks, [])).toBe(blocks)
  })

  it('replaces rather than stacks — one handshake per turn', () => {
    const first = appendTurnMcp([], [server('playwright')])
    const second = appendTurnMcp(first, [server('playwright', 'failed')])
    expect(shapeOf(second)).toEqual(['mcp(playwright:failed)'])
    // The id survives the replacement, so React does not remount the row.
    expect(second[0].id).toBe(first[0].id)
  })

  it('keeps its place when text and tools arrive after it', () => {
    let blocks = appendTurnMcp([], [server('playwright')])
    blocks = appendTurnText(blocks, 'vou navegar')
    blocks = appendTurnMcp(blocks, [server('playwright'), server('pencil')])
    expect(shapeOf(blocks)).toEqual([
      'mcp(playwright:connected,pencil:connected)',
      'text(vou navegar)'
    ])
  })
})

describe('rosterSignature', () => {
  const server = (
    name: string,
    status: McpServerReport['status'] = 'connected'
  ): McpServerReport => ({ name, status, tools: [] })

  it('is stable across order, so a reshuffled roster is not treated as news', () => {
    expect(rosterSignature([server('a'), server('b')])).toBe(
      rosterSignature([server('b'), server('a')])
    )
  })

  it('changes when a status changes', () => {
    expect(rosterSignature([server('a')])).not.toBe(rosterSignature([server('a', 'failed')]))
  })

  it('changes when a server appears or disappears', () => {
    expect(rosterSignature([server('a')])).not.toBe(rosterSignature([server('a'), server('b')]))
  })

  it('ignores the tool list — a new tool is not news for a transcript', () => {
    expect(rosterSignature([{ name: 'a', status: 'connected', tools: ['x'] }])).toBe(
      rosterSignature([{ name: 'a', status: 'connected', tools: ['x', 'y'] }])
    )
  })
})

describe('reasoning blocks (thought events)', () => {
  it('merges consecutive thoughts into one block', () => {
    let blocks = appendTurnThought([], 'Preciso ', 1000)
    blocks = appendTurnThought(blocks, 'ler o arquivo.', 1200)

    expect(blocks).toEqual([
      // One block, and it keeps the moment the *first* thought arrived — that
      // start is what the settled row's duration is measured from.
      { kind: 'thinking', id: 'thinking-0', text: 'Preciso ler o arquivo.', startedAt: 1000 }
    ])
  })

  it('records how long a stretch of reasoning lasted when it settles', () => {
    const blocks = appendTurnText(appendTurnThought([], 'pensando', 1000), 'Pronto.', 4500)

    expect(blocks[0]).toMatchObject({ kind: 'thinking', settled: true, ms: 3500 })
  })

  it('settles the reasoning block the moment the reply starts', () => {
    // The whole collapse behaviour hangs off this: reasoning earns space while
    // it is the only thing happening, and gives it back when the answer comes.
    let blocks = appendTurnThought([], 'pensando…')
    blocks = appendTurnText(blocks, 'A resposta é 42.')

    expect(blocks[0]).toMatchObject({ kind: 'thinking', settled: true })
    expect(blocks[1]).toMatchObject({ kind: 'text', text: 'A resposta é 42.' })
  })

  it('settles it when the agent reaches for a tool instead', () => {
    let blocks = appendTurnThought([], 'vou ler o arquivo')
    blocks = applyTurnTool(blocks, { name: 'Read', toolId: 't1', phase: 'start' })

    expect(blocks[0]).toMatchObject({ kind: 'thinking', settled: true })
    expect(blocks[1]).toMatchObject({ kind: 'tools' })
  })

  it('opens a second block for reasoning that resumes after prose', () => {
    // Reopening the closed one would move earlier thinking below later text.
    let blocks = appendTurnThought([], 'primeiro')
    blocks = appendTurnText(blocks, 'Vou verificar.')
    blocks = appendTurnThought(blocks, 'segundo')

    expect(blocks.map((block) => block.kind)).toEqual(['thinking', 'text', 'thinking'])
    expect(blocks[2]).toMatchObject({ kind: 'thinking', id: 'thinking-2', text: 'segundo' })
    expect(blocks[2]).not.toHaveProperty('settled')
  })

  it('keeps reasoning out of the turn’s saved text', () => {
    // `turnText` is what gets persisted. Reasoning is working-out, not the
    // product, and must never be stored as the reply.
    let blocks = appendTurnThought([], 'deliberando em voz alta')
    blocks = appendTurnText(blocks, 'Resposta final.')

    expect(turnText(blocks)).toBe('Resposta final.')
  })

  it('closes an open reasoning block when the turn is settled', () => {
    // An interrupted turn must not leave the live block breathing forever.
    const blocks = settleTurnBlocks(appendTurnThought([], 'pensando…'), 'failed')

    expect(blocks[0]).toMatchObject({ kind: 'thinking', settled: true })
  })
})
