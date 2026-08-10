import type { ReactNode } from 'react'
import { t } from '../i18n'

/**
 * Design Studio (M18) — T4.5. The bench the Preview sits on.
 *
 * **Three surfaces, zero `box-shadow` (D-DS-9).** `DESIGN.md`'s
 * Flat-Until-It-Floats rule reserves `--shadow-1..3` for portalled surfaces,
 * and a device mock-up is not portalled — it is the page's subject. Depth here
 * comes from stacking the surface roles the system already has: the bench is
 * `--bg-2` (deeper than any panel), the bezel is `--bg` with a
 * `--border-strong` hairline, the screen is `--surface`. Three tones read as
 * real depth, and because they are roles rather than values they stay correct
 * in every theme — which a hand-tuned shadow would not.
 *
 * **The dot grid is not decoration.** It is what separates *a workspace* from
 * *a panel*, and it is the convention of the category the audience already
 * knows (Figma, Framer, tldraw). It withdraws under `forced-colors`, where a
 * texture the user did not ask for is noise on top of a palette they chose.
 */

export interface StagePaneProps {
  /** The Preview frame. Absent while there is nothing to render yet. */
  children?: ReactNode
  /** The size/scale readout (T4.6), anchored under the device. */
  readout?: ReactNode
}

export function StagePane({ children, readout }: StagePaneProps): React.JSX.Element {
  return (
    <div className="wb-dstudio-bench" aria-label={t('designStudio.stageAria')}>
      <div className="wb-dstudio-bench-grid" aria-hidden="true" />
      <div className="wb-dstudio-bench-content">
        <div className="wb-dstudio-device">
          <div className="wb-dstudio-screen">{children}</div>
        </div>
        {readout}
      </div>
    </div>
  )
}
