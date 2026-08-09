import { describe, expect, it } from 'vitest'
import type {
  CapabilityViolation,
  Command,
  CommandLog,
  OperationError,
  ScreenDocument,
  ScreenNode
} from './types'

/**
 * These are *type* tests first and runtime tests second: the assertions that
 * matter are the `@ts-expect-error` comments, which `npm run typecheck` fails
 * on if the error they claim ever stops happening. `tsconfig.node.json`
 * includes `src/main/**`, so this file is typechecked with the shipping code.
 *
 * The runtime `expect`s pin the discriminants — the strings every surface
 * switches on — so a rename can't slip through as "just a type change".
 */

describe('design studio document types', () => {
  it('models a screen as a tree of catalog-tagged nodes', () => {
    const node: ScreenNode = {
      id: 'n1',
      tag: 'wa-card',
      props: { appearance: 'outlined', pill: true, tabindex: 0 },
      children: [{ id: 'n2', tag: 'wa-button', props: {}, slot: 'footer', children: [] }]
    }
    const doc: ScreenDocument = { screenId: 's1', title: 'Login', root: node }

    expect(doc.root?.children[0].slot).toBe('footer')
    expect(doc.root?.props.appearance).toBe('outlined')
  })

  it('models an empty screen as a null root', () => {
    const doc: ScreenDocument = { screenId: 's1', title: 'Login', root: null }
    expect(doc.root).toBeNull()
  })

  // AD-2 / DS-R9 AC-2: exactly one field change per SetProp.
  it('builds a SetProp from exactly one field change', () => {
    const command: Command = { type: 'SetProp', componentId: 'n1', key: 'variant', value: 'brand' }
    expect(command).toEqual({
      type: 'SetProp',
      componentId: 'n1',
      key: 'variant',
      value: 'brand'
    })
  })

  it('lets SetProp carry null to remove a prop', () => {
    const command: Command = { type: 'SetProp', componentId: 'n1', key: 'variant', value: null }
    expect(command.type === 'SetProp' && command.value).toBeNull()
  })

  it('rejects a SetProp that carries a bag of props instead of one change', () => {
    const command: Command = {
      type: 'SetProp',
      componentId: 'n1',
      key: 'variant',
      value: 'brand',
      // @ts-expect-error — DS-R9 AC-2: SetProp carries one field change, never a props bag
      props: { variant: 'brand', size: 'large' }
    }
    expect(command.type).toBe('SetProp')
  })

  it('rejects a SetProp with no key/value pair at all', () => {
    // @ts-expect-error — a props bag is not a substitute for { key, value }
    const command: Command = { type: 'SetProp', componentId: 'n1', props: { variant: 'brand' } }
    expect(command.type).toBe('SetProp')
  })

  it('closes the Command union against an invented command type', () => {
    // @ts-expect-error — the vocabulary is closed (AD-2): no fifth command
    const command: Command = { type: 'ReplaceTree', root: null }
    expect(command).toBeTruthy()
  })

  it('groups log entries by groupId behind a cursor', () => {
    const log: CommandLog = {
      entries: [
        { command: { type: 'RemoveComponent', componentId: 'n2' }, groupId: 'g1', at: 1 },
        {
          command: { type: 'SetProp', componentId: 'n1', key: 'variant', value: 'brand' },
          groupId: 'g2',
          at: 2
        }
      ],
      cursor: 2
    }
    expect(log.entries.map((entry) => entry.groupId)).toEqual(['g1', 'g2'])
    expect(log.cursor).toBe(2)
  })
})

// DS-R17: two failure shapes, never a third.
describe('design studio failure shapes', () => {
  it('reports a catalog mismatch as a CapabilityViolation', () => {
    const violation: CapabilityViolation = {
      kind: 'capability',
      componentId: 'n1',
      reason: 'variant fora do catálogo',
      attemptedValue: 'roxo'
    }
    expect(violation.kind).toBe('capability')
  })

  it('reports an out-of-document failure as a retryable OperationError', () => {
    const error: OperationError = {
      kind: 'operation',
      scope: 'agent',
      message: 'sessão indisponível',
      retryable: true
    }
    expect(error.kind).toBe('operation')
    expect(error.scope).toBe('agent')
  })

  it('closes OperationError scope against a third failure family', () => {
    const error: OperationError = {
      kind: 'operation',
      // @ts-expect-error — DS-R17: only agent | preview | export | io
      scope: 'network',
      message: '',
      retryable: false
    }
    expect(error.kind).toBe('operation')
  })
})
