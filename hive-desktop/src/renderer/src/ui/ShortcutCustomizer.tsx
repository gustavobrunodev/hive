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
  DialogTitle
} from '@hive/design-system'
import { agentMeta, shortcutLabel, t } from '../i18n'
import { commandFilter } from './shortcutSearch'
import { skillIcon } from './roleVisuals'
import { CheckIcon, PersonaChatIcon, SparkleIcon } from './icons'

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

/** The two selection lists, mirroring `main/configStore.ts`'s `ShortcutPrefs`. */
interface Selection {
  skills: string[]
  agents: string[]
}

interface ShortcutCustomizerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspace: string
  role: string | null
  /** Fired after every persisted change — the parent re-resolves the live
   *  shortcut set, so the hero/strip behind the dialog update in place. */
  onChanged: () => void
  /** skill-studio: opens the Skill Studio (the "create your own" path out of this picker). */
  onOpenStudio?: () => void
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

/** Maps the current role's default actions to selection lists (the pre-checked state before any customization exists). */
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
 * "Personalizar atalhos" (shortcut-customization): a searchable picker over
 * the workspace's full BMAD skill catalog, split into **Agentes** (the
 * "talk to <persona>" specialists — any number can be chosen) and **Skills**
 * (workflows). Selection starts as the role's defaults and every toggle
 * persists immediately — the hero pills and the composer strip behind the
 * dialog update live, which doubles as the preview. "Restaurar padrão do
 * papel" drops the customization (`shortcuts.set(null)`) and re-checks the
 * role defaults.
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
  onChanged,
  onOpenStudio
}: ShortcutCustomizerProps): React.JSX.Element {
  const [catalog, setCatalog] = useState<WorkspaceSkill[] | null>(null)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [customized, setCustomized] = useState(false)

  useEffect(() => {
    let cancelled = false
    // Locally-defined async function invoked immediately (the repo's
    // GuidedInstall `load()` pattern) — react-hooks/set-state-in-effect.
    async function load(): Promise<void> {
      const [entries, prefs] = await Promise.all([
        window.hive.shortcuts.catalog(workspace),
        window.hive.shortcuts.get()
      ])
      if (cancelled) return
      setCatalog(entries)
      if (prefs) {
        setSelection(prefs)
        setCustomized(true)
        return
      }
      const defaults = await window.hive.profile.roleActions(role)
      if (cancelled) return
      setSelection(selectionFromDefaults(defaults))
      setCustomized(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [workspace, role])

  const toggle = useCallback(
    (skill: WorkspaceSkill) => {
      setSelection((current) => {
        if (!current) return current
        const listKey = skill.kind === 'agent' ? 'agents' : 'skills'
        const list = current[listKey]
        const next = list.includes(skill.key)
          ? list.filter((key) => key !== skill.key)
          : [...list, skill.key]
        const updated = { ...current, [listKey]: next }
        // Persist-and-notify per toggle: writes are whole-object, so rapid
        // toggles can't interleave into a corrupt state (last write wins).
        void window.hive.shortcuts.set(updated).then(onChanged)
        return updated
      })
      setCustomized(true)
    },
    [onChanged]
  )

  const restore = useCallback(async () => {
    await window.hive.shortcuts.set(null)
    const defaults = await window.hive.profile.roleActions(role)
    setSelection(selectionFromDefaults(defaults))
    setCustomized(false)
    onChanged()
  }, [role, onChanged])

  // skill-studio: user creations get their own group up top; the stock BMAD
  // groups keep their original membership below.
  const { customs, agents, skills } = splitCatalog(catalog ?? [])
  const catalogKeys = new Set((catalog ?? []).map((skill) => skill.key))
  const selectedCount = [...(selection?.skills ?? []), ...(selection?.agents ?? [])].filter((key) =>
    catalogKeys.has(key)
  ).length
  const loaded = catalog !== null && selection !== null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="wb-sc-dialog">
        <header className="wb-sc-head">
          <div className="wb-sc-head-row">
            <DialogTitle className="wb-sc-title-main">{t('shortcuts.customizeTitle')}</DialogTitle>
            <Badge variant={customized ? 'accent' : 'muted'} className="wb-sc-state-badge">
              {customized ? t('shortcuts.customBadge') : t('shortcuts.roleDefaultBadge')}
            </Badge>
          </div>
          <DialogDescription className="wb-sc-desc">
            {t('shortcuts.dialogDescription')}
          </DialogDescription>
        </header>
        {loaded && catalog.length === 0 ? (
          <p className="wb-sc-empty-catalog">{t('shortcuts.emptyCatalog')}</p>
        ) : (
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
              {loaded && (
                <>
                  <CatalogGroup
                    label={t('shortcuts.createdGroupLabel')}
                    entries={customs}
                    selectedKeys={[...selection.skills, ...selection.agents]}
                    onToggle={toggle}
                  />
                  <CatalogGroup
                    label={t('shortcuts.agentsGroupLabel')}
                    entries={agents}
                    selectedKeys={selection.agents}
                    onToggle={toggle}
                  />
                  <CatalogGroup
                    label={t('shortcuts.skillsGroupLabel')}
                    entries={skills}
                    selectedKeys={selection.skills}
                    onToggle={toggle}
                  />
                </>
              )}
            </CommandList>
          </Command>
        )}
        <footer className="wb-sc-foot">
          <span className="wb-sc-count" role="status">
            {t('shortcuts.selectedCount', selectedCount)}
          </span>
          <div className="wb-sc-foot-actions">
            {onOpenStudio && (
              <button type="button" className="wb-sc-studio-link" onClick={onOpenStudio}>
                <SparkleIcon size={13} />
                {t('shortcuts.openStudioCta')}
              </button>
            )}
            {customized && (
              <Button className="wb-btn" onClick={() => void restore()}>
                {t('shortcuts.restoreDefaultsCta')}
              </Button>
            )}
            <Button className="wb-btn hds-btn-primary" onClick={() => onOpenChange(false)}>
              {t('shortcuts.doneCta')}
            </Button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  )
}
