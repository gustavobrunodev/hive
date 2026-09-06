import { useCallback, useEffect, useState } from 'react'
import {
  Badge,
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  SegmentedControl
} from '@hive/design-system'
import { agentMeta, shortcutLabel, t } from '../i18n'
import { commandFilter } from './shortcutSearch'
import { shortcutIcon, skillIcon } from './roleVisuals'
import { CheckIcon, CloseIcon, PersonaChatIcon, SparkleIcon } from './icons'

/** Structural mirror of `main/workflowCatalog.ts`'s `WorkspaceSkill` (the
 *  renderer tsconfig doesn't include `src/main` — same local-mirror
 *  convention as `ActionRail`'s `RoleAction`). */
export interface WorkspaceSkill {
  key: string
  label: string
  description: string
  module: string
  kind: 'skill' | 'agent'
  persona: string | null
  /** skill-studio: `true` for a user-created skill — grouped apart ("Criadas por você"). */
  custom?: boolean
}

/** Structural mirror of `main/configStore.ts`'s `ShortcutScope`. */
export type ShortcutScope = 'start' | 'during'

/** The two selection lists, mirroring `main/configStore.ts`'s `ShortcutPrefs`. */
interface Selection {
  skills: string[]
  agents: string[]
}

/** One entry per scope — what's selected, and whether it's the user's own set. */
type ScopeState = Record<ShortcutScope, { selection: Selection; customized: boolean }>

interface ShortcutCustomizerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspace: string
  role: string | null
  /** Which set opens first — the profile sheet and the strip point at
   *  `during`, the hero at `start`. Defaults to `start`. */
  initialScope?: ShortcutScope
  /** Fired after every persisted change — the parent re-resolves the live
   *  shortcut sets, so the hero/strip behind the dialog update in place. */
  onChanged: () => void
  /** skill-studio: opens the Skill Studio (the "create your own" path out of this picker). */
  onOpenStudio?: () => void
}

/** How many preview chips render before the rest collapse into a `+N` tail. */
const PREVIEW_LIMIT = 6

/** A selected shortcut, resolved for display (preview chips + scope counts). */
interface PreviewEntry {
  key: string
  kind: 'workflow' | 'persona'
  label: string
  custom?: boolean
}

/**
 * Resolves a scope's selection into the chips the stage draws, in the order the
 * real surfaces render them (workflows, then personas).
 *
 * `validate` has to mirror `main/roleCatalog.ts` **exactly**, and mirroring it
 * is the whole job: the stage must draw the set that is actually on the
 * surface, never one chip more or less, or the chip you click is not the pill
 * you meant. Two rules over there, and both matter here:
 *
 *  - a scope still on its **role defaults** is never validated — the resolver
 *    hands those back untouched, catalog or no catalog;
 *  - a scope with a real **selection** is validated against the catalog, so a
 *    skill this workspace does not have is dropped rather than drawn as a dead
 *    shortcut — unless there is no catalog at all, in which case there is
 *    nothing to check against and the selection stands as written.
 *
 * The first rule is the one that had to be found the hard way: a workspace with
 * a partial BMAD install renders role defaults it cannot resolve, and a stage
 * that validated them showed three chips fewer than the hero it was drawing —
 * with no way to remove the three that were missing. (`e2e/shortcut-removal`
 * caught it; no mocked pass could, because every fixture had a complete
 * catalog.)
 */
function resolveEntries(
  selection: Selection | undefined,
  catalogByKey: Map<string, WorkspaceSkill>,
  validate: boolean
): PreviewEntry[] {
  if (!selection) return []
  const pick = (keys: string[], kind: 'workflow' | 'persona'): PreviewEntry[] =>
    keys.flatMap((key) => {
      const skill = catalogByKey.get(key)
      if (!skill && validate) return []
      return [{ key, kind, label: shortcutLabel(key, kind, skill?.label), custom: skill?.custom }]
    })
  return [...pick(selection.skills, 'workflow'), ...pick(selection.agents, 'persona')]
}

/** Splits the catalog into the picker's three groups: user creations first (skill-studio), then the stock agents/workflows. */
function splitCatalog(entries: WorkspaceSkill[]): {
  customs: WorkspaceSkill[]
  agents: WorkspaceSkill[]
  skills: WorkspaceSkill[]
} {
  return {
    customs: entries.filter((skill) => skill.custom),
    agents: entries.filter((skill) => skill.kind === 'agent' && !skill.custom),
    skills: entries.filter((skill) => skill.kind === 'skill' && !skill.custom)
  }
}

