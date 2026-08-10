import {
  Button,
  Input,
  Kbd,
  SegmentedControl,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@hive/design-system'
import { t } from '../i18n'
import { IconButton } from '../ui/IconButton'
import { HistoryIcon, MaximizeIcon, MinimizeIcon, RefreshIcon } from '../ui/icons'
import type { DetectedScreen } from './screens'
import type { Viewport, ViewportPresetId } from './viewport'
import { VIEWPORT_PRESET_ORDER, customViewport, viewportForPreset } from './viewport'

/**
 * Design Studio (M18) — T4.4. The Bancada's one row of controls.
 *
 * Two rules shape it. **The active preset is visible without opening a menu**
 * (DS-R3 AC-1), which is why the device sizes are a `SegmentedControl` and not
 * a dropdown — a menu would hide the single fact the user checks most often.
 * And **undo/redo reflect the real log**: both buttons are disabled from the
 * Tela's actual cursor, so a disabled Undo means there is nothing to undo,
 * never that the wiring is missing.
 *
 * Export ships disabled until the export phase. Disabled with a tooltip that
 * says why, rather than absent: a control that appears later is a surface the
 * user has to re-learn, and one that is present-but-explained is not.
 */

const PRESET_LABEL: Record<ViewportPresetId, () => string> = {
  mobile: () => t('designStudio.viewportMobile'),
  tablet: () => t('designStudio.viewportTablet'),
  desktop: () => t('designStudio.viewportDesktop')
}

/** The `SegmentedControl` needs an id for "no preset"; `null` is not one. */
const CUSTOM_SEGMENT = 'custom'

export interface StudioToolbarProps {
  screens: DetectedScreen[]
  activeScreenId: string | null
  onSelectScreen: (screenId: string) => void
  viewport: Viewport
  onViewportChange: (viewport: Viewport) => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  focusMode: boolean
  onToggleFocusMode: () => void
}

export function StudioToolbar({
  screens,
  activeScreenId,
  onSelectScreen,
  viewport,
  onViewportChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  focusMode,
  onToggleFocusMode
}: StudioToolbarProps): React.JSX.Element {
  return (
    <div className="wb-dstudio-toolbar" role="toolbar" aria-label={t('designStudio.toolbarAria')}>
      <Select value={activeScreenId ?? undefined} onValueChange={onSelectScreen}>
        <SelectTrigger
          className="wb-dstudio-screen-trigger"
          aria-label={t('designStudio.screenPickerAria')}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {screens.map((screen) => (
            <SelectItem key={screen.screenId} value={screen.screenId}>
              {screen.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="wb-dstudio-screen-count">
        {t('designStudio.screenCount', screens.length)}
      </span>
      <ViewportControl viewport={viewport} onChange={onViewportChange} />
      <div className="wb-dstudio-toolbar-end">
        <HistoryButton
          label={t('designStudio.undo')}
          shortcut={['Ctrl', 'Z']}
          disabled={!canUndo}
          onClick={onUndo}
          icon={<HistoryIcon size={15} />}
        />
        <HistoryButton
          label={t('designStudio.redo')}
          shortcut={['Ctrl', 'Shift', 'Z']}
          disabled={!canRedo}
          onClick={onRedo}
          icon={<RefreshIcon size={15} />}
        />
        <HistoryButton
          label={focusMode ? t('designStudio.focusModeExit') : t('designStudio.focusModeEnter')}
          shortcut={['Ctrl', 'Shift', '.']}
          disabled={false}
          onClick={onToggleFocusMode}
          icon={focusMode ? <MinimizeIcon size={15} /> : <MaximizeIcon size={15} />}
        />
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="wb-dstudio-export-wrap">
                <Button variant="ghost" disabled>
                  {t('designStudio.exportLabel')}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{t('designStudio.exportUnavailable')}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  )
}

/** Device sizes: three presets always visible, plus the custom pair (DS-R3). */
function ViewportControl({
  viewport,
  onChange
}: {
  viewport: Viewport
  onChange: (viewport: Viewport) => void
}): React.JSX.Element {
  return (
    <div className="wb-dstudio-viewport">
      <SegmentedControl
        ariaLabel={t('designStudio.viewportAria')}
        value={viewport.presetId ?? CUSTOM_SEGMENT}
        onChange={(id) =>
          onChange(
            id === CUSTOM_SEGMENT
              ? customViewport(viewport)
              : viewportForPreset(id as ViewportPresetId)
          )
        }
        options={[
          ...VIEWPORT_PRESET_ORDER.map((id) => ({ id, label: PRESET_LABEL[id]() })),
          { id: CUSTOM_SEGMENT, label: t('designStudio.viewportCustom') }
        ]}
      />
      {viewport.presetId === null && (
        <span className="wb-dstudio-viewport-custom">
          <Input
            type="number"
            className="wb-dstudio-viewport-field"
            aria-label={t('designStudio.viewportWidthAria')}
            value={String(viewport.width)}
            onChange={(event) =>
              onChange(customViewport({ ...viewport, width: Number(event.target.value) }))
            }
          />
          <Input
            type="number"
            className="wb-dstudio-viewport-field"
            aria-label={t('designStudio.viewportHeightAria')}
            value={String(viewport.height)}
            onChange={(event) =>
              onChange(customViewport({ ...viewport, height: Number(event.target.value) }))
            }
          />
        </span>
      )}
    </div>
  )
}

/** An icon action whose tooltip carries its keystroke as real `Kbd` keys. */
function HistoryButton({
  label,
  shortcut,
  disabled,
  onClick,
  icon
}: {
  label: string
  shortcut: string[]
  disabled: boolean
  onClick: () => void
  icon: React.ReactNode
}): React.JSX.Element {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="wb-dstudio-action-wrap">
            <IconButton label={label} disabled={disabled} onClick={onClick}>
              {icon}
            </IconButton>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <span className="wb-dstudio-shortcut">
            {label}
            {shortcut.map((key) => (
              <Kbd key={key}>{key}</Kbd>
            ))}
          </span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
