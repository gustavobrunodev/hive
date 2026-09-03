import { forwardRef, useMemo } from 'react'
import { OptionPicker, RampSelect, Switch } from '@hive/design-system'
import type { PickerOption, RampStep } from '@hive/design-system'
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
  atCapacity,
  baseRung,
  describeOption,
  distinctVendors,
  effortsFor,
  fastCapacity,
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
  const { models } = capabilities
  const current = models.find((option) => option.id === model) ?? models[0] ?? null
  // Not `capabilities.efforts`: on Devin the ladder belongs to the *selected
  // model* (its variants ARE its reasoning levels), so the control has to be
  // re-read whenever the row above it changes. See `effortsFor`.
  const efforts = effortsFor(capabilities, current?.id ?? null)
  // The value may be either half of a rung/fast-twin pair, so the ramp's
  // selection is the *base* rung and the capacity is read alongside it.
  const currentEffort = baseRung(efforts, effort) ?? null
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
          efforts={efforts}
          currentEffort={currentEffort}
          effortValue={effort}
          onEffortChange={onEffortChange}
          runningModel={runningModel ?? null}
          onRefresh={onRefresh}
          refreshing={refreshing}
        />
      }
    >
      <EngineTrigger model={current} effort={currentEffort} efforts={efforts} />
    </OptionPicker>
  )
}

/**
 * The closed control. It carries the whole decision in one line — the model,
 * what "Automático" resolves to, and the effort — so the common case (glance,
 * keep going) never needs the panel at all.
 *
 * **It has to forward props and ref.** `OptionPicker` renders whatever it is
 * given as the Radix popover trigger via `asChild`, which *clones the child
 * element* with the open handler, the `aria-expanded`/`data-state` pair and a
 * ref. A component that renders a `<button>` while quietly dropping the props
 * handed to it produces a control that looks finished and cannot be opened —
 * which is exactly what shipped, and what nothing caught, because the app's
 * suite stubbed `OptionPicker` and the design system's exercised it with a
 * plain `<button>`. See `EnginePicker.open.test.ts`, which drives the real
 * popover for this reason.
 */
const EngineTrigger = forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<'button'> & {
    model: EngineOption | null
    effort: EngineOption | null
    /** The whole effort ladder, so the trigger can show *where on it* we are. */
    efforts: EngineOption[]
  }
>(function EngineTrigger({ model, effort, efforts, ...rest }, ref): React.JSX.Element {
  const label = model?.label ?? t('chat.modelLabel')
  // "Automático" alone does not say what will run. When the CLI's own default
  // is known, the trigger names it — that is the whole reason to trust the
  // automatic row instead of routing around it.
  const resolved = model?.traits?.includes('cli-default') ? model.resolvedId : undefined
  return (
    <button
      {...rest}
      ref={ref}
      type="button"
      className="wb-engine-btn"
      aria-label={t('chat.engine.triggerAria', label)}
    >
      <span className="wb-engine-glyph" aria-hidden="true">
        {tierIcon(model?.traits, 14)}
      </span>
      <span className="wb-engine-name">{label}</span>
      {resolved && <span className="wb-engine-resolved">{resolved}</span>}
      {/* The second half of the decision, always — including on "Automático".
          Hiding it there was the state a first-time user is *in*, so the one
          person who most needs to learn that effort is adjustable was the one
          person shown no sign of it. */}
      {efforts.length > 0 && (
        <>
          <span className="wb-engine-sep" aria-hidden="true" />
          <span className="wb-engine-effort-chip" data-auto={effort?.id === '' || undefined}>
            <EffortSpark efforts={efforts} effort={effort} />
            <span className="wb-engine-effort-name">
              {effort && effort.id !== '' ? effort.label : t('chat.engine.effortAuto')}
            </span>
          </span>
        </>
      )}
      <ChevronDownIcon size={12} />
    </button>
  )
})

/**
 * The effort level as three bars on the closed control — the same climb the
 * panel's ramp draws, small enough to ride in a pill. It is the part that makes
 * the trigger answer "how hard is it thinking?" at a glance instead of only
 * naming a rung the user may not have the vocabulary for.
 */
function EffortSpark({
  efforts,
  effort
}: {
  efforts: EngineOption[]
  effort: EngineOption | null
}): React.JSX.Element {
  const rungs = efforts.filter((option) => option.id !== '')
  const index = rungs.findIndex((option) => option.id === effort?.id)
  // Three bars over however many rungs the agent has: the mark reports a
  // proportion, not a count, so a five-rung ladder and a three-rung one both
  // read as "about here". Every real rung lights at least one bar — an empty
  // mark is reserved for the delegated case, where nothing was chosen at all.
  const lit = index < 0 ? 0 : Math.ceil(((index + 1) / rungs.length) * 3)
  return (
    <span className="wb-engine-spark" aria-hidden="true">
      {[1, 2, 3].map((bar) => (
        <i key={bar} data-on={lit >= bar || undefined} />
      ))}
    </span>
  )
}

/**
 * The panel's lower half: the effort ladder (when the agent has one) over the
 * provenance line. Both belong under the list rather than beside it — they
 * qualify the choice above them, and a user who never looks has lost nothing.
 */
