import { useState } from 'react'
import { t } from '../i18n'
import {
  BoltIcon,
  CheckIcon,
  CloseIcon,
  CompassIcon,
  EyeIcon,
  PencilIcon,
  SearchIcon,
  TerminalIcon,
  ToolsIcon
} from '../ui/icons'
import {
  shortenDetail,
  toolKind,
  toolLabel,
  type ToolActivity,
  type ToolKind
} from './toolActivity'

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
}

/**
 * The agent's work feed (agent-activity AA-R1..R3): one row per tool call,
 * threaded on a vertical rail inside the assistant turn, at the point in the
 * transcript where the calls actually happened.
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
 * behind a count, expandable in place. A 40-step workflow shouldn't push the
 * reply it's producing off the screen.
 */
export function ToolActivityFeed({
  activities,
  live
}: ToolActivityFeedProps): React.JSX.Element | null {
  const [expanded, setExpanded] = useState(false)
  if (activities.length === 0) return null

  const overflow = activities.length - VISIBLE_LIMIT
  const collapsed = overflow > 0 && !expanded
  const visible = collapsed ? activities.slice(-VISIBLE_LIMIT) : activities
  const lastRunningId = findLastRunningId(activities)

  return (
    <div className="wb-activity" role="group" aria-label={t('activity.regionLabel')}>
      {overflow > 0 && (
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
        {visible.map((activity) => {
          const kind = toolKind(activity.name)
          const running = activity.state === 'running'
          const Icon = running ? ICONS[kind] : activity.state === 'failed' ? CloseIcon : CheckIcon
          const detail = shortenDetail(activity.detail, kind)
          const verb = running ? VERBS[kind] : DONE_VERBS[kind]
          const label = `${verb} ${detail ?? toolLabel(activity.name)}`
          return (
            <li
              key={activity.id}
              className="wb-activity-row"
              data-state={activity.state}
              data-kind={kind}
              data-live={(live && activity.id === lastRunningId) || undefined}
              // Staggering by arrival order (not by index in the rendered
              // slice) keeps a row's entrance tied to when it actually
              // happened, so a collapse/expand doesn't re-choreograph history.
              style={{ ['--activity-seq' as string]: String(Math.min(activity.seq, 6)) }}
            >
              {/* One mark, two jobs: the glyph says what state this step is in
                  (tool icon while it runs, ✓/✗ once it settles), its treatment
                  says how urgently. Two separate glyphs — a state dot beside a
                  tool icon — read as noise at this size. */}
              <span className="wb-activity-mark" aria-hidden="true">
                <Icon size={12} />
              </span>
              <span className="wb-activity-text">
                <span className="wb-activity-verb">{verb}</span>
                {detail !== undefined ? (
                  <span className="wb-activity-detail" title={activity.detail}>
                    {detail}
                  </span>
                ) : (
                  <span className="wb-activity-detail">{toolLabel(activity.name)}</span>
                )}
              </span>
              <span className="wb-visually-hidden">
                {activity.state === 'running'
                  ? t('activity.runningAria', label)
                  : activity.state === 'failed'
                    ? t('activity.failedAria', label)
                    : t('activity.okAria', label)}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function findLastRunningId(activities: ToolActivity[]): string | null {
  for (let index = activities.length - 1; index >= 0; index -= 1) {
    if (activities[index].state === 'running') return activities[index].id
  }
  return null
}