/** Maps a scope's default actions to selection lists (the pre-checked state before any customization exists). */
function selectionFromDefaults(actions: { kind: string; command: { key: string } }[]): Selection {
  return {
    skills: actions.filter((a) => a.kind === 'workflow').map((a) => a.command.key),
    agents: actions.filter((a) => a.kind === 'persona').map((a) => a.command.key)
  }
}

/** An agent row's display strings: pt-BR persona + role when known, the catalog's own persona/description otherwise. */
function agentRowText(skill: WorkspaceSkill): { title: string; sub: string } {
  const meta = agentMeta(skill.key)
  return {
    title: shortcutLabel(skill.key, 'persona', skill.persona ?? skill.label),
    sub: meta?.role ?? skill.description
  }
}

/** Renders a skill's icon element (a plain helper, not a per-render component alias — react-hooks/static-components). */
function skillIconEl(skillKey: string): React.JSX.Element {
  const IconComponent = skillIcon(skillKey)
  return <IconComponent size={15} />
}

/** Same helper shape for a resolved shortcut's icon (preview chips). */
function shortcutIconEl(entry: PreviewEntry, size: number): React.JSX.Element {
  const IconComponent = shortcutIcon(entry)
  return <IconComponent size={size} />
}

/** One selectable row — shared by both groups; the check "lamp" on the right is the selection affordance. */
function SkillRow({
  skill,
  selected,
  onToggle
}: {
  skill: WorkspaceSkill
  selected: boolean
  onToggle: (skill: WorkspaceSkill) => void
}): React.JSX.Element {
  const isAgent = skill.kind === 'agent'
  const { title, sub } = isAgent
    ? agentRowText(skill)
    : { title: shortcutLabel(skill.key, 'workflow', skill.label), sub: `/${skill.key}` }
  const persona = skill.persona ?? agentMeta(skill.key)?.persona ?? null
  return (
    <CommandItem
      value={`${title} ${skill.key}`}
      keywords={[skill.key, skill.label, skill.description, skill.module, sub]}
      data-checked={selected || undefined}
      aria-label={t('shortcuts.toggleAria', title)}
      onSelect={() => onToggle(skill)}
      shortcut={
        <span className="wb-sc-check" data-on={selected || undefined} aria-hidden="true">
          <CheckIcon size={11} />
        </span>
      }
      className="wb-sc-item"
    >
      {isAgent ? (
        <span className="wb-sc-avatar" aria-hidden="true">
          {persona ? persona[0].toUpperCase() : <PersonaChatIcon size={14} />}
        </span>
      ) : (
        <span className="wb-sc-icon" aria-hidden="true">
          {skill.custom ? <SparkleIcon size={15} /> : skillIconEl(skill.key)}
        </span>
      )}
      <span className="wb-sc-text">
        <span className="wb-sc-title">{title}</span>
        <span className="wb-sc-sub">{sub}</span>
      </span>
    </CommandItem>
  )
}

/** One catalog group (Agentes / Skills): heading with a live "selected of total" count over its rows. */
function CatalogGroup({
  label,
  entries,
  selectedKeys,
  onToggle
}: {
  label: string
  entries: WorkspaceSkill[]
  selectedKeys: string[]
  onToggle: (skill: WorkspaceSkill) => void
}): React.JSX.Element | null {
  if (entries.length === 0) return null
  const keys = new Set(entries.map((skill) => skill.key))
  const selected = selectedKeys.filter((key) => keys.has(key)).length
  return (
    <CommandGroup
      heading={
        <span className="wb-sc-group-head">
          {label}
          <span className="wb-sc-group-count">
            {t('shortcuts.groupCount', selected, entries.length)}
          </span>
        </span>
      }
    >
      {entries.map((skill) => (
        <SkillRow
          key={skill.key}
          skill={skill}
          selected={selectedKeys.includes(skill.key)}
          onToggle={onToggle}
        />
      ))}
    </CommandGroup>
  )
}

