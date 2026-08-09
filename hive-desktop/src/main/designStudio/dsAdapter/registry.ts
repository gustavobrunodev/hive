/**
 * Design Studio (M18) — T2.3. Resolves the active Design System adapter.
 *
 * DS-R12 AC-6: the adapter is resolved **once**, not once per Tela. That is not
 * a micro-optimisation — the adapter owns a 110 KB catalog read from disk, and
 * an instance per Screen would mean N copies of it plus N chances for two
 * Screens in the same session to disagree about what exists.
 *
 * Which DS is active is configuration (DS-R12): the id travels in, the factory
 * comes from this table, and nothing above the port knows a package name.
 */

import type { DesignSystemAdapter, DesignSystemAdapterFactory } from './types'

const factories = new Map<string, DesignSystemAdapterFactory>()
const resolved = new Map<string, DesignSystemAdapter>()

export function registerDesignSystem(id: string, factory: DesignSystemAdapterFactory): void {
  factories.set(id, factory)
}

/**
 * The active adapter for `dsId`. Repeated calls return the *same* instance.
 *
 * An unregistered id throws rather than falling back to a default: the session
 * records which DS built a Tela, and quietly serving a different one would
 * migrate documents behind the user's back — exactly what DS-R12 forbids.
 */
export function resolveActiveAdapter(dsId: string): DesignSystemAdapter {
  const existing = resolved.get(dsId)
  if (existing) return existing

  const factory = factories.get(dsId)
  if (!factory) {
    throw new Error(
      `[designStudio] no design system registered for "${dsId}" — ` +
        `registered: ${[...factories.keys()].join(', ') || '(none)'}`
    )
  }
  const adapter = factory()
  resolved.set(dsId, adapter)
  return adapter
}

/** Test seam: drops both tables so a suite can register its own fakes. */
export function resetDesignSystemRegistry(): void {
  factories.clear()
  resolved.clear()
}
