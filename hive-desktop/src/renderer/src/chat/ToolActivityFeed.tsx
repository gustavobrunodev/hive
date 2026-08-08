import { useState } from 'react'
import { t } from '../i18n'
import {
  BoltIcon,
  CheckIcon,
  ChevronRightIcon,
  CloseIcon,
  CompassIcon,
  ExternalLinkIcon,
  EyeIcon,
  PencilIcon,
  SearchIcon,
  TerminalIcon,
  ToolsIcon
} from '../ui/icons'
import { PatchOpChip, PatchSnippet, PatchStat } from './PatchSnippet'
import {
  activityElapsed,
  collapseActivities,
  shortenDetail,
  toolKind,
  toolLabel,
  type ToolActivity,
  type ToolKind
} from './toolActivity'
import { formatDuration } from './turnTiming'

/** How many rows stay visible before the feed collapses to its newest ones. */
const VISIBLE_LIMIT = 4

const ICONS: Record<ToolKind, typeof EyeIcon> = {
  read: EyeIcon,
  edit: PencilIcon,
  search: SearchIcon,
  run: TerminalIcon,
  web: CompassIcon,
  task: BoltIcon,
  other: ToolsIcon
}

/**
 * Present participle while it runs, past tense once it's done — the tense IS
 * the state, and it survives being read aloud, screenshotted, or seen by
 * someone who can't tell the spinner from the tick.
 */
const VERBS: Record<ToolKind, string> = {
  read: t('activity.read'),
  edit: t('activity.edit'),
  search: t('activity.search'),
  run: t('activity.run'),
  web: t('activity.web'),
  task: t('activity.task'),
  other: t('activity.other')
}

const DONE_VERBS: Record<ToolKind, string> = {
  read: t('activity.readDone'),
  edit: t('activity.editDone'),
  search: t('activity.searchDone'),
  run: t('activity.runDone'),
  web: t('activity.webDone'),
  task: t('activity.taskDone'),
  other: t('activity.otherDone')
}

interface ToolActivityFeedProps {
  activities: ToolActivity[]
  /** `true` while the turn is still live — only then does the newest row spin. */
  live: boolean
  /**
   * The shared clock a running row counts up against (`useTicker`). Omitted on
   * a settled turn, where every row already has its own `endedAt` and nothing
   * needs a clock at all.
   */
  now?: number
  /**
   * agent-patch: opens the edited file in the editor, by its absolute path. A
   * path named in a transcript, inside an app that has an editor, should be a
   * way in — otherwise it's a dead end the user has to go find in the tree.
   * Absent in contexts with no editor to open into (tests, restored history).
   */
  onOpenFile?: (path: string) => void
}

/**
 * How long a step has been running, or how long it took.
 *
 * A duration is only worth the ink once it is long enough to mean something:
 * under a second every row would read `0,2s` and the column would become
 * noise. Above that it is the single most useful thing on the row — it is what
 * separates "reading a big file" from "hung on a prompt nobody answered".
 */
const MIN_SHOWN_MS = 1000

function stepDuration(activity: ToolActivity, now: number): string | null {
  const elapsed = activityElapsed(activity, now)
  if (elapsed < MIN_SHOWN_MS) return null
  return formatDuration(elapsed)
}

/** The basename of a path, for the file-opening control's label. */
function baseName(path: string): string {
  const index = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return index === -1 ? path : path.slice(index + 1)
}

/**
 * The mark on the rail. One glyph, two jobs: it says what state this step is in
 * (tool icon while it runs, ✓/✗ once it settles), and its treatment says how
 * urgently. Two separate glyphs — a state dot beside a tool icon — read as
 * noise at this size.
 */
function ActivityMark({
  state,
  kind
}: {
  state: ToolActivity['state']
  kind: ToolKind
}): React.JSX.Element {
  const Icon = state === 'running' ? ICONS[kind] : state === 'failed' ? CloseIcon : CheckIcon
  return (
    <span className="wb-activity-mark" aria-hidden="true">
      <Icon size={12} />
    </span>
  )
}