/**
 * One chip of the live set — painted with the real surface's own class, so the
 * stage IS the thing it shows rather than a drawing of it, and clickable to
 * take that shortcut off the surface.
 *
 * The whole chip is the target, and the leading icon becomes an ✕ on hover or
 * focus rather than a permanent ✕ riding every chip. A row of six delete
 * buttons is a row that shouts about deleting; swapping the glyph in place
 * keeps the set looking like the set at rest, gives the gesture a target the
 * size of the whole chip, and still announces itself the moment a pointer or
 * the keyboard arrives.
 */
function ShortcutChip({
  entry,
  scope,
  onRemove
}: {
  entry: PreviewEntry
  scope: ShortcutScope
  onRemove: (entry: PreviewEntry) => void
}): React.JSX.Element {
  const persona = entry.kind === 'persona' || undefined
  return (
    <button
      type="button"
      className={`wb-sc-chip ${scope === 'start' ? 'wb-pill' : 'wb-shortcut-chip'}`}
      data-persona={persona}
      aria-label={t('shortcuts.removeAria', entry.label)}
      title={t('shortcuts.removeTitle')}
      onClick={() => onRemove(entry)}
    >
      <span className="wb-sc-chip-mark" aria-hidden="true">
        <span className="wb-sc-chip-icon">
          {shortcutIconEl(entry, scope === 'start' ? 13 : 12)}
        </span>
        <span className="wb-sc-chip-x">
          <CloseIcon size={scope === 'start' ? 13 : 12} />
        </span>
      </span>
      {entry.label}
    </button>
  )
}

/**
 * The live set: this scope's shortcuts drawn where they will land — hero pills
 * over a centered composer, or strip chips docked on top of it — and editable
 * in place.
 *
 * Two shortcut sets is one concept more than a picker usually carries, and a
 * picture of each placement answers "which list does this belong in?" faster
 * than any label can. Making that picture the *editor* answers the other
 * question this dialog kept failing: where do I take one **off**. It used to be
 * a decorative stage over a 60-row catalog, so removing a shortcut you could
 * see right there meant hunting for its row among sixty — and in a workspace
 * with no BMAD, where the catalog renders nothing at all, it was simply not
 * possible. Now the set on screen is the control: click a chip, it is gone,
 * defaults included.
 *
 * The stand-in composer stays decorative and inert — it is the landmark the two
 * placements are read against, not a control.
 */
function ScopeStage({
  scope,
  entries,
  onRemove,
  onClear
}: {
  scope: ShortcutScope
  entries: PreviewEntry[]
  onRemove: (entry: PreviewEntry) => void
  onClear: () => void
}): React.JSX.Element {
  const shown = entries.slice(0, PREVIEW_LIMIT)
  const overflow = entries.length - shown.length
  return (
    <section
      className="wb-sc-preview"
      data-scope={scope}
      aria-label={t(
        'shortcuts.previewAria',
        scope === 'start' ? t('shortcuts.scopeStartLabel') : t('shortcuts.scopeDuringLabel')
      )}
    >
      <p className="wb-sc-preview-caption">
        {scope === 'start' ? t('shortcuts.scopeStartCaption') : t('shortcuts.scopeDuringCaption')}
        {entries.length > 0 && (
          <button type="button" className="wb-sc-clear" onClick={onClear}>
            {t('shortcuts.clearScopeCta')}
          </button>
        )}
      </p>
      <div className="wb-sc-stage">
        {entries.length === 0 ? (
          <p className="wb-sc-stage-empty">
            {scope === 'start'
              ? t('shortcuts.previewEmptyStart')
              : t('shortcuts.previewEmptyDuring')}
          </p>
        ) : (
          <div className="wb-sc-stage-chips">
            {shown.map((entry) => (
              <ShortcutChip key={entry.key} entry={entry} scope={scope} onRemove={onRemove} />
            ))}
            {/* The tail counts what the miniature has no room for, never what
                the real surface would hide — so it is a fact about this box,
                and inert like the composer under it. */}
            {overflow > 0 && (
              <span className="wb-sc-stage-more" aria-hidden="true">
                +{overflow}
              </span>
            )}
          </div>
        )}
        {/* The composer both sets are positioned against — the anchor that
            makes "before the first message" and "during" legible as places. */}
        <div className="wb-sc-stage-composer" aria-hidden="true">
          <span className="wb-sc-stage-caret" />
          <span className="wb-sc-stage-send" />
        </div>
      </div>
    </section>
  )
}

