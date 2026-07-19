import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Switch,
  Textarea
} from '@hive/design-system'
import { relativeTimeLabel, t } from '../i18n'
import { ChoiceGrid } from './ChoiceCard'
import {
  buildCreationCommand,
  buildEvalCreateCommand,
  buildEvalRunCommand,
  slugify,
  type StudioCommand
} from './studioPrompts'
import type { RoleAction } from './ActionRail'
import {
  ArrowLeftIcon,
  FileTextIcon,
  GaugeIcon,
  PersonaChatIcon,
  PlayIcon,
  SparkleIcon,
  TrashIcon
} from './icons'

/** Structural mirror of `main/skillStudio.ts`'s `CreatedSkill` (renderer files mirror main types — the `ActionRail`/`ShortcutCustomizer` convention). */
export interface CreatedSkill {
  key: string
  name: string
  description: string
  kind: 'skill' | 'agent'
  persona: string | null
  hasEvals: boolean
  evalCases: number
  relPath: string
  updatedAt: number
}

/** Mirror of `main/configStore.ts`'s `ShortcutPrefs`. */
interface ShortcutPrefs {
  skills: string[]
  agents: string[]
}

/** One curated model/effort option — structural mirror of `main/agentAdapter.ts`'s `AgentOption`. */
interface AgentOption {
  id: string
  label: string
}

/**
 * How the studio wants an action run. `newConversation` (only set for a
 * "Criar" launch) tells the chat to open a fresh conversation for the builder
 * and background anything still generating; `model`/`effort` override the
 * session default for that turn (the studio's run-config pickers).
 */
export interface StudioLaunchOpts {
  newConversation?: boolean
  model?: string
  effort?: string
}

interface SkillStudioProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspace: string
  role: string | null
  /**
   * background-turns: whether any conversation is currently generating — the
   * create form uses it to reassure that launching a build won't drop it (it
   * moves to the background).
   */
  hasRunningConversation?: boolean
  /** Hands a composed builder/eval/test turn to the chat (the studio never talks to the agent itself). */
  onLaunch: (action: RoleAction, opts?: StudioLaunchOpts) => void
  /** Fired after a pin/unpin persisted — the parent re-resolves the live shortcut set. */
  onShortcutsChanged: () => void
  /** Opens a workspace-relative file in the editor pane (SKILL.md inspection). */
  onOpenFile: (relPath: string) => void
}

/** The create-form draft; `kind` mirrors the gallery entry point that opened it. */
interface Draft {
  kind: 'skill' | 'agent'
  name: string
  idea: string
  persona: string
  withEvals: boolean
}

function emptyDraft(kind: 'skill' | 'agent'): Draft {
  return { kind, name: '', idea: '', persona: '', withEvals: true }
}

/** Maps the current role's default actions to prefs lists — the pin baseline before any customization exists (ShortcutCustomizer's rule). */
function prefsFromDefaults(actions: { kind: string; command: { key: string } }[]): ShortcutPrefs {
  return {
    skills: actions.filter((a) => a.kind === 'workflow').map((a) => a.command.key),
    agents: actions.filter((a) => a.kind === 'persona').map((a) => a.command.key)
  }
}

/** A created skill's launchable chat action: the shortcut contract (`/key`), so testing from the studio = clicking its future shortcut. */
function testAction(skill: CreatedSkill): RoleAction {
  return {
    key: skill.key,
    kind: skill.kind === 'agent' ? 'persona' : 'workflow',
    command: { key: skill.key, prompt: `/${skill.key}` },
    label: skill.name
  }
}

/** Wraps a `StudioCommand` (builder/eval briefing) as the chat-launchable action shape. */
function commandAction(command: StudioCommand): RoleAction {
  return { key: command.key, kind: 'workflow', command }
}

/** The evals badge for a card: none / ready / n cases. */
function evalsBadgeText(skill: CreatedSkill): string {
  if (!skill.hasEvals) return t('studio.evalsNoneBadge')
  if (skill.evalCases === 0) return t('studio.evalsReadyBadge')
  return t('studio.evalsCountBadge', skill.evalCases)
}