function EngineFooter({
  capabilities,
  efforts,
  currentEffort,
  effortValue,
  onEffortChange,
  runningModel,
  onRefresh,
  refreshing
}: {
  capabilities: EngineCapabilities
  /** The ladder in force — the selected model's own, or the agent's. */
  efforts: EngineOption[]
  currentEffort: EngineOption | null
  /** The raw chosen id, which may be a rung's fast twin. */
  effortValue: string | null
  onEffortChange: (id: string) => void
  runningModel: string | null
  onRefresh: () => void
  refreshing: boolean
}): React.JSX.Element {
  const capacity = fastCapacity(efforts, effortValue)
  return (
    <div className="wb-engine-foot">
      {efforts.length === 0 && capabilities.models.some((option) => option.efforts) && (
        // The ladder belongs to a model, and the chosen row has none — the
        // delegated "Automático", or a router. Saying where the control lives
        // beats the panel that simply had no effort section at all, which is
        // what the bug report was looking at.
        <p className="wb-engine-effort-note">{t('chat.engine.effortPerModel')}</p>
      )}
      {efforts.length > 0 && (
        <div className="wb-engine-effort">
          <span className="wb-engine-effort-title">{t('chat.engine.effortHeading')}</span>
          {/* A `RampSelect`, not a segmented track: effort is a *ladder*, and
              six equal pills put the order in the words alone — you had to
              already know that "extra" outranks "alto" to read the control at
              all. The ramp draws the climb, so the picture answers "which way
              is more?" before any label is read. Its description line follows
              the selection, because the rung names say nothing about what
              actually changes — time and cost — which is the real choice. */}
          <RampSelect
            steps={effortRungs(efforts)}
            autoStep={autoRung(efforts)}
            value={currentEffort?.id ?? ''}
            onChange={(id) =>
              onEffortChange(
                atCapacity(
                  efforts.find((rung) => rung.id === id),
                  capacity.on
                ) ?? id
              )
            }
            ariaLabel={t('chat.engine.effortAria')}
            descriptionFallback={t('chat.engine.effortAria')}
          />
          {/* The second axis, and deliberately NOT a rung on the ramp above:
              a fast twin is the same thinking budget served from a reserved
              pool, so folding it into the climb doubled a control that was
              already at its column budget. */}
          {capacity.available && (
            <label className="wb-engine-fast">
              <Switch
                checked={capacity.on}
                onCheckedChange={(checked) =>
                  onEffortChange(atCapacity(currentEffort ?? undefined, checked === true) ?? '')
                }
                aria-label={t('chat.engine.fastAria')}
              />
              <span className="wb-engine-fast-text">
                <span className="wb-engine-fast-name">{t('chat.engine.fastLabel')}</span>
                <span className="wb-engine-fast-hint">{t('chat.engine.fastHint')}</span>
              </span>
            </label>
          )}
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

/** The ladder's real rungs, in order — the "let the CLI decide" row is not one. */
function effortRungs(efforts: EngineOption[]): RampStep[] {
  return efforts
    .filter((option) => option.id !== '')
    .map((option) => ({
      id: option.id,
      label: option.label,
      ...(describeOption(option) ? { description: describeOption(option) as string } : {})
    }))
}

/**
 * The delegated rung, rendered beside the ramp rather than as its foot. Named
 * "Auto" there and "Automático" on a row with space for a sentence: a
 * ~48px column truncates the long word to "Automáti…", which reads as a
 * rendering failure rather than as a choice.
 */
function autoRung(efforts: EngineOption[]): RampStep | undefined {
  const auto = efforts.find((option) => option.id === '')
  if (!auto) return undefined
  return {
    id: '',
    label: t('chat.engine.effortAuto'),
    ...(describeOption(auto) ? { description: describeOption(auto) as string } : {})
  }
}

/** One capability row → one picker row, with its copy and glyph resolved. */
function toPickerOption(option: EngineOption, byVendor: boolean): PickerOption {
  const description = describeOption(option)
  // The row's own reasoning ladder, counted. It replaces the generic
  // "raciocínio" chip wherever the number is known: same width, and it answers
  // "does this model even have levels, and how many" from the list, before the
  // ramp below is ever looked at.
  const rungs = (option.efforts ?? []).filter((rung) => rung.id !== '').length
  const tags = (
    rungs > 1
      ? [
          ...(option.traits ?? [])
            .filter((trait) => trait === 'router')
            .map((trait) => modelTraitLabel(trait)),
          t('chat.engine.effortRungs', rungs)
        ]
      : (option.traits ?? [])
          // Only the traits nothing else on the row already carries earn a chip.
          // "topo"/"equilíbrio"/"rápido" are what the tier glyph says;
          // `long-context` is what the meta column ("1M") and the label
          // ("Sonnet 1M") both say. A chip repeating either spends the row's
          // scarcest space on nothing.
          .filter((trait) => trait === 'router' || trait === 'thinking')
          .map((trait) => modelTraitLabel(trait))
  )
    .slice(0, 2)
    .map((label) => ({ label, tone: 'accent' as const }))
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
    keywords: [option.vendor, option.resolvedId, option.source, ...(option.aliases ?? [])]
      .filter(Boolean)
      .join(' ')
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