/**
 * The catalog half: search over everything the workspace has, in three groups,
 * each row a toggle. This is where shortcuts are *added* — a search problem,
 * over sixty-odd skills most people have never heard of. Removing lives on the
 * chips above, where you are already looking at the thing you want gone.
 */
function CatalogPicker({
  groups,
  selection,
  onToggle
}: {
  groups: { customs: WorkspaceSkill[]; agents: WorkspaceSkill[]; skills: WorkspaceSkill[] }
  /** `null` until both fetches land — the list renders its own empty state meanwhile. */
  selection: Selection | null
  onToggle: (skill: WorkspaceSkill) => void
}): React.JSX.Element {
  return (
    <Command
      label={t('shortcuts.customizeTitle')}
      className="wb-sc-command"
      filter={commandFilter}
      loop
    >
      <CommandInput
        placeholder={t('shortcuts.searchPlaceholder')}
        aria-label={t('shortcuts.searchAria')}
        autoFocus
      />
      <CommandList className="wb-sc-list">
        <CommandEmpty>{t('shortcuts.noMatch')}</CommandEmpty>
        {selection && (
          <>
            <CatalogGroup
              label={t('shortcuts.createdGroupLabel')}
              entries={groups.customs}
              selectedKeys={[...selection.skills, ...selection.agents]}
              onToggle={onToggle}
            />
            <CatalogGroup
              label={t('shortcuts.agentsGroupLabel')}
              entries={groups.agents}
              selectedKeys={selection.agents}
              onToggle={onToggle}
            />
            <CatalogGroup
              label={t('shortcuts.skillsGroupLabel')}
              entries={groups.skills}
              selectedKeys={selection.skills}
              onToggle={onToggle}
            />
          </>
        )}
      </CommandList>
    </Command>
  )
}

/** Everything the dialog renders from, derived in one place: the catalog's
 *  three groups, whether both fetches landed, the active scope's state, its
 *  preview entries, and the switch's per-scope counts. Pure and module-scope,
 *  which keeps the branching out of the component's complexity budget. */
function buildView(
  catalog: WorkspaceSkill[] | null,
  scopes: ScopeState | null,
  scope: ShortcutScope
): {
  customs: WorkspaceSkill[]
  agents: WorkspaceSkill[]
  skills: WorkspaceSkill[]
  loaded: boolean
  /** Loaded, and this workspace has no BMAD catalog at all — nothing to pick. */
  emptyCatalog: boolean
  active: ScopeState[ShortcutScope] | null
  previewEntries: PreviewEntry[]
  scopeOptions: { id: string; label: string; count: number; tone: 'accent' }[]
} {
  const entries = catalog ?? []
  // skill-studio: user creations get their own group up top; the stock BMAD
  // groups keep their original membership below.
  const groups = splitCatalog(entries)
  const byKey = new Map(entries.map((skill) => [skill.key, skill]))
  const active = scopes === null ? null : scopes[scope]
  // Exactly the resolver's own rule, per scope (see `resolveEntries`): role
  // defaults pass through untouched, a real selection is checked against the
  // catalog, and with no catalog nothing is checked at all.
  const validates = (state: ScopeState[ShortcutScope] | null): boolean =>
    entries.length > 0 && state?.customized === true
  const countOf = (target: ShortcutScope): number =>
    scopes === null
      ? 0
      : resolveEntries(scopes[target].selection, byKey, validates(scopes[target])).length
  const loaded = catalog !== null && scopes !== null
  return {
    ...groups,
    loaded,
    emptyCatalog: loaded && entries.length === 0,
    active,
    previewEntries: resolveEntries(active?.selection, byKey, validates(active)),
    scopeOptions: [
      {
        id: 'start',
        label: t('shortcuts.scopeStartLabel'),
        count: countOf('start'),
        tone: 'accent'
      },
      {
        id: 'during',
        label: t('shortcuts.scopeDuringLabel'),
        count: countOf('during'),
        tone: 'accent'
      }
    ]
  }
}

