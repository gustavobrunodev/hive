import { mkdirSync, renameSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { ScreenDocument } from './types'
import type { DesignSystemAdapter } from './dsAdapter/types'

/**
 * Design Studio (M18) — T7.2. One Tela, one `.html` on disk (DS-R14).
 *
 * This file chooses a filename and writes bytes. **It builds no markup** — the
 * document comes whole from `adapter.renderToStaticHtml()`, the single producer
 * (AD-6, D-DS-1), and `moduleBoundaries.test.ts` fails the suite if a string
 * that opens an element ever appears here. That guard is the point: the moment
 * the exporter learns to assemble even a wrapper, the artifact the user hands
 * on can drift from the Preview they approved, and the drift is invisible until
 * it is somebody else's problem.
 *
 * "Self-contained" is a property of that one document (bundle + CSS + icons
 * inline, zero network — proven in `e2e/design-studio-export.spec.ts` with the
 * network off), so there is nothing to copy alongside the file: the export is
 * literally one write.
 */

/** What a successful export produced. */
export interface ExportedScreen {
  screenId: string
  title: string
  /** Absolute path of the file written. */
  file: string
}

const MAX_SLUG_LENGTH = 60

/**
 * A Tela's title as a filename stem.
 *
 * Titles come from a UX Spec's headings, which is free prose: accents, slashes,
 * `..`, emoji, or nothing at all. Everything outside `[a-z0-9-]` becomes a
 * hyphen, so the result can never carry a path separator and can never be a
 * relative traversal — the file always lands in `outDir` and nowhere else.
 */
export function screenSlug(document: ScreenDocument): string {
  const slug = (source: string): string =>
    source
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, MAX_SLUG_LENGTH)
      .replace(/-+$/g, '')
  return slug(document.title) || slug(document.screenId) || 'tela'
}

/**
 * Writes one Tela's Bundle into `outDir` and returns where it landed.
 *
 * `fileName` is passed in rather than derived here because a batch has to keep
 * two Telas with the same title apart (T7.3); a lone export is simply a batch
 * of one that never had a collision.
 *
 * Rendering happens **before** the file is opened, so a Screen the adapter
 * refuses (a Component the DS does not have) throws with nothing written —
 * there is no half-file for the caller to discover later.
 *
 * The write is temp-then-rename, on the `sessionStore.ts` mold: an export is
 * something the user hands to another tool, and a truncated `.html` that looks
 * finished is worse than no file at all.
 */
export function exportScreen(
  adapter: DesignSystemAdapter,
  document: ScreenDocument,
  outDir: string,
  fileName: string = `${screenSlug(document)}.html`
): ExportedScreen {
  const html = adapter.renderToStaticHtml(document)
  mkdirSync(outDir, { recursive: true })
  const file = join(outDir, fileName)
  const temp = `${file}.tmp`
  writeFileSync(temp, html, 'utf-8')
  renameSync(temp, file)
  return { screenId: document.screenId, title: document.title, file }
}
