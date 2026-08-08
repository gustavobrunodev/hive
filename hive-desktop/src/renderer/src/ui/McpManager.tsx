import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Field,
  Input,
  Spinner,
  Switch,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@hive/design-system'
import { t } from '../i18n'
import { ChoiceGrid } from './ChoiceCard'
import {
  applyPreset,
  connectionSummary,
  draftFromServer,
  emptyDraft,
  isDraftValid,
  MCP_PRESETS,
  toConfig,
  type McpDraft,
  type McpProbeResult,
  type McpServer,
  type McpToolInfo,
  type McpTransport
} from './mcpForm'
import {
  ActivityIcon,
  AlertTriangleIcon,
  ArrowLeftIcon,
  BroadcastIcon,
  ChevronDownIcon,
  PencilIcon,
  PlugIcon,
  PlusIcon,
  TerminalIcon,
  ToolsIcon,
  TrashIcon,
  ZapIcon
} from './icons'

interface McpManagerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspace: string
  /** Opens the MCP console dock (mcp-logs) — the manager's link to real usage. */
  onOpenConsole: () => void
}

/** The live connection state of one server, driven by the probe. */
type ProbeStatus = 'idle' | 'checking' | 'ok' | 'error'
interface ProbeState {
  status: ProbeStatus
  result: McpProbeResult | null
}

/** The form's mode: adding a fresh server, or editing an existing one by its original name. */
type FormMode = { kind: 'add' } | { kind: 'edit'; originalName: string }

/** The status a row renders with: disabled beats any probe result. */
function rowStatus(server: McpServer, probe: ProbeState | undefined): ProbeStatus | 'disabled' {
  if (!server.enabled) return 'disabled'
  return probe?.status ?? 'idle'
}

/** The transport glyph: a terminal for local commands, a broadcast for remote endpoints. */
function TransportIcon({ transport }: { transport: McpTransport }): React.JSX.Element {
  return transport === 'stdio' ? <TerminalIcon size={12} /> : <BroadcastIcon size={12} />
}

/** The status pill's label for a given state. */
function statusLabel(status: ProbeStatus | 'disabled'): string {
  return t(`mcp.status.${status}` as const)
}

/** One server as a list row: identity, transport, tools, the enable switch, and an expand toggle. */
function ServerRow({
  server,
  probe,
  expanded,
  onToggleExpand,
  onToggleEnabled,
  onTest,
  onEdit,
  onDelete,
  onOpenConsole
}: {
  server: McpServer
  probe: ProbeState | undefined
  expanded: boolean
  onToggleExpand: () => void
  onToggleEnabled: (enabled: boolean) => void
  onTest: () => void
  onEdit: () => void
  onDelete: () => void
  onOpenConsole: () => void
}): React.JSX.Element {
  const status = rowStatus(server, probe)
  const toolCount = probe?.status === 'ok' ? (probe.result?.tools.length ?? 0) : null
  const summary = connectionSummary(server)
  const detailId = `mcp-detail-${server.name}`
  return (
    <div className="wb-mcp-row" data-status={status} data-expanded={expanded || undefined}>
      <div className="wb-mcp-row-head">
        <button
          type="button"
          className="wb-mcp-row-main"
          aria-expanded={expanded}
          aria-controls={detailId}
          onClick={onToggleExpand}
        >
          <span className="wb-mcp-status-dot" data-status={status} aria-hidden="true">
            {status === 'error' ? (
              <AlertTriangleIcon size={11} />
            ) : status === 'checking' ? (
              <span className="wb-mcp-status-spin" />
            ) : null}
          </span>
          <span className="wb-mcp-row-id">
            <span className="wb-mcp-row-name">{server.name}</span>
            <span className="wb-mcp-row-sub">{summary || t('mcp.noTarget')}</span>
          </span>
        </button>
        <div className="wb-mcp-row-meta" aria-hidden={false}>
          <span className="wb-mcp-transport" data-transport={server.transport}>
            <TransportIcon transport={server.transport} />
            {t(`mcp.transport.${server.transport}` as const)}
          </span>
          {toolCount !== null && (
            <span className="wb-mcp-toolcount" title={t('mcp.toolsCountTitle')}>
              <ToolsIcon size={12} />
              {toolCount}
            </span>
          )}
          <span className="wb-mcp-statuspill" data-status={status}>
            {statusLabel(status)}
          </span>
        </div>
        <div className="wb-mcp-row-controls">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="wb-mcp-switch-wrap">
                  <Switch
                    checked={server.enabled}
                    onCheckedChange={(checked) => onToggleEnabled(checked === true)}
                    aria-label={t('mcp.toggleAria', server.name)}
                  />
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {server.enabled ? t('mcp.toggleOnHint') : t('mcp.toggleOffHint')}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <button
            type="button"
            className="wb-mcp-expand"
            aria-label={
              expanded ? t('mcp.collapseAria', server.name) : t('mcp.expandAria', server.name)
            }
            aria-expanded={expanded}
            aria-controls={detailId}
            onClick={onToggleExpand}
          >
            <ChevronDownIcon size={16} />
          </button>
        </div>
      </div>
      {expanded && (
        <ServerDetails
          id={detailId}
          server={server}
          probe={probe}
          onTest={onTest}
          onEdit={onEdit}
          onDelete={onDelete}
          onOpenConsole={onOpenConsole}
        />
      )}
    </div>
  )
}

