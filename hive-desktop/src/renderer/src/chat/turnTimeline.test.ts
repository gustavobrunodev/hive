import { describe, expect, it } from 'vitest'
import {
  answerTurnApproval,
  appendTurnApproval,
  appendTurnText,
  applyTurnTool,
  hasPendingApproval,
  settleTurnBlocks,
  trailingTurnText,
  turnText,
  type TurnBlock
} from './turnTimeline'

/** Compact shape of a timeline, for asserting order without the payloads. */
function shapeOf(blocks: TurnBlock[]): string[] {
  return blocks.map((block) =>
    block.kind === 'tools'
      ? `tools(${block.activities.map((a) => a.name).join(',')})`
      : block.kind === 'approval'
        ? `approval(${block.request.tool})`
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