/**
 * The row's verb.
 *
 * Normally the tool's *kind* decides it, but a `Write` to a path that does not
 * exist yet is a creation, and calling that "Editou" while the chip beside it
 * says "novo" makes the row argue with itself. The patch already knows which
 * it is, so the verb follows the patch when there is one.
 */
function rowVerb(activity: ToolActivity, kind: ToolKind): string {
  const running = activity.state === 'running'
  if (activity.patch?.op === 'create') {
    return running ? t('activity.create') : t('activity.createDone')
  }
  return running ? VERBS[kind] : DONE_VERBS[kind]
}

/** The row, narrated — the same three states the glyph and the verb tense carry. */
function statusAria(state: ToolActivity['state'], label: string): string {
  if (state === 'running') return t('activity.runningAria', label)
  return state === 'failed' ? t('activity.failedAria', label) : t('activity.okAria', label)
}

/** The row's own words: what it is doing, to what, and (for an edit) at what scale. */
function RowText({
  activity,
  kind,
  verb
}: {
  activity: ToolActivity
  kind: ToolKind
  verb: string
}): React.JSX.Element {
  const detail = shortenDetail(activity.detail, kind)
  const patch = activity.patch
  return (
    <>
      <span className="wb-activity-verb">{verb}</span>
      <span className="wb-activity-detail" title={activity.detail}>
        {detail ?? toolLabel(activity.name)}
      </span>
      {patch && <PatchOpChip patch={patch} />}
      {patch && <PatchStat adds={patch.adds} dels={patch.dels} />}
    </>
  )
}

/**
 * The agent's work feed (agent-activity AA-R1..R3, agent-patch AP-R1): one row
 * per tool call, threaded on a vertical rail inside the assistant turn, at the
 * point in the transcript where the calls actually happened — and, for a file
 * edit, the change itself underneath it.
 *
 * Reading, searching, editing and shell commands are most of what a BMAD
 * workflow spends its minute doing, and before this the whole minute looked
 * identical to a hang.
 *
 * ## State, three ways
 *
 * A row's state is never carried by one channel alone. It reads as **motion**
 * (the live row's mark spins on a real arc — the difference between "it's
 * working" and "it's frozen", which no static dot can make), as **shape** (a
 * settled row swaps the tool glyph for a ✓ or an ✗, so a finished list is
 * legible at a glance and in a screenshot), and as **words** (the verb switches
 * from *Rodando* to *Rodou*). Colour is a fourth, redundant channel — never the
 * only one.
 *
 * Nothing loops that isn't still happening: completed rows are static, and the
 * settle itself is a one-shot — the mark pops as it resolves, a failure gives a
 * single shake. `prefers-reduced-motion` keeps every one of those distinctions
 * and drops only the movement.
 *
 * Long turns collapse: past `VISIBLE_LIMIT` the feed shows the newest rows
 * behind a count, expandable in place — except for the rows that changed a
 * file, which are never folded away (see {@link collapseActivities}).
 */
export function ToolActivityFeed({
  activities,
  live,
  now = 0,
  onOpenFile
}: ToolActivityFeedProps): React.JSX.Element | null {
  const [expanded, setExpanded] = useState(false)
  // Patches open by default, so these track the *exceptions*: rows the user
  // closed, and rows they grew past the line cap.
  const [closed, setClosed] = useState<ReadonlySet<string>>(() => new Set())
  const [grown, setGrown] = useState<ReadonlySet<string>>(() => new Set())

  if (activities.length === 0) return null

  const folded = collapseActivities(activities, VISIBLE_LIMIT)
  const canCollapse = folded.length < activities.length
  const visible = expanded || !canCollapse ? activities : folded
  const lastRunningId = findLastRunningId(activities)

  const toggle = (set: ReadonlySet<string>, id: string): ReadonlySet<string> => {
    const next = new Set(set)
    if (!next.delete(id)) next.add(id)
    return next
  }

  return (
    <div className="wb-activity" role="group" aria-label={t('activity.regionLabel')}>
      {canCollapse && (
        <button
          type="button"
          className="wb-activity-toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          <span className="wb-activity-toggle-count">
            {t('activity.stepsCount', activities.length)}
          </span>
          <span className="wb-activity-toggle-cta">
            {expanded ? t('activity.collapseCta') : t('activity.expandCta')}
          </span>
        </button>
      )}
      <ol className="wb-activity-list">
        {visible.map((activity) => (
          <ActivityRow
            key={activity.id}
            activity={activity}
            live={live && activity.id === lastRunningId}
            now={now}
            onOpenFile={onOpenFile}
            open={!closed.has(activity.id)}
            onToggleOpen={() => setClosed((set) => toggle(set, activity.id))}
            full={grown.has(activity.id)}
            onToggleFull={() => setGrown((set) => toggle(set, activity.id))}
          />
        ))}
      </ol>
    </div>
  )
}

