import { Badge, Empty, SkillCard, SkillGrid } from '@hive/design-system'
import { intentLabel, t } from '../i18n'

/** Structural mirror of `main/workflowCatalog.ts`'s `WorkflowEntry` — kept local so this component stays self-contained, same convention `explorer/Explorer.tsx` uses for `FsTreeNode`. */
interface WorkflowEntryLike {
  key: string
  status: 'wired' | 'planned'
}

interface IntentGridProps<T extends WorkflowEntryLike> {
  entries: T[]
  /** Invoked when a `wired` entry is activated (click or Enter/Space). Never called for a `planned` entry — they render non-interactively. */
  onSelect: (entry: T) => void
}

/**
 * "What do you want to do today?" new-session intent grid (task T18,
 * design.md §4 "Intent placeholders" row, R7.1). Renders every
 * `WorkflowCatalog` entry as a DS `SkillCard`: the `wired` entry (MVP:
 * "Create a PRD") is `lead`-highlighted and clickable; `planned` entries are
 * visible but non-interactive, tagged with a "planned" `Badge` so they read
 * as real, near-term roadmap items rather than dead buttons.
 *
 * Generic over `T` (rather than fixed to the local `WorkflowEntryLike`) so
 * `onSelect` receives the caller's full entry type (e.g. Chat.tsx's
 * `WorkflowEntry`, `command` field included) instead of the narrowed shape
 * this component itself only needs for rendering.
 */
export function IntentGrid<T extends WorkflowEntryLike>({
  entries,
  onSelect
}: IntentGridProps<T>): React.JSX.Element {
  return (
    <div style={{ padding: 24 }}>
      <Empty title={t('intentGrid.title')} description={t('intentGrid.description')} />
      <SkillGrid style={{ marginTop: 16 }}>
        {entries.map((entry, index) => {
          const wired = entry.status === 'wired'
          return (
            <SkillCard
              key={entry.key}
              title={intentLabel(entry.key)}
              lead={wired}
              index={index}
              role={wired ? 'button' : undefined}
              tabIndex={wired ? 0 : undefined}
              aria-disabled={wired ? undefined : true}
              style={{ cursor: wired ? 'pointer' : 'default', opacity: wired ? 1 : 0.7 }}
              onClick={wired ? () => onSelect(entry) : undefined}
              onKeyDown={
                wired
                  ? (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onSelect(entry)
                      }
                    }
                  : undefined
              }
            >
              {!wired && <Badge variant="muted">{t('intentGrid.plannedBadge')}</Badge>}
            </SkillCard>
          )
        })}
      </SkillGrid>
    </div>
  )
}
