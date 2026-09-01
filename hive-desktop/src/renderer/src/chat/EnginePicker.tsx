import { useMemo } from 'react'
import { OptionPicker, SegmentedControl } from '@hive/design-system'
import type { PickerOption } from '@hive/design-system'
import { t } from '../i18n'
import { modelTraitLabel } from '../i18n/pt-BR'
import {
  ChevronDownIcon,
  RefreshIcon,
  TierAutoIcon,
  TierBalancedIcon,
  TierFastIcon,
  TierFlagshipIcon,
  TierLegacyIcon,
  TierRouterIcon
} from '../ui/icons'
import {
  describeOption,
  distinctVendors,
  formatTokens,
  groupOf,
  groupsFor,
  noteLine,
  sourceLine,
  type EngineCapabilities,
  type EngineOption
} from './engineOptions'

interface EnginePickerProps {
  capabilities: EngineCapabilities
  /** The chosen model id; `''` is the meaningful "let the CLI decide" value. */
  model: string | null
  effort: string | null
  onModelChange: (id: string) => void
  onEffortChange: (id: string) => void
  /**
   * The model the CLI actually reported for this conversation (`usage.model`).
   * The only *proof* of what ran — an alias resolves differently per machine,
   * per provider and per CLI version — so it is shown as the footer's evidence
   * line once a turn has answered, and never invented before then.
   */
  runningModel?: string | null
  /** Re-reads the machine (settings, config, CLI listing) instead of the cache. */
  onRefresh: () => void
  refreshing: boolean
}

/**
 * The composer's engine control: **one** button that opens **one** panel
 * holding the whole "how much horsepower" decision — which model, and how hard
 * it should think.
 *
 * It replaces two anonymous dropdowns that read `Opus` and `Low` with no
 * explanation of either, and it reshapes itself around whatever the active
 * agent turns out to support:
 *
 *  - Claude: seventeen rows across four groups, a filter field, and the effort
 *    ladder in the footer.
 *  - Copilot: rows grouped by vendor (Anthropic / OpenAI / Google) and **no**
 *    effort section, because that CLI has no such flag.
 *  - Devin: whatever `devin models list` answered, with Adaptive — a real
 *    router — marked as one.
 *
 * None of that shape is hardcoded here: the groups, the copy, the provenance
 * line and the presence of the effort control all come off the capabilities the
 * main process detected.
 */
export function EnginePicker({
  capabilities,
  model,
  effort,
  onModelChange,
  onEffortChange,
  runningModel,
  onRefresh,
  refreshing
}: EnginePickerProps): React.JSX.Element | null {
  const { models, efforts } = capabilities
  const current = models.find((option) => option.id === model) ?? models[0] ?? null
  const currentEffort = efforts.find((option) => option.id === effort) ?? null
  const byVendor = distinctVendors(models).length > 1

  const options = useMemo(
    () => models.map((option) => toPickerOption(option, byVendor)),
    [models, byVendor]
  )
  const groups = useMemo(() => groupsFor(models), [models])

  if (models.length === 0) return null

  return (
    <OptionPicker
      options={options}
      groups={groups}
      value={current?.id ?? ''}
      onChange={onModelChange}
      ariaLabel={t('chat.engine.modelListAria')}
      searchPlaceholder={t('chat.engine.searchPlaceholder')}
      emptyLabel={t('chat.engine.empty')}
      width={400}
      footer={
        <EngineFooter
          capabilities={capabilities}
          currentEffort={currentEffort}
          onEffortChange={onEffortChange}
          runningModel={runningModel ?? null}
          onRefresh={onRefresh}
          refreshing={refreshing}
        />
      }
    >
      <EngineTrigger model={current} effort={currentEffort} />
    </OptionPicker>
  )
}

/**
 * The closed control. It carries the whole decision in one line — the model,
 * what "Automático" resolves to, and the effort — so the common case (glance,
 * keep going) never needs the panel at all.
 */
function EngineTrigger({
  model,
  effort
}: {
  model: EngineOption | null
  effort: EngineOption | null
}): React.JSX.Element {
  const label = model?.label ?? t('chat.modelLabel')
  // "Automático" alone does not say what will run. When the CLI's own default
  // is known, the trigger names it — that is the whole reason to trust the
  // automatic row instead of routing around it.
  const resolved = model?.traits?.includes('cli-default') ? model.resolvedId : undefined
  return (
    <button
      type="button"
      className="wb-engine-btn"
      aria-label={t('chat.engine.triggerAria', label)}
    >
      <span className="wb-engine-glyph" aria-hidden="true">
        {tierIcon(model?.traits, 14)}
      </span>
      <span className="wb-engine-name">{label}</span>
      {resolved && <span className="wb-engine-resolved">{resolved}</span>}
      {/* The effort rides along so the second half of the decision is legible
          without opening anything — except on the automatic row, where there
          is nothing to report. */}
      {effort && effort.id !== '' && <span className="wb-engine-effort-chip">{effort.label}</span>}
      <ChevronDownIcon size={12} />
    </button>
  )
}