interface ActivityRowProps {
  activity: ToolActivity
  /** `true` only for the newest still-running row of a live turn — one spinner, not a disco. */
  live: boolean
  now: number
  onOpenFile?: (path: string) => void
  /** Patch disclosure state. Meaningless (and unused) on a row with no patch. */
  open: boolean
  onToggleOpen: () => void
  full: boolean
  onToggleFull: () => void
}

/**
 * One step, and — when it changed a file — the change under it.
 *
 * Its own component rather than a callback in the feed's `map`: a row now
 * carries a disclosure, a file-opening control, a diffstat and a body, and
 * folding all of that into the loop put it past the complexity budget with no
 * seam for a test to hold on to.
 */
function ActivityRow({
  activity,
  live,
  now,
  onOpenFile,
  open,
  onToggleOpen,
  full,
  onToggleFull
}: ActivityRowProps): React.JSX.Element {
  const kind = toolKind(activity.name)
  const verb = rowVerb(activity, kind)
  const duration = stepDuration(activity, now)
  const patch = activity.patch
  const bodyId = `wb-patch-${activity.id}`
  // The narrated row carries the duration too — "reading for two minutes" is
  // exactly the state a screen-reader user most needs.
  const label = [
    verb,
    shortenDetail(activity.detail, kind) ?? toolLabel(activity.name),
    duration ?? ''
  ].join(' ')
  const text = <RowText activity={activity} kind={kind} verb={verb} />

  return (
    <li
      className="wb-activity-row"
      data-state={activity.state}
      data-kind={kind}
      data-live={live || undefined}
      data-patch={patch !== undefined || undefined}
      // Staggering by arrival order (not by index in the rendered slice) keeps
      // a row's entrance tied to when it actually happened, so a
      // collapse/expand doesn't re-choreograph history.
      style={{ ['--activity-seq' as string]: String(Math.min(activity.seq, 6)) }}
    >
      <div className="wb-activity-head">
        <ActivityMark state={activity.state} kind={kind} />
        {/* A step that changed a file has something to show, so its row becomes
            the disclosure for it. Every other step keeps the plain,
            unclickable status line it always was. */}
        {patch ? (
          <button
            type="button"
            className="wb-activity-text wb-activity-open"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={onToggleOpen}
          >
            {text}
            <ChevronRightIcon
              size={11}
              className="wb-activity-chevron"
              data-open={open || undefined}
              aria-hidden="true"
            />
          </button>
        ) : (
          <span className="wb-activity-text">{text}</span>
        )}
        {patch && onOpenFile && (
          <button
            type="button"
            className="wb-activity-goto"
            aria-label={t('patch.openInEditor', baseName(patch.path))}
            onClick={() => onOpenFile(patch.path)}
          >
            <ExternalLinkIcon size={12} aria-hidden="true" />
          </button>
        )}
        {/* The step's own clock, parked at the row's end so a column of them
            lines up and can be scanned for the slow one. */}
        {duration !== null && (
          <span className="wb-activity-time" aria-hidden="true">
            {duration}
          </span>
        )}
        <span className="wb-visually-hidden">{statusAria(activity.state, label)}</span>
      </div>
      {patch && open && (
        <PatchSnippet
          patch={patch}
          id={bodyId}
          failed={activity.state === 'failed'}
          full={full}
          onToggleFull={onToggleFull}
        />
      )}
    </li>
  )
}

function findLastRunningId(activities: ToolActivity[]): string | null {
  for (let index = activities.length - 1; index >= 0; index -= 1) {
    if (activities[index].state === 'running') return activities[index].id
  }
  return null
}