/** The expanded panel under a row: the connection test, the tool list, logs, and config. */
function ServerDetails({
  id,
  server,
  probe,
  onTest,
  onEdit,
  onDelete,
  onOpenConsole
}: {
  id: string
  server: McpServer
  probe: ProbeState | undefined
  onTest: () => void
  onEdit: () => void
  onDelete: () => void
  onOpenConsole: () => void
}): React.JSX.Element {
  const checking = probe?.status === 'checking'
  const result = probe?.result ?? null
  return (
    <div className="wb-mcp-detail" id={id}>
      <div className="wb-mcp-probe">
        <button
          type="button"
          className="wb-mcp-testbtn"
          onClick={onTest}
          disabled={checking}
          aria-label={t('mcp.testAria', server.name)}
        >
          {checking ? <Spinner size={14} /> : <ZapIcon size={14} />}
          {checking ? t('mcp.testing') : t('mcp.testCta')}
        </button>
        <ProbeSummary probe={probe} />
      </div>

      {probe?.status === 'ok' && result && result.tools.length > 0 && (
        <ServerToolList tools={result.tools} />
      )}

      {result && result.logs !== '' && (
        <div className="wb-mcp-logs-block">
          <span className="wb-mcp-detail-label">{t('mcp.logsHeading')}</span>
          <pre className="wb-mcp-logs" tabIndex={0}>
            {result.logs}
          </pre>
        </div>
      )}

      <ServerConfigSummary server={server} />

      <div className="wb-mcp-detail-actions">
        {/* mcp-logs: the bridge to the console. The probe above answers "can it
          connect"; the console answers "what did it actually do during real
          turns" — different questions, so the manager points at it rather
          than trying to show both here. */}
        <button type="button" className="wb-mcp-linkbtn" onClick={onOpenConsole}>
          <ActivityIcon size={13} />
          {t('mcp.openConsoleCta')}
        </button>
        <button type="button" className="wb-mcp-linkbtn" onClick={onEdit}>
          <PencilIcon size={13} />
          {t('mcp.editCta')}
        </button>
        <button type="button" className="wb-mcp-linkbtn wb-mcp-linkbtn-danger" onClick={onDelete}>
          <TrashIcon size={13} />
          {t('mcp.deleteCta')}
        </button>
      </div>
    </div>
  )
}

/** The result line next to the test button: idle hint, error reason, or a connected summary. */
function ProbeSummary({ probe }: { probe: ProbeState | undefined }): React.JSX.Element {
  if (!probe || probe.status === 'idle') {
    return <span className="wb-mcp-probe-hint">{t('mcp.testHint')}</span>
  }
  if (probe.status === 'checking') {
    return <span className="wb-mcp-probe-hint">{t('mcp.testingHint')}</span>
  }
  const result = probe.result
  if (probe.status === 'error') {
    return (
      <span className="wb-mcp-probe-result" data-status="error">
        {result?.error ?? t('mcp.testFailed')}
      </span>
    )
  }
  const parts = [
    t('mcp.connectedTools', result?.tools.length ?? 0),
    result?.serverName
      ? `${result.serverName}${result.serverVersion ? ` v${result.serverVersion}` : ''}`
      : null,
    result ? t('mcp.connectedMs', result.durationMs) : null
  ].filter((part): part is string => part !== null)
  return (
    <span className="wb-mcp-probe-result" data-status="ok">
      {parts.join(' · ')}
    </span>
  )
}

