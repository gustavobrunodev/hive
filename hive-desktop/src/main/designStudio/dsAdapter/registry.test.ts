import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registerDesignSystem, resetDesignSystemRegistry, resolveActiveAdapter } from './registry'
import type { DesignSystemAdapter } from './types'

/** design-studio T2.3 — DS-R12 AC-6: resolved once by the registry, never per Tela. */

function fakeAdapter(id: string): DesignSystemAdapter {
  return { id, catalog: () => ({ dsId: id, version: '0', components: [] }), validate: () => null }
}

beforeEach(() => {
  resetDesignSystemRegistry()
})

describe('the design system registry', () => {
  it('returns the same instance on every call and builds it only once', () => {
    const factory = vi.fn(() => fakeAdapter('fake-ds'))
    registerDesignSystem('fake-ds', factory)

    const first = resolveActiveAdapter('fake-ds')
    const second = resolveActiveAdapter('fake-ds')

    expect(second).toBe(first)
    expect(first.id).toBe('fake-ds')
    expect(factory).toHaveBeenCalledTimes(1)
  })

  it('keeps a separate instance per registered design system', () => {
    registerDesignSystem('one', () => fakeAdapter('one'))
    registerDesignSystem('two', () => fakeAdapter('two'))

    expect(resolveActiveAdapter('one').id).toBe('one')
    expect(resolveActiveAdapter('two').id).toBe('two')
    expect(resolveActiveAdapter('one')).not.toBe(resolveActiveAdapter('two'))
  })

  it('throws for an unregistered id instead of serving a different design system', () => {
    registerDesignSystem('one', () => fakeAdapter('one'))

    expect(() => resolveActiveAdapter('missing')).toThrow(
      /no design system registered for "missing"/
    )
    expect(() => resolveActiveAdapter('missing')).toThrow(/registered: one/)
  })

  it('names no registered design system when the table is empty', () => {
    expect(() => resolveActiveAdapter('anything')).toThrow(/registered: \(none\)/)
  })
})