/**
 * The panel's lower half: the effort ladder (when the agent has one) over the
 * provenance line. Both belong under the list rather than beside it — they
 * qualify the choice above them, and a user who never looks has lost nothing.
 */
function EngineFooter({
  capabilities,
  currentEffort,
  onEffortChange,
  runningModel,
  onRefresh,
  refreshing
}: {
  capabilities: EngineCapabilities
  currentEffort: EngineOption | null
  onEffortChange: (id: string) => void
  runningModel: string | null
  onRefresh: () => void
  refreshing: boolean
}): React.JSX.Element {
  return (
    <div className="wb-engine-foot">
      {capabilities.efforts.length > 0 && (
        <div className="wb-engine-effort">
          <div className="wb-engine-effort-head">
            <span className="wb-engine-effort-title">{t('chat.engine.effortHeading')}</span>
            <SegmentedControl
              options={capabilities.efforts.map((option) => ({
                id: option.id,
                // "Automático" is the right word on a row with space for a
                // sentence and the wrong one inside a six-segment track.
                label: option.id === '' ? 'Auto' : option.label
              }))}
              value={currentEffort?.id ?? ''}
              onChange={onEffortChange}
              ariaLabel={t('chat.engine.effortAria')}
            />
          </div>
          {/* The hint follows the selection: a ladder whose rungs are named
              "alto" and "extra" says nothing about what actually changes —
              time and cost — which is all the user is choosing between. */}
          <p className="wb-engine-effort-hint">
            {describeOption(currentEffort) ?? t('chat.engine.effortAria')}
          </p>
        </div>
      )}
      <div className="wb-engine-provenance">
        <span className="wb-engine-source" data-source={capabilities.modelSource ?? 'catalog'}>
          <span className="wb-engine-source-dot" aria-hidden="true" />
          <span className="wb-engine-source-text">{sourceLine(capabilities)}</span>
        </span>
        <button
          type="button"
          className="wb-engine-refresh"
          onClick={onRefresh}
          disabled={refreshing}
          title={t('chat.engine.refreshHint')}
        >
          <RefreshIcon size={12} className={refreshing ? 'wb-engine-spin' : undefined} />
          {refreshing ? t('chat.engine.refreshing') : t('chat.engine.refresh')}
        </button>
      </div>
      {capabilities.note && <p className="wb-engine-note">{noteLine(capabilities.note)}</p>}
      {runningModel && (
        <p className="wb-engine-running">{t('chat.engine.running', runningModel)}</p>
      )}
    </div>
  )
}

/** One capability row → one picker row, with its copy and glyph resolved. */
function toPickerOption(option: EngineOption, byVendor: boolean): PickerOption {
  const description = describeOption(option)
  const tags = (option.traits ?? [])
    // Only the traits nothing else on the row already carries earn a chip.
    // "topo"/"equilíbrio"/"rápido" are what the tier glyph says; `long-context`
    // is what the meta column ("1M") and the label ("Sonnet 1M") both say. A
    // chip repeating either spends the row's scarcest space on nothing.
    .filter((trait) => trait === 'router' || trait === 'thinking')
    .slice(0, 2)
    .map((trait) => ({ label: modelTraitLabel(trait), tone: 'accent' as const }))
  return {
    id: option.id,
    label: option.label,
    ...(description ? { description } : {}),
    // The alias is not the model. Showing what it resolved to is what keeps
    // "Sonnet" from meaning two different things on two machines.
    ...(option.resolvedId && option.resolvedId !== option.id
      ? { hint: t('chat.engine.resolves', option.resolvedId) }
      : {}),
    ...(option.contextWindow ? { meta: formatTokens(option.contextWindow) } : {}),
    ...(tags.length > 0 ? { tags } : {}),
    icon: tierIcon(option.traits, 13),
    group: groupOf(option, byVendor),
    keywords: [option.vendor, option.resolvedId, option.source].filter(Boolean).join(' ')
  }
}

/** The glyph that says what *kind* of row this is, in one look. */
function tierIcon(traits: string[] | undefined, size: number): React.JSX.Element {
  const has = (trait: string): boolean => traits?.includes(trait) ?? false
  if (has('cli-default')) return <TierAutoIcon size={size} />
  if (has('router')) return <TierRouterIcon size={size} />
  if (has('legacy')) return <TierLegacyIcon size={size} />
  if (has('fast')) return <TierFastIcon size={size} />
  if (has('flagship')) return <TierFlagshipIcon size={size} />
  return <TierBalancedIcon size={size} />
}