/** The advertised-tools chip cloud in the expanded panel, each with a description tooltip. */
function ServerToolList({ tools }: { tools: McpToolInfo[] }): React.JSX.Element {
  return (
    <div className="wb-mcp-tools">
      <span className="wb-mcp-detail-label">{t('mcp.toolsHeading', tools.length)}</span>
      <TooltipProvider>
        <div className="wb-mcp-toolchips">
          {tools.map((tool) => (
            <Tooltip key={tool.name}>
              <TooltipTrigger asChild>
                <span className="wb-mcp-toolchip">{tool.name}</span>
              </TooltipTrigger>
              {tool.description !== '' && (
                <TooltipContent className="wb-mcp-tooltip">{tool.description}</TooltipContent>
              )}
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
    </div>
  )
}

/** The connection-config definition list under a row: command/args/env or url/headers. */
function ServerConfigSummary({ server }: { server: McpServer }): React.JSX.Element {
  const rows: { label: string; value: string }[] = []
  if (server.transport === 'stdio') {
    rows.push({ label: t('mcp.fieldCommand'), value: server.command ?? '' })
    if (server.args && server.args.length > 0) {
      rows.push({ label: t('mcp.fieldArgs'), value: server.args.join(' ') })
    }
    if (server.env && Object.keys(server.env).length > 0) {
      rows.push({ label: t('mcp.fieldEnv'), value: Object.keys(server.env).join(', ') })
    }
  } else {
    rows.push({ label: t('mcp.fieldUrl'), value: server.url ?? '' })
    if (server.headers && Object.keys(server.headers).length > 0) {
      rows.push({ label: t('mcp.fieldHeaders'), value: Object.keys(server.headers).join(', ') })
    }
  }
  return (
    <dl className="wb-mcp-config">
      {rows.map((row) => (
        <ConfigRow key={row.label} label={row.label} value={row.value} mono />
      ))}
    </dl>
  )
}

/** One `term → value` line in the expanded config block. */
function ConfigRow({
  label,
  value,
  mono
}: {
  label: string
  value: string
  mono?: boolean
}): React.JSX.Element {
  return (
    <div className="wb-mcp-config-row">
      <dt className="wb-mcp-config-term">{label}</dt>
      <dd className="wb-mcp-config-val" data-mono={mono || undefined}>
        {value}
      </dd>
    </div>
  )
}

/** The gallery header: identity, count, and the add entry point. */
function McpHeader({
  count,
  onAdd
}: {
  count: number | null
  onAdd: () => void
}): React.JSX.Element {
  return (
    <header className="wb-mcp-head">
      <div className="wb-mcp-head-row">
        <span className="wb-mcp-mark" aria-hidden="true">
          <PlugIcon size={16} />
        </span>
        <DialogTitle className="wb-mcp-title">{t('mcp.title')}</DialogTitle>
        {count !== null && count > 0 && (
          <span className="wb-mcp-count">{t('mcp.countLabel', count)}</span>
        )}
        {count !== null && count > 0 && (
          <Button className="wb-btn hds-btn-primary wb-mcp-add" onClick={onAdd}>
            <PlusIcon size={14} />
            {t('mcp.addCta')}
          </Button>
        )}
      </div>
      <DialogDescription className="wb-mcp-desc">{t('mcp.description')}</DialogDescription>
    </header>
  )
}

/** First-run teaching state: what MCP is, the presets, and the from-scratch path. */
function EmptyState({
  onPreset,
  onAdd
}: {
  onPreset: (draft: McpDraft) => void
  onAdd: () => void
}): React.JSX.Element {
  return (
    <div className="wb-mcp-empty">
      <span className="wb-mcp-empty-mark" aria-hidden="true">
        <PlugIcon size={22} />
      </span>
      <h3 className="wb-mcp-empty-title">{t('mcp.emptyTitle')}</h3>
      <p className="wb-mcp-empty-desc">{t('mcp.emptyDescription')}</p>
      <span className="wb-mcp-empty-presets-label">{t('mcp.presetsLabel')}</span>
      <PresetGrid onPreset={onPreset} />
      <button type="button" className="wb-mcp-empty-scratch" onClick={onAdd}>
        <PlusIcon size={14} />
        {t('mcp.addFromScratch')}
      </button>
    </div>
  )
}

/** The curated-starter grid, shared by the empty state and the add form. */
function PresetGrid({ onPreset }: { onPreset: (draft: McpDraft) => void }): React.JSX.Element {
  return (
    <div className="wb-mcp-presets" role="list">
      {MCP_PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          className="wb-mcp-preset"
          role="listitem"
          onClick={() => onPreset(preset.draft)}
        >
          <span className="wb-mcp-preset-top">
            <span className="wb-mcp-preset-glyph" aria-hidden="true">
              <TransportIcon transport={preset.draft.transport} />
            </span>
            <span className="wb-mcp-preset-name">{preset.label}</span>
          </span>
          <span className="wb-mcp-preset-blurb">{preset.blurb}</span>
        </button>
      ))}
    </div>
  )
}

/** The add/edit form: name, transport, and the transport-specific connection fields. */
function McpForm({
  mode,
  draft,
  onDraftChange,
  onPreset,
  onBack,
  onSubmit,
  error,
  saving
}: {
  mode: FormMode
  draft: McpDraft
  onDraftChange: (draft: McpDraft) => void
  onPreset: (draft: McpDraft) => void
  onBack: () => void
  onSubmit: () => void
  error: string | null
  saving: boolean
}): React.JSX.Element {
  const isStdio = draft.transport === 'stdio'
  const valid = isDraftValid(draft)
  return (
    <div className="wb-mcp-form">
      <button type="button" className="wb-mcp-back" onClick={onBack}>
        <ArrowLeftIcon size={14} />
        {t('mcp.backCta')}
      </button>
      <header className="wb-mcp-form-head">
        <DialogTitle className="wb-mcp-title">
          {mode.kind === 'edit' ? t('mcp.editTitle') : t('mcp.addTitle')}
        </DialogTitle>
        <DialogDescription className="wb-mcp-form-desc">
          {mode.kind === 'edit' ? t('mcp.editSubtitle') : t('mcp.addSubtitle')}
        </DialogDescription>
      </header>

      {mode.kind === 'add' && (
        <div className="wb-mcp-form-presets">
          <span className="wb-mcp-detail-label">{t('mcp.presetsLabel')}</span>
          <PresetGrid onPreset={onPreset} />
        </div>
      )}

      <Field label={t('mcp.fieldName')} className="wb-mcp-field">
        <Input
          value={draft.name}
          placeholder={t('mcp.namePlaceholder')}
          onChange={(event) => onDraftChange({ ...draft, name: event.target.value })}
        />
      </Field>

      <ChoiceGrid
        ariaLabel={t('mcp.transportLegend')}
        variant="list"
        options={[
          {
            id: 'stdio',
            icon: <TerminalIcon size={16} />,
            title: t('mcp.transportStdioTitle'),
            description: t('mcp.transportStdioDescription')
          },
          {
            id: 'http',
            icon: <BroadcastIcon size={16} />,
            title: t('mcp.transportRemoteTitle'),
            description: t('mcp.transportRemoteDescription')
          }
        ]}
        value={isStdio ? 'stdio' : 'http'}
        onChange={(id) => onDraftChange({ ...draft, transport: id as McpTransport })}
      />

      {isStdio ? (
        <>
          <Field label={t('mcp.fieldCommand')} className="wb-mcp-field">
            <Input
              value={draft.command}
              placeholder={t('mcp.commandPlaceholder')}
              onChange={(event) => onDraftChange({ ...draft, command: event.target.value })}
            />
          </Field>
          <Field
            label={t('mcp.fieldArgs')}
            description={t('mcp.argsHint')}
            className="wb-mcp-field"
          >
            <Textarea
              value={draft.argsText}
              minRows={2}
              maxRows={6}
              placeholder={t('mcp.argsPlaceholder')}
              onChange={(event) => onDraftChange({ ...draft, argsText: event.target.value })}
            />
          </Field>
          <Field label={t('mcp.fieldEnv')} description={t('mcp.envHint')} className="wb-mcp-field">
            <Textarea
              value={draft.envText}
              minRows={2}
              maxRows={6}
              placeholder={t('mcp.envPlaceholder')}
              onChange={(event) => onDraftChange({ ...draft, envText: event.target.value })}
            />
          </Field>
        </>
      ) : (
        <>
          <Field label={t('mcp.fieldUrl')} className="wb-mcp-field">
            <Input
              value={draft.url}
              placeholder={t('mcp.urlPlaceholder')}
              onChange={(event) => onDraftChange({ ...draft, url: event.target.value })}
            />
          </Field>
          <Field
            label={t('mcp.fieldHeaders')}
            description={t('mcp.headersHint')}
            className="wb-mcp-field"
          >
            <Textarea
              value={draft.headersText}
              minRows={2}
              maxRows={6}
              placeholder={t('mcp.headersPlaceholder')}
              onChange={(event) => onDraftChange({ ...draft, headersText: event.target.value })}
            />
          </Field>
        </>
      )}

      {error !== null && (
        <p className="wb-mcp-form-error" role="alert">
          {error}
        </p>
      )}

      <footer className="wb-mcp-form-foot">
        <Button className="wb-btn" onClick={onBack}>
          {t('mcp.cancelCta')}
        </Button>
        <Button className="wb-btn hds-btn-primary" disabled={!valid || saving} onClick={onSubmit}>
          {saving ? <Spinner size={14} /> : <PlugIcon size={14} />}
          {mode.kind === 'edit' ? t('mcp.saveCta') : t('mcp.createCta')}
        </Button>
      </footer>
    </div>
  )
}

/** The trash confirmation for one server — a sibling dialog, mounted only while pending. */
function DeleteConfirm({
  server,
  error,
  onCancel,
  onConfirm
}: {
  server: McpServer
  error: boolean
  onCancel: () => void
  onConfirm: () => void
}): React.JSX.Element {
  return (
    <Dialog open onOpenChange={(next: boolean) => !next && onCancel()}>
      <DialogContent>
        <DialogTitle>{t('mcp.deleteDialogTitle')}</DialogTitle>
        <DialogDescription>{t('mcp.deleteDialogDescription', server.name)}</DialogDescription>
        {error && (
          <p className="wb-mcp-form-error" role="alert">
            {t('mcp.deleteErrorMessage')}
          </p>
        )}
        <div className="wb-dialog-actions">
          <Button className="wb-btn" onClick={onCancel}>
            {t('mcp.deleteCancelCta')}
          </Button>
          <Button className="wb-btn hds-btn-primary" onClick={onConfirm}>
            {t('mcp.deleteConfirmCta')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * "Servidores MCP" (mcp): the surface where the user manages this workspace's
 * Model Context Protocol servers — the extra tools the agent can call. It
 * lists what's configured in `.mcp.json`, flips each on/off, tests a live
 * connection (status, exposed tools, logs), and adds/edits/removes servers,
 * modeled on Claude Desktop's connector experience. Same closed-state gate as
 * `SkillStudio`: nothing mounts until it opens.
 */
export function McpManager(props: McpManagerProps): React.JSX.Element | null {
  if (!props.open) return null
  return <McpDialog {...props} />
}

function McpDialog({
  open,
  onOpenChange,
  workspace,
  onOpenConsole
}: McpManagerProps): React.JSX.Element {
  const [servers, setServers] = useState<McpServer[] | null>(null)
  const [probes, setProbes] = useState<Record<string, ProbeState>>({})
  const [expanded, setExpanded] = useState<string | null>(null)
  const [form, setForm] = useState<{ mode: FormMode; draft: McpDraft } | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<McpServer | null>(null)
  const [deleteError, setDeleteError] = useState(false)

  const reload = useCallback(async () => {
    const list = await window.hive.mcp.list(workspace)
    setServers(list)
  }, [workspace])

  useEffect(() => {
    let cancelled = false
    void window.hive.mcp.list(workspace).then((list) => {
      if (!cancelled) setServers(list)
    })
    return () => {
      cancelled = true
    }
  }, [workspace])

  const handleToggleEnabled = useCallback(
    (server: McpServer, enabled: boolean) => {
      // Optimistic — the switch reflects intent immediately; a failure reloads truth.
      setServers(
        (current) =>
          current?.map((entry) => (entry.name === server.name ? { ...entry, enabled } : entry)) ??
          current
      )
      void window.hive.mcp.setEnabled(workspace, server.name, enabled).catch(() => void reload())
    },
    [workspace, reload]
  )

  const handleTest = useCallback(
    (server: McpServer) => {
      setProbes((current) => ({ ...current, [server.name]: { status: 'checking', result: null } }))
      void window.hive.mcp
        .probe(workspace, server.name)
        .then((result) => {
          setProbes((current) => ({
            ...current,
            [server.name]: { status: result.ok ? 'ok' : 'error', result }
          }))
        })
        .catch((err: unknown) => {
          setProbes((current) => ({
            ...current,
            [server.name]: {
              status: 'error',
              result: {
                ok: false,
                tools: [],
                logs: '',
                error: err instanceof Error ? err.message : String(err),
                durationMs: 0
              }
            }
          }))
        })
    },
    [workspace]
  )

  const openAdd = useCallback((draft?: McpDraft) => {
    setFormError(null)
    setForm({ mode: { kind: 'add' }, draft: draft ?? emptyDraft() })
  }, [])

  const openEdit = useCallback((server: McpServer) => {
    setFormError(null)
    setForm({ mode: { kind: 'edit', originalName: server.name }, draft: draftFromServer(server) })
  }, [])

  const handlePreset = useCallback(
    (draft: McpDraft) => {
      const applied = applyPreset({ id: '', label: '', blurb: '', draft }, workspace)
      openAdd(applied)
    },
    [workspace, openAdd]
  )

  const handleSubmit = useCallback(async () => {
    if (!form) return
    setSaving(true)
    setFormError(null)
    const config = toConfig(form.draft)
    const name = form.draft.name.trim()
    try {
      if (form.mode.kind === 'edit') {
        await window.hive.mcp.update(workspace, form.mode.originalName, name, config)
      } else {
        await window.hive.mcp.add(workspace, name, config)
      }
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : String(err))
      setSaving(false)
      return
    }
    setSaving(false)
    setForm(null)
    setExpanded(name)
    await reload()
  }, [form, workspace, reload])

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return
    const server = pendingDelete
    setDeleteError(false)
    try {
      await window.hive.mcp.remove(workspace, server.name)
    } catch {
      setDeleteError(true)
      return
    }
    setPendingDelete(null)
    setServers((current) => current?.filter((entry) => entry.name !== server.name) ?? current)
  }, [pendingDelete, workspace])

  const loaded = servers !== null
  const count = loaded ? servers.length : null

  const body = useMemo(() => {
    if (!loaded) {
      return (
        <div className="wb-mcp-loading">
          <Spinner label={t('mcp.loadingLabel')} />
        </div>
      )
    }
    if (servers.length === 0) {
      return <EmptyState onPreset={handlePreset} onAdd={() => openAdd()} />
    }
    return (
      <div className="wb-mcp-list" role="list" aria-label={t('mcp.listAria')}>
        {servers.map((server) => (
          <ServerRow
            key={server.name}
            server={server}
            probe={probes[server.name]}
            expanded={expanded === server.name}
            onToggleExpand={() =>
              setExpanded((current) => (current === server.name ? null : server.name))
            }
            onToggleEnabled={(enabled) => handleToggleEnabled(server, enabled)}
            onTest={() => handleTest(server)}
            onEdit={() => openEdit(server)}
            onDelete={() => {
              setDeleteError(false)
              setPendingDelete(server)
            }}
            onOpenConsole={onOpenConsole}
          />
        ))}
      </div>
    )
  }, [
    loaded,
    servers,
    probes,
    expanded,
    handlePreset,
    handleTest,
    handleToggleEnabled,
    openAdd,
    openEdit,
    onOpenConsole
  ])

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="wb-mcp-dialog">
          {form === null ? (
            <>
              <McpHeader count={count} onAdd={() => openAdd()} />
              {body}
            </>
          ) : (
            <McpForm
              mode={form.mode}
              draft={form.draft}
              onDraftChange={(draft) =>
                setForm((current) => (current ? { ...current, draft } : current))
              }
              onPreset={handlePreset}
              onBack={() => setForm(null)}
              onSubmit={() => void handleSubmit()}
              error={formError}
              saving={saving}
            />
          )}
        </DialogContent>
      </Dialog>
      {pendingDelete !== null && (
        <DeleteConfirm
          server={pendingDelete}
          error={deleteError}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </>
  )
}