/**
 * "Personalizar atalhos" (shortcut-customization + shortcut-scopes): a
 * searchable picker over the workspace's full BMAD skill catalog, split into
 * **Agentes** (the "talk to <persona>" specialists) and **Skills**
 * (workflows) — applied to one of two independent sets, chosen by the
 * segmented control at the top:
 *
 *  - **Para iniciar** — the hero, before the first message.
 *  - **Durante a conversa** — the strip above the composer, mid-thread.
 *
 * Each set starts as that scope's role defaults and every edit persists
 * immediately for that scope alone — the hero pills and the composer strip
 * behind the dialog update live. "Restaurar padrão" drops the customization of
 * the *visible* scope only (`shortcuts.set(scope, null)`).
 *
 * ## Adding and removing are two different gestures, in two different places
 *
 * Adding is a search problem — sixty-odd skills, most of which you have never
 * heard of — and it belongs in the catalog list. Removing is not: you already
 * know which one you want gone, because you are looking at it. Routing both
 * through the same list is what made "take this default off" feel impossible,
 * and in a workspace with no BMAD (where the list renders nothing) it *was*
 * impossible. So the set at the top is the control for its own members: click
 * a chip and it leaves, whether it came from your selection or from the role.
 *
 * A thin closed-state gate: nothing (no catalog fetch, no DS dialog tree)
 * mounts until the picker actually opens.
 */
export function ShortcutCustomizer(props: ShortcutCustomizerProps): React.JSX.Element | null {
  if (!props.open) return null
  return <CustomizerDialog {...props} />
}

