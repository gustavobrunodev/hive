import { t } from '../i18n'
import type { PatchHunk, PatchLine, ToolPatch } from './toolActivity'

/**
 * The change an editing step is making, drawn where it happened (agent-patch
 * AP-R1).
 *
 * ## What it replaces
 *
 * The activity feed could say *Editando chat/Chat.tsx* and nothing more. Which
 * is the difference between a status line and an answer: a rename and a
 * rewrite produced identical rows, and the only way to tell them apart was to
 * wait for the turn to end and open the review panel. This is the log a coding
 * agent's transcript is supposed to be — you see the lines going in and out as
 * the agent commits to them, not afterwards.
 *
 * ## Three grains of change, three channels
 *
 * The user asked to see what is *removed*, *changed* and *added*, and those
 * are three different questions:
 *
 * - **Added / removed** is the line's own channel: sign, tint, and the number
 *   column jumping (a `-` keeps the old file's number, a `+` takes the new
 *   one's), so which side a line belongs to survives a screenshot and a
 *   grayscale print.
 * - **Changed** is the one a plain patch can't express — a renamed variable
 *   renders as a whole line out and a whole line in, and the reader has to
 *   diff it by eye. `main/toolPatch.ts` pairs those lines and marks the words
 *   that actually differ; here they get the emphasis. That is the difference
 *   between reading a diff and scanning one.
 * - **Scale** is the diffstat: `+12 −3` and a five-segment bar, so a row can
 *   be judged without being opened.
 *
 * ## Density
 *
 * Open by default, because a patch nobody expanded is a patch nobody read —
 * but capped at {@link VISIBLE_LINES}, because eight open edits in one turn
 * would push the reply that explains them off the screen. Past the cap it
 * grows in place, and it never collapses itself back under someone mid-read.
 */

/** Lines shown before the snippet asks to be grown — roughly one hunk plus its context. */
const VISIBLE_LINES = 12

/** Lines that get the entrance stagger; past this they all arrive together. */
const STAGGER_LIMIT = 10

/** The diffstat bar's segment count — GitHub's, and the smallest that still reads as a ratio. */
const BAR_SEGMENTS = 5

interface PatchSnippetProps {
  patch: ToolPatch
  /**
   * The step's own state. A `failed` tool means the patch on screen was
   * *proposed* and never landed — the one case where showing a diff without
   * saying so would be a lie.
   */
  failed?: boolean
  /** DOM id, so the row's toggle can own it via `aria-controls`. */
  id: string
  /** Whether the body is grown past the cap, and how to ask for it. */
  full: boolean
  onToggleFull: () => void
}

/** One flattened render item: a diff line, or the elision between two hunks. */
type Item = { kind: 'line'; line: PatchLine; key: string } | { kind: 'gap'; key: string }

function flatten(hunks: PatchHunk[]): Item[] {
  const items: Item[] = []
  hunks.forEach((hunk, h) => {
    if (h > 0) items.push({ kind: 'gap', key: `gap-${h}` })
    hunk.lines.forEach((line, l) => items.push({ kind: 'line', line, key: `${h}-${l}` }))
  })
  return items
}

/** The `+`/`-`/blank column. Real text, not a pseudo-element: a patch read aloud should still say which side a line is on. */
function signOf(type: PatchLine['type']): string {
  return type === 'add' ? '+' : type === 'del' ? '-' : ' '
}

/**
 * The diffstat — `+12 −3` and the bar.
 *
 * The bar is filled proportionally, but never to zero on a side that has any
 * change at all: a patch of `+240 −1` would round the removal away, and "one
 * line was deleted here" is exactly the fact a reviewer is scanning for.
 */
export function PatchStat({ adds, dels }: { adds: number; dels: number }): React.JSX.Element {
  const total = adds + dels
  let addSegments = total === 0 ? 0 : Math.round((adds / total) * BAR_SEGMENTS)
  if (adds > 0 && addSegments === 0) addSegments = 1
  if (dels > 0 && addSegments === BAR_SEGMENTS) addSegments = BAR_SEGMENTS - 1

  return (
    <span className="wb-patch-stat" aria-hidden="true">
      {adds > 0 && (
        <span className="wb-patch-count" data-kind="add">
          {t('patch.adds', adds)}
        </span>
      )}
      {dels > 0 && (
        <span className="wb-patch-count" data-kind="del">
          {t('patch.dels', dels)}
        </span>
      )}
      <span className="wb-patch-bar">
        {Array.from({ length: BAR_SEGMENTS }, (_, i) => (
          <span key={i} className="wb-patch-seg" data-kind={i < addSegments ? 'add' : 'del'} />
        ))}
      </span>
    </span>
  )
}

/** The `novo` / `reescrito` chip — only where the verb alone would mislead. */
export function PatchOpChip({ patch }: { patch: ToolPatch }): React.JSX.Element | null {
  if (patch.op === 'edit') return null
  return (
    <span className="wb-patch-op" data-op={patch.op}>
      {patch.op === 'create' ? t('patch.opCreate') : t('patch.opRewrite')}
    </span>
  )
}

function PatchCode({ line }: { line: PatchLine }): React.JSX.Element {
  if (!line.spans) return <>{line.text}</>
  return (
    <>
      {line.spans.map((span, i) =>
        span.changed ? (
          <span key={i} className="wb-patch-word">
            {span.text}
          </span>
        ) : (
          <span key={i}>{span.text}</span>
        )
      )}
    </>
  )
}

export function PatchSnippet({
  patch,
  failed,
  id,
  full,
  onToggleFull
}: PatchSnippetProps): React.JSX.Element {
  const items = flatten(patch.hunks)
  const hidden = full ? 0 : Math.max(0, items.length - VISIBLE_LINES)
  const shown = hidden > 0 ? items.slice(0, VISIBLE_LINES) : items

  return (
    <div className="wb-patch" id={id} data-op={patch.op} data-failed={failed || undefined}>
      {failed && <p className="wb-patch-note">{t('patch.notApplied')}</p>}
      <div
        className="wb-patch-code"
        role="group"
        aria-label={t('patch.bodyAria', patch.path, patch.adds, patch.dels)}
      >
        {shown.map((item, i) =>
          item.kind === 'gap' ? (
            <div key={item.key} className="wb-patch-gap" aria-hidden="true" />
          ) : (
            <div
              key={item.key}
              className="wb-patch-line"
              data-type={item.line.type}
              // The entrance follows the line's position, so a patch arrives
              // the way it was written — top down — instead of all at once.
              style={{ ['--patch-i' as string]: String(Math.min(i, STAGGER_LIMIT)) }}
            >
              <span className="wb-patch-no" aria-hidden="true">
                {item.line.no ?? ''}
              </span>
              <span className="wb-patch-sign">{signOf(item.line.type)}</span>
              <code className="wb-patch-text">
                <PatchCode line={item.line} />
              </code>
            </div>
          )
        )}
      </div>
      {(hidden > 0 || full || patch.truncated !== undefined) && (
        <div className="wb-patch-foot">
          {(hidden > 0 || full) && (
            <button type="button" className="wb-patch-more" onClick={onToggleFull}>
              {full ? t('patch.showLess') : t('patch.showMore', hidden)}
            </button>
          )}
          {patch.truncated !== undefined && (
            <span className="wb-patch-truncated">{t('patch.truncated', patch.truncated)}</span>
          )}
        </div>
      )}
    </div>
  )
}