/** One creation in the gallery: identity, evals state, and its full action row. */
function StudioCard({
  skill,
  pinned,
  onTest,
  onEvals,
  onTogglePin,
  onOpenFile,
  onDelete
}: {
  skill: CreatedSkill
  pinned: boolean
  onTest: (skill: CreatedSkill) => void
  onEvals: (skill: CreatedSkill) => void
  onTogglePin: (skill: CreatedSkill) => void
  onOpenFile: (skill: CreatedSkill) => void
  onDelete: (skill: CreatedSkill) => void
}): React.JSX.Element {
  const isAgent = skill.kind === 'agent'
  const initial = (skill.persona ?? skill.name)[0]?.toUpperCase()
  return (
    <article className="wb-studio-card" data-kind={skill.kind} aria-label={skill.name}>
      <div className="wb-studio-card-head">
        {isAgent ? (
          <span className="wb-studio-card-avatar" aria-hidden="true">
            {initial ?? <PersonaChatIcon size={15} />}
          </span>
        ) : (
          <span className="wb-studio-card-glyph" aria-hidden="true">
            <SparkleIcon size={15} />
          </span>
        )}
        <div className="wb-studio-card-id">
          <span className="wb-studio-card-title">
            {skill.name}
            <Badge variant="muted" className="wb-studio-kind-badge">
              {isAgent ? t('studio.kindAgentBadge') : t('studio.kindSkillBadge')}
            </Badge>
            {pinned && (
              <Badge variant="accent" className="wb-studio-pin-badge">
                {t('studio.pinnedBadge')}
              </Badge>
            )}
          </span>
          <span className="wb-studio-card-command">/{skill.key}</span>
        </div>
      </div>
      {skill.description !== '' && <p className="wb-studio-card-desc">{skill.description}</p>}
      <div className="wb-studio-card-meta">
        <span className="wb-studio-evals" data-none={!skill.hasEvals || undefined}>
          <GaugeIcon size={12} />
          {evalsBadgeText(skill)}
        </span>
        <span className="wb-studio-updated">
          {t('studio.updatedLabel', relativeTimeLabel(skill.updatedAt))}
        </span>
      </div>
      <div className="wb-studio-card-actions">
        <button
          type="button"
          className="wb-studio-action wb-studio-action-primary"
          aria-label={t('studio.runAria', skill.name)}
          onClick={() => onTest(skill)}
        >
          <PlayIcon size={13} />
          {t('studio.runCta')}
        </button>
        <button
          type="button"
          className="wb-studio-action"
          aria-label={
            skill.hasEvals
              ? t('studio.evalsRunAria', skill.name)
              : t('studio.evalsCreateAria', skill.name)
          }
          onClick={() => onEvals(skill)}
        >
          <GaugeIcon size={13} />
          {skill.hasEvals ? t('studio.evalsRunCta') : t('studio.evalsCreateCta')}
        </button>
        <button
          type="button"
          className="wb-studio-action"
          aria-pressed={pinned}
          aria-label={pinned ? t('studio.unpinAria', skill.name) : t('studio.pinAria', skill.name)}
          onClick={() => onTogglePin(skill)}
        >
          <SparkleIcon size={13} />
          {pinned ? t('studio.unpinCta') : t('studio.pinCta')}
        </button>
        <span className="wb-studio-card-actions-spacer" />
        <button
          type="button"
          className="wb-studio-iconbtn"
          title={t('studio.openFileCta')}
          aria-label={t('studio.openFileAria', skill.name)}
          onClick={() => onOpenFile(skill)}
        >
          <FileTextIcon size={14} />
        </button>
        <button
          type="button"
          className="wb-studio-iconbtn wb-studio-iconbtn-danger"
          title={t('studio.deleteCta')}
          aria-label={t('studio.deleteAria', skill.name)}
          onClick={() => onDelete(skill)}
        >
          <TrashIcon size={14} />
        </button>
      </div>
    </article>
  )
}

