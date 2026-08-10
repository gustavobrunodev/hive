/**
 * Design Studio (M18) — T2.3. The Design System **port** (AD-4, DS-R12).
 *
 * This is the whole reason the module survives a change of design system.
 * Every layer that needs to know which Components and props exist — Preview,
 * Inspector, Tree, the Skill's prompt, Export — asks a `DesignSystemAdapter`.
 * None of them imports a DS package, and the T2.7 boundary test fails the suite
 * if one starts to.
 *
 * The port stays deliberately small: an id, the catalog, and the one validation
 * function. `validate()` is singular on purpose — DS-R13 AC-3 says automatic
 * generation and manual editing consult *the same* function, so a second
 * "isValidForInspector" helper would be the bug, not the convenience.
 *
 * `renderToStaticHtml()` (AD-6) is the third and last member: the **single
 * producer of Bundle markup**. It is on the port rather than on the exporter so
 * that "the Export renders through the same adapter the Preview does" is a
 * property of the architecture instead of a convention — a second design system
 * brings its own document format with it, and the exporter never learns.
 */

import type { Command, ComponentCatalog, ScreenDocument } from '../types'
import type { CapabilityViolation } from '../types'

export interface DesignSystemAdapter {
  /** Stable id, persisted in the session so Telas never silently migrate (DS-R12). */
  readonly id: string
  /** The single source of truth for what exists in this DS (DS-R13). */
  catalog(): ComponentCatalog
  /**
   * The one gate a `Command` passes before dispatch. `null` = valid.
   *
   * The reducer never validates (AD-2), so this is the only thing standing
   * between a chat turn and a document containing a Component the DS cannot
   * render.
   */
  validate(command: Command, document: ScreenDocument): CapabilityViolation | null
  /**
   * The Screen as one self-contained HTML document — live components, shadow
   * DOM intact, zero network (D-DS-1, DS-R14 AC-1/2).
   *
   * Throws when the Screen names a Component this design system does not have:
   * the exporter turns that into an `OperationError` scoped to the one Screen
   * (DS-R15) rather than writing a file that renders as nothing.
   */
  renderToStaticHtml(document: ScreenDocument): string
}

/** Builds the adapter. Called at most once per DS id by the registry. */
export type DesignSystemAdapterFactory = () => DesignSystemAdapter
