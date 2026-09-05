import { Spinner } from '@hive/design-system'
import { t } from '../i18n'
import { AgentSwitcher } from './AgentSwitcher'
import { EnginePicker } from '../chat/EnginePicker'
import type { RunConfig } from '../chat/useRunConfig'

interface RunConfigBarProps {
  config: RunConfig
  /**
   * Names what the choice is *for* on this surface ("Quem vai documentar").
   * Omit for the inline shape, where the controls ride in a footer that has
   * already said it.
   */
  legend?: string
  /**
   * `panel` frames the controls under their legend (a form section);
   * `inline` drops them into a row that already exists. Same two controls
   * either way — a launcher that invented its own vocabulary for the same
   * decision is exactly what this component exists to stop.
   */
  variant?: 'panel' | 'inline'
}

/**
 * **How this session will run** — the agent, the model and the effort — as the
 * chat composer's own two controls, reused rather than re-imagined.
 *
 * Every surface that starts an agent session shows this: the Skill Studio's
 * create form, the ingestion sheet, "Perguntar à base". Before it, two of
 * those launched onto whatever the app default happened to be, and the user's
 * only way to find out which agent had written their wiki page was to read the
 * transcript afterwards.
 *
 * The controls are imported, not copied. `AgentSwitcher` and `EnginePicker`
 * carry the tiers, the descriptions, the context windows, the provenance line,
 * the effort ramp and the pin — a pair of `Select`s labelled "Modelo" and
 * "Esforço" reproduces none of that, and drifts the moment the composer learns
 * something new.
 *
 * `locked={false}` on the switcher: a launcher has no started conversation to
 * be tied to, so the agent is always changeable here.
 */
export function RunConfigBar({
  config,
  legend,
  variant = 'panel'
}: RunConfigBarProps): React.JSX.Element {
  const noLevers =
    config.capabilities !== null &&
    config.capabilities.models.length === 0 &&
    config.capabilities.efforts.length === 0
  return (
    <div className="wb-runconfig" data-variant={variant}>
      {legend !== undefined && <span className="wb-runconfig-legend">{legend}</span>}
      <div className="wb-runconfig-controls">
        {config.agents.length > 1 && (
          <AgentSwitcher
            agents={config.agents}
            value={config.agentId}
            locked={false}
            onChange={config.setAgent}
          />
        )}
        {config.capabilities === null ? (
          <Spinner label={t('runConfig.loading')} />
        ) : (
          <EnginePicker
            capabilities={config.capabilities}
            model={config.model}
            effort={config.effort}
            onModelChange={config.setModel}
            onEffortChange={config.setEffort}
            onRefresh={config.refresh}
            refreshing={config.refreshing}
            {...(config.pin ? { pin: config.pin } : {})}
          />
        )}
      </div>
      {/* Said once, where the missing controls would have been: an agent that
          exposes neither model nor effort decides for itself, and an empty row
          would read as a surface that failed to load. */}
      {noLevers && <p className="wb-runconfig-none">{t('runConfig.noLevers')}</p>}
    </div>
  )
}
