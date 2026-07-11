import type { ReactNode } from 'react'
import { t, intentLabel } from '../i18n'
import {
  FileTextIcon,
  HiveCellIcon,
  IntentArchitectureIcon,
  IntentBrainstormIcon,
  IntentPrdIcon,
  IntentResearchIcon,
  IntentStoryIcon
} from '../ui/icons'

/** Structural mirror of `main/workflowCatalog.ts`'s `WorkflowEntry` — kept local so this component stays self-contained, same convention `explorer/Explorer.tsx` uses for `FsTreeNode`. */
interface WorkflowEntryLike {
  key: string
  status: 'wired' | 'planned'
}

interface IntentGridProps<T extends WorkflowEntryLike> {
  entries: T[]
  /** Invoked when a `wired` entry is activated (click or Enter/Space). Never called for a `planned` entry — they render non-interactively. */
  onSelect: (entry: T) => void
  /** The chat composer, rendered inside the hero: on an empty conversation the prompt IS the main affordance, so it sits center-stage instead of docked at the bottom. */
  composer?: ReactNode
}

/** Maps a WorkflowCatalog entry key to its intent icon; FileTextIcon for unknown runtime-discovered entries. */
function intentIconFor(key: string): (props: { size?: number }) => React.JSX.Element {
  switch (key) {
    case 'prd':
      return IntentPrdIcon
    case 'brainstorm':
      return IntentBrainstormIcon
    case 'domain-research':
      return IntentResearchIcon
    case 'architecture':
      return IntentArchitectureIcon
    case 'story':
      return IntentStoryIcon
    default:
      return FileTextIcon
  }
}

/**
 * "What do you want to do today?" new-session hero (task T18, design.md §4
 * "Intent placeholders" row, R7.1). One centered block — brand mark,
 * greeting, the composer itself, then compact intent *pills* (icon + label,
 * nothing else): starting a session is a single glance-and-click, not a
 * wall of cards. The `wired` entry (MVP: "Create a PRD") is the only
 * interactive pill; `planned` entries collapse into a quiet row under a
 * single shared "Em breve" tag instead of repeating a badge per card
 * (never a full-saturation accent on an inactive state — DS PRODUCT.md).
 */
export function IntentGrid<T extends WorkflowEntryLike>({
  entries,
  onSelect,
  composer
}: IntentGridProps<T>): React.JSX.Element {
  const wired = entries.filter((entry) => entry.status === 'wired')
  const planned = entries.filter((entry) => entry.status !== 'wired')

  return (
    <div className="wb-hero-wrap">
      <div className="wb-chat-col wb-hero">
        <span className="wb-hero-mark" aria-hidden="true">
          <HiveCellIcon size={20} />
        </span>
        <h1 className="wb-hero-title">{t('intentGrid.title')}</h1>
        <p className="wb-hero-sub">{t('intentGrid.description')}</p>

        {wired.length > 0 && (
          <div className="wb-pills" role="list">
            {wired.map((entry) => {
              const Icon = intentIconFor(entry.key)
              return (
                <article
                  key={entry.key}
                  role="button"
                  tabIndex={0}
                  data-lead="true"
                  className="wb-pill"
                  onClick={() => onSelect(entry)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onSelect(entry)
                    }
                  }}
                >
                  <Icon size={14} />
                  {intentLabel(entry.key)}
                </article>
              )
            })}
          </div>
        )}

        {planned.length > 0 && (
          <div className="wb-pills wb-pills-planned">
            <span className="wb-pills-planned-label">{t('intentGrid.plannedBadge')}</span>
            {planned.map((entry) => {
              const Icon = intentIconFor(entry.key)
              return (
                <article key={entry.key} data-lead="false" aria-disabled={true} className="wb-pill">
                  <Icon size={14} />
                  {intentLabel(entry.key)}
                </article>
              )
            })}
          </div>
        )}

        {composer && <div className="wb-hero-composer">{composer}</div>}
      </div>
    </div>
  )
}
