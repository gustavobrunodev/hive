import { useState } from 'react'
import { t } from '../../i18n'
import { salutation } from '../model'
import { SampleSeal } from './PageHeader'

export interface InicioPageProps {
  /** The Hive profile's name; `null` greets without one (Unresolved 3). */
  userName: string | null
  seal: boolean
}

/**
 * P2 — the module's home. A centred hero, in the prototype's order: the
 * greeting (the page's `h1`), the subtitle, then the chat field and its hint
 * (task A, slice 5), then the seal.
 *
 * The hour is read once, when the page is first shown, rather than on every
 * render: a greeting that flips under the cursor at noon reads as a glitch,
 * and the page stays mounted for the whole session anyway.
 */
export function InicioPage({ userName, seal }: InicioPageProps): React.JSX.Element {
  const [openedAt] = useState(() => new Date())
  return (
    <div className="ds-page ds-inicio">
      <header className="ds-hero">
        <h1 className="ds-hero-title">
          {t('designStudio.home.greeting', salutation(openedAt.getHours()), userName)}
        </h1>
        <p className="ds-hero-subtitle">{t('designStudio.home.subtitle')}</p>
        {seal && <SampleSeal />}
      </header>
    </div>
  )
}