/** First-run teaching state: the two creation paths ARE the empty state. */
function EmptyState({
  onCreate
}: {
  onCreate: (kind: 'skill' | 'agent') => void
}): React.JSX.Element {
  return (
    <div className="wb-studio-empty">
      <h3 className="wb-studio-empty-title">{t('studio.emptyTitle')}</h3>
      <p className="wb-studio-empty-desc">{t('studio.emptyDescription')}</p>
      <div className="wb-studio-empty-cards">
        <button type="button" className="wb-studio-empty-card" onClick={() => onCreate('skill')}>
          <span className="wb-studio-card-glyph" aria-hidden="true">
            <SparkleIcon size={16} />
          </span>
          <span className="wb-studio-empty-card-title">{t('studio.emptySkillCardTitle')}</span>
          <span className="wb-studio-empty-card-desc">{t('studio.emptySkillCardDescription')}</span>
        </button>
        <button type="button" className="wb-studio-empty-card" onClick={() => onCreate('agent')}>
          <span className="wb-studio-card-avatar" aria-hidden="true">
            <PersonaChatIcon size={15} />
          </span>
          <span className="wb-studio-empty-card-title">{t('studio.emptyAgentCardTitle')}</span>
          <span className="wb-studio-empty-card-desc">{t('studio.emptyAgentCardDescription')}</span>
        </button>
      </div>
    </div>
  )
}

/**
 * The generation run-config the create form collects — the same two levers the
 * chat composer exposes (model + effort), so a build launched from the studio
 * runs exactly like one the user would drive by hand. Held at the dialog level
 * (not per-draft) so the choice survives switching between skill/agent, mirror
 * of how the chat keeps model/effort as session state.
 */
interface RunConfig {
  models: AgentOption[]
  efforts: AgentOption[]
  model: string | null
  effort: string | null
  onModelChange: (id: string) => void
  onEffortChange: (id: string) => void
  /** Capabilities still loading — the selects render disabled until they land. */
  loading: boolean
}

/**
 * Model + effort pickers for the create form — the studio's echo of the chat
 * composer's run controls (DS `Select`, one vocabulary), so the user sets how
 * the build runs before handing off. Bordered full-width triggers here (not
 * the composer's borderless compact variant) so they read as form fields
 * alongside the name/idea inputs.
 */