function CustomizerDialog({
  open,
  onOpenChange,
  workspace,
  role,
  initialScope = 'start',
  onChanged,
  onOpenStudio
}: ShortcutCustomizerProps): React.JSX.Element {
  const [catalog, setCatalog] = useState<WorkspaceSkill[] | null>(null)
  const [scopes, setScopes] = useState<ScopeState | null>(null)
  const [scope, setScope] = useState<ShortcutScope>(initialScope)

  useEffect(() => {
    let cancelled = false
    // Locally-defined async function invoked immediately (the repo's
    // GuidedInstall `load()` pattern) — react-hooks/set-state-in-effect.
    async function load(): Promise<void> {
      const [entries, settings, startDefaults, duringDefaults] = await Promise.all([
        window.hive.shortcuts.catalog(workspace),
        window.hive.shortcuts.get(),
        window.hive.profile.roleActions(role, 'start'),
        window.hive.profile.roleActions(role, 'during')
      ])
      if (cancelled) return
      setCatalog(entries)
      setScopes({
        start: settings.start
          ? { selection: settings.start, customized: true }
          : { selection: selectionFromDefaults(startDefaults), customized: false },
        during: settings.during
          ? { selection: settings.during, customized: true }
          : { selection: selectionFromDefaults(duringDefaults), customized: false }
      })
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [workspace, role])

  /**
   * The one write path. Every edit — a row toggled, a chip removed, the set
   * cleared — goes through here, so "this scope is customized now" and the
   * persisted value can never come apart.
   *
   * Writes are whole-object *per scope*, so rapid edits cannot interleave into
   * a corrupt state (last write wins) and the other scope is never rewritten.
   */
  const commit = useCallback(
    (edit: (selection: Selection) => Selection) => {
      setScopes((current) => {
        if (!current) return current
        const selection = edit(current[scope].selection)
        void window.hive.shortcuts.set(scope, selection).then(onChanged)
        return { ...current, [scope]: { selection, customized: true } }
      })
    },
    [scope, onChanged]
  )

  const toggle = useCallback(
    (skill: WorkspaceSkill) => {
      const listKey = skill.kind === 'agent' ? 'agents' : 'skills'
      commit((selection) => {
        const list = selection[listKey]
        return {
          ...selection,
          [listKey]: list.includes(skill.key)
            ? list.filter((key) => key !== skill.key)
            : [...list, skill.key]
        }
      })
    },
    [commit]
  )

  /**
   * Takes one shortcut off the surface, from the chip that is drawing it.
   *
   * Keyed off the chip's own `kind` rather than a catalog lookup: a workspace
   * with no BMAD has no catalog to look anything up in, and that is exactly
   * the workspace where removing a role default used to be impossible.
   */
  const removeEntry = useCallback(
    (entry: PreviewEntry) => {
      const listKey = entry.kind === 'persona' ? 'agents' : 'skills'
      commit((selection) => ({
        ...selection,
        [listKey]: selection[listKey].filter((key) => key !== entry.key)
      }))
    },
    [commit]
  )

  /** Empties the visible scope. Reversible in one click while a role default
   *  set is what was cleared — "Restaurar padrão" appears the moment it is. */
  const clearScope = useCallback(() => commit(() => ({ skills: [], agents: [] })), [commit])

  const restore = useCallback(async () => {
    await window.hive.shortcuts.set(scope, null)
    const defaults = await window.hive.profile.roleActions(role, scope)
    setScopes((current) =>
      current
        ? { ...current, [scope]: { selection: selectionFromDefaults(defaults), customized: false } }
        : current
    )
    onChanged()
  }, [scope, role, onChanged])

  const { customs, agents, skills, loaded, emptyCatalog, active, previewEntries, scopeOptions } =
    buildView(catalog, scopes, scope)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="wb-sc-dialog">
        <CustomizerHead
          scope={scope}
          customized={active?.customized === true}
          options={scopeOptions}
          onScopeChange={setScope}
        />

        {/* The set comes first and is always here — including in a workspace
            with no BMAD, where the catalog below has nothing to offer but the
            shortcuts on screen still have to be removable. */}
        <ScopeStage
          scope={scope}
          entries={previewEntries}
          onRemove={removeEntry}
          onClear={clearScope}
        />

        {emptyCatalog ? (
          <p className="wb-sc-empty-catalog">{t('shortcuts.emptyCatalog')}</p>
        ) : (
          <CatalogPicker
            groups={{ customs, agents, skills }}
            selection={loaded ? (active?.selection ?? null) : null}
            onToggle={toggle}
          />
        )}
        <CustomizerFoot
          count={previewEntries.length}
          customized={active?.customized === true}
          onOpenStudio={onOpenStudio}
          onRestore={() => void restore()}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

/** Title + per-scope state badge + the scope switch — the dialog's fixed head. */
function CustomizerHead({
  scope,
  customized,
  options,
  onScopeChange
}: {
  scope: ShortcutScope
  customized: boolean
  options: { id: string; label: string; count: number; tone: 'accent' }[]
  onScopeChange: (scope: ShortcutScope) => void
}): React.JSX.Element {
  return (
    <header className="wb-sc-head">
      <div className="wb-sc-head-row">
        <DialogTitle className="wb-sc-title-main">{t('shortcuts.customizeTitle')}</DialogTitle>
        {/* Keyed on the scope so switching sets re-mounts the badge rather
            than morphing one word into another mid-transition. */}
        <Badge variant={customized ? 'accent' : 'muted'} className="wb-sc-state-badge" key={scope}>
          {customized ? t('shortcuts.customBadge') : t('shortcuts.roleDefaultBadge')}
        </Badge>
      </div>
      <DialogDescription className="wb-sc-desc">
        {t('shortcuts.dialogDescription')}
      </DialogDescription>
      <SegmentedControl
        className="wb-sc-scopes"
        size="md"
        ariaLabel={t('shortcuts.scopeAria')}
        options={options}
        value={scope}
        onChange={(id) => onScopeChange(id as ShortcutScope)}
      />
    </header>
  )
}

/** Live count on the left, the way out (and the two escape hatches) on the right. */
function CustomizerFoot({
  count,
  customized,
  onOpenStudio,
  onRestore,
  onDone
}: {
  count: number
  customized: boolean
  onOpenStudio?: () => void
  onRestore: () => void
  onDone: () => void
}): React.JSX.Element {
  return (
    <footer className="wb-sc-foot">
      <span className="wb-sc-count" role="status">
        {t('shortcuts.selectedCount', count)}
      </span>
      <div className="wb-sc-foot-actions">
        {onOpenStudio && (
          <button type="button" className="wb-sc-studio-link" onClick={onOpenStudio}>
            <SparkleIcon size={13} />
            {t('shortcuts.openStudioCta')}
          </button>
        )}
        {customized && (
          <Button className="wb-btn" onClick={onRestore}>
            {t('shortcuts.restoreDefaultsCta')}
          </Button>
        )}
        <Button className="wb-btn hds-btn-primary" onClick={onDone}>
          {t('shortcuts.doneCta')}
        </Button>
      </div>
    </footer>
  )
}