function StudioRunConfig({ config }: { config: RunConfig }): React.JSX.Element {
  return (
    <fieldset className="wb-studio-run" disabled={config.loading}>
      <legend className="wb-studio-run-legend">{t('studio.runConfigLegend')}</legend>
      <div className="wb-studio-run-grid">
        <Field label={t('studio.modelLabel')} className="wb-studio-run-field">
          <Select
            value={config.model ?? undefined}
            onValueChange={config.onModelChange}
            disabled={config.loading}
          >
            <SelectTrigger aria-label={t('studio.modelLabel')}>
              <SelectValue placeholder={t('studio.runConfigLoading')} />
            </SelectTrigger>
            <SelectContent>
              {config.models.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field
          label={t('studio.effortLabel')}
          description={t('studio.effortHint')}
          className="wb-studio-run-field"
        >
          <Select
            value={config.effort ?? undefined}
            onValueChange={config.onEffortChange}
            disabled={config.loading}
          >
            <SelectTrigger aria-label={t('studio.effortLabel')}>
              <SelectValue placeholder={t('studio.runConfigLoading')} />
            </SelectTrigger>
            <SelectContent>
              {config.efforts.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
    </fieldset>
  )
}

/** The create view: a short briefing form; the BMAD builder does the actual building in chat. */
function CreateForm({
  draft,
  onDraftChange,
  onBack,
  onCreate,
  runConfig,
  hasRunningConversation
}: {
  draft: Draft
  onDraftChange: (draft: Draft) => void
  onBack: () => void
  onCreate: (draft: Draft) => void
  runConfig: RunConfig
  hasRunningConversation: boolean
}): React.JSX.Element {
  const isAgent = draft.kind === 'agent'
  const slug = slugify(draft.name)
  const valid = draft.name.trim() !== '' && draft.idea.trim() !== ''
  return (
    <div className="wb-studio-create">
      <button type="button" className="wb-studio-back" onClick={onBack}>
        <ArrowLeftIcon size={14} />
        {t('studio.backCta')}
      </button>
      <ChoiceGrid
        ariaLabel={t('studio.kindLegend')}
        variant="list"
        options={[
          {
            id: 'skill',
            icon: <SparkleIcon size={16} />,
            title: t('studio.kindSkillTitle'),
            description: t('studio.kindSkillDescription')
          },
          {
            id: 'agent',
            icon: <PersonaChatIcon size={16} />,
            title: t('studio.kindAgentTitle'),
            description: t('studio.kindAgentDescription')
          }
        ]}
        value={draft.kind}
        onChange={(id) => onDraftChange({ ...draft, kind: id as Draft['kind'] })}
      />
      <Field label={t('studio.nameLabel')} className="wb-studio-field">
        <Input
          value={draft.name}
          placeholder={
            isAgent ? t('studio.namePlaceholderAgent') : t('studio.namePlaceholderSkill')
          }
          onChange={(event) => onDraftChange({ ...draft, name: event.target.value })}
        />
      </Field>
      {slug !== '' && <p className="wb-studio-slug">{t('studio.slugPreview', slug)}</p>}
      {isAgent && (
        <Field
          label={t('studio.personaLabel')}
          description={t('studio.personaHint')}
          className="wb-studio-field"
        >
          <Input
            value={draft.persona}
            placeholder={t('studio.personaPlaceholder')}
            onChange={(event) => onDraftChange({ ...draft, persona: event.target.value })}
          />
        </Field>
      )}
      <Field
        label={isAgent ? t('studio.ideaLabelAgent') : t('studio.ideaLabelSkill')}
        className="wb-studio-field"
      >
        <Textarea
          value={draft.idea}
          minRows={4}
          maxRows={8}
          placeholder={t('studio.ideaPlaceholder')}
          onChange={(event) => onDraftChange({ ...draft, idea: event.target.value })}
        />
      </Field>
      <label className="wb-studio-evals-opt">
        <Switch
          checked={draft.withEvals}
          onCheckedChange={(checked) => onDraftChange({ ...draft, withEvals: checked === true })}
        />
        <span className="wb-studio-evals-opt-text">
          <span className="wb-studio-evals-opt-label">{t('studio.withEvalsLabel')}</span>
          <span className="wb-studio-evals-opt-hint">{t('studio.withEvalsHint')}</span>
        </span>
      </label>
      <StudioRunConfig config={runConfig} />
      <footer className="wb-studio-create-foot">
        <p className="wb-studio-handoff">
          {t('studio.handoffHint')}
          {hasRunningConversation && (
            <span className="wb-studio-handoff-bg">{t('studio.handoffBackgroundNote')}</span>
          )}
        </p>
        <Button
          className="wb-btn hds-btn-primary"
          disabled={!valid}
          onClick={() => onCreate(draft)}
        >
          <SparkleIcon size={14} />
          {t('studio.createCta')}
        </Button>
      </footer>
    </div>
  )
}

/** The gallery header: the studio's identity + the two create entry points once creations exist. */
function StudioHeader({
  count,
  onCreate
}: {
  /** `null` while loading, otherwise how many creations exist (entry points show only for > 0). */
  count: number | null
  onCreate: (kind: 'skill' | 'agent') => void
}): React.JSX.Element {
  return (
    <header className="wb-studio-head">
      <div className="wb-studio-head-row">
        <span className="wb-studio-mark" aria-hidden="true">
          <SparkleIcon size={16} />
        </span>
        <DialogTitle className="wb-studio-title">{t('studio.title')}</DialogTitle>
        {count !== null && count > 0 && (
          <span className="wb-studio-count">{t('studio.countLabel', count)}</span>
        )}
      </div>
      <DialogDescription className="wb-studio-desc">{t('studio.description')}</DialogDescription>
      {count !== null && count > 0 && (
        <div className="wb-studio-head-actions">
          <Button variant="ghost" className="wb-btn" onClick={() => onCreate('agent')}>
            <PersonaChatIcon size={14} />
            {t('studio.newAgentCta')}
          </Button>
          <Button className="wb-btn hds-btn-primary" onClick={() => onCreate('skill')}>
            <SparkleIcon size={14} />
            {t('studio.newSkillCta')}
          </Button>
        </div>
      )}
    </header>
  )
}

/** The trash confirmation for one creation — a sibling dialog, mounted only while a delete is pending. */
function DeleteConfirm({
  skill,
  error,
  onCancel,
  onConfirm
}: {
  skill: CreatedSkill
  error: boolean
  onCancel: () => void
  onConfirm: () => void
}): React.JSX.Element {
  return (
    <Dialog open onOpenChange={(next: boolean) => !next && onCancel()}>
      <DialogContent>
        <DialogTitle>{t('studio.deleteDialogTitle')}</DialogTitle>
        <DialogDescription>{t('studio.deleteDialogDescription', skill.name)}</DialogDescription>
        {error && (
          <p className="wb-studio-delete-error" role="alert">
            {t('studio.deleteErrorMessage')}
          </p>
        )}
        <div className="wb-dialog-actions">
          <Button className="wb-btn" onClick={onCancel}>
            {t('studio.deleteCancelCta')}
          </Button>
          <Button className="wb-btn hds-btn-primary" onClick={onConfirm}>
            {t('studio.deleteConfirmCta')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * "Estúdio de skills" (skill-studio): the surface where the user creates
 * skills and agents of their own — through the BMAD builder skills
 * (`bmad-workflow-builder`/`bmad-agent-builder`), with starter evals and a
 * `bmad-eval-runner` loop — and pins the results as shortcuts. The studio
 * itself never generates anything: it composes a briefing, hands it to the
 * chat, and rediscovers the creation on disk when the builder is done (the
 * Claude-Desktop pattern: creation is a conversation, the gallery is the
 * durable surface).
 *
 * Same thin closed-state gate as `ShortcutCustomizer`: nothing mounts until
 * the studio opens.
 */
export function SkillStudio(props: SkillStudioProps): React.JSX.Element | null {
  if (!props.open) return null
  return <StudioDialog {...props} />
}

function StudioDialog({
  open,
  onOpenChange,
  workspace,
  role,
  hasRunningConversation = false,
  onLaunch,
  onShortcutsChanged,
  onOpenFile
}: SkillStudioProps): React.JSX.Element {
  const [created, setCreated] = useState<CreatedSkill[] | null>(null)
  // The pin baseline: stored prefs when customized, role defaults otherwise
  // (mirrors ShortcutCustomizer's selection rule so both stay consistent).
  const [prefs, setPrefs] = useState<ShortcutPrefs | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [pendingDelete, setPendingDelete] = useState<CreatedSkill | null>(null)
  const [deleteError, setDeleteError] = useState(false)
  // Run-config: the same model/effort levers the chat exposes, driven by the
  // active adapter's capabilities. Defaults to the first of each once loaded,
  // and rides along with the "Criar" launch as a per-turn override.
  const [capabilities, setCapabilities] = useState<{
    models: AgentOption[]
    efforts: AgentOption[]
  } | null>(null)
  const [model, setModel] = useState<string | null>(null)
  const [effort, setEffort] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void window.hive.agent.capabilities().then((caps) => {
      if (cancelled) return
      setCapabilities({ models: caps.models, efforts: caps.efforts })
      setModel((current) => current ?? caps.models[0]?.id ?? null)
      setEffort((current) => current ?? caps.efforts[0]?.id ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    // Locally-defined async function invoked immediately (the repo's
    // GuidedInstall `load()` pattern) — react-hooks/set-state-in-effect.
    async function load(): Promise<void> {
      const [skills, stored] = await Promise.all([
        window.hive.studio.list(workspace),
        window.hive.shortcuts.get()
      ])
      if (cancelled) return
      setCreated(skills)
      if (stored) {
        setPrefs(stored)
        return
      }
      const defaults = await window.hive.profile.roleActions(role)
      if (cancelled) return
      setPrefs(prefsFromDefaults(defaults))
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [workspace, role])

  const pinnedKeys = useMemo(
    () => new Set([...(prefs?.skills ?? []), ...(prefs?.agents ?? [])]),
    [prefs]
  )

  /** Launch-and-close: every studio action lands in the chat, which is where the work continues. */
  const launch = useCallback(
    (action: RoleAction) => {
      onLaunch(action)
      onOpenChange(false)
    },
    [onLaunch, onOpenChange]
  )

  const handleTest = useCallback((skill: CreatedSkill) => launch(testAction(skill)), [launch])

  const handleEvals = useCallback(
    (skill: CreatedSkill) => {
      const command = skill.hasEvals ? buildEvalRunCommand(skill) : buildEvalCreateCommand(skill)
      launch(commandAction(command))
    },
    [launch]
  )

  // "Criar" is the one launch that opens a *new* conversation (backgrounding
  // anything still generating) and carries the studio's chosen model/effort as
  // a per-turn override — the build always starts clean, on the picked model.
  const handleCreate = useCallback(
    (final: Draft) => {
      onLaunch(commandAction(buildCreationCommand(final)), {
        newConversation: true,
        model: model ?? undefined,
        effort: effort ?? undefined
      })
      onOpenChange(false)
    },
    [onLaunch, onOpenChange, model, effort]
  )

  const handleTogglePin = useCallback(
    (skill: CreatedSkill) => {
      setPrefs((current) => {
        if (!current) return current
        const listKey = skill.kind === 'agent' ? 'agents' : 'skills'
        const list = current[listKey]
        const next = list.includes(skill.key)
          ? list.filter((key) => key !== skill.key)
          : [...list, skill.key]
        const updated = { ...current, [listKey]: next }
        // Persist-and-notify per toggle (whole-object writes, last write
        // wins) — the hero/strip behind the dialog update live.
        void window.hive.shortcuts.set(updated).then(onShortcutsChanged)
        return updated
      })
    },
    [onShortcutsChanged]
  )

  const handleOpenFile = useCallback(
    (skill: CreatedSkill) => {
      onOpenFile(`${skill.relPath}/SKILL.md`)
      onOpenChange(false)
    },
    [onOpenFile, onOpenChange]
  )

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return
    const skill = pendingDelete
    setDeleteError(false)
    try {
      await window.hive.fs.trash(workspace, skill.relPath)
    } catch {
      setDeleteError(true)
      return
    }
    setPendingDelete(null)
    setCreated((current) => current?.filter((entry) => entry.key !== skill.key) ?? current)
    // A pinned creation that no longer exists shouldn't linger in the prefs.
    setPrefs((current) => {
      if (!current || !pinnedKeys.has(skill.key)) return current
      const updated = {
        skills: current.skills.filter((key) => key !== skill.key),
        agents: current.agents.filter((key) => key !== skill.key)
      }
      void window.hive.shortcuts.set(updated).then(onShortcutsChanged)
      return updated
    })
  }, [pendingDelete, workspace, pinnedKeys, onShortcutsChanged])

  const loaded = created !== null

  function renderGallery(): React.JSX.Element {
    if (!loaded) {
      return (
        <div className="wb-studio-loading">
          <Spinner label={t('studio.loadingLabel')} />
        </div>
      )
    }
    if (created.length === 0) {
      return <EmptyState onCreate={(kind) => setDraft(emptyDraft(kind))} />
    }
    return (
      <div className="wb-studio-gallery" role="list" aria-label={t('studio.galleryAria')}>
        {created.map((skill) => (
          <StudioCard
            key={skill.key}
            skill={skill}
            pinned={pinnedKeys.has(skill.key)}
            onTest={handleTest}
            onEvals={handleEvals}
            onTogglePin={handleTogglePin}
            onOpenFile={handleOpenFile}
            onDelete={(entry) => {
              setDeleteError(false)
              setPendingDelete(entry)
            }}
          />
        ))}
      </div>
    )
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="wb-studio-dialog">
          {draft === null ? (
            <>
              <StudioHeader
                count={loaded ? created.length : null}
                onCreate={(kind) => setDraft(emptyDraft(kind))}
              />
              {renderGallery()}
            </>
          ) : (
            <>
              <header className="wb-studio-head">
                <div className="wb-studio-head-row">
                  <span className="wb-studio-mark" aria-hidden="true">
                    <SparkleIcon size={16} />
                  </span>
                  <DialogTitle className="wb-studio-title">
                    {draft.kind === 'agent'
                      ? t('studio.createTitleAgent')
                      : t('studio.createTitleSkill')}
                  </DialogTitle>
                </div>
              </header>
              <CreateForm
                draft={draft}
                onDraftChange={setDraft}
                onBack={() => setDraft(null)}
                onCreate={handleCreate}
                hasRunningConversation={hasRunningConversation}
                runConfig={{
                  models: capabilities?.models ?? [],
                  efforts: capabilities?.efforts ?? [],
                  model,
                  effort,
                  onModelChange: setModel,
                  onEffortChange: setEffort,
                  loading: capabilities === null
                }}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
      {pendingDelete !== null && (
        <DeleteConfirm
          skill={pendingDelete}
          error={deleteError}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </>
  )
}
