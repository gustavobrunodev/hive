import { t } from '../../i18n'
import { PageHeader } from './PageHeader'

/** P8 — the Dores page: one column per Fonte (task A, slice 3). Here, its frame. */
export function DoresPage({ seal }: { seal: boolean }): React.JSX.Element {
  return (
    <div className="ds-page">
      <PageHeader
        title={t('designStudio.dores.title')}
        subtitle={t('designStudio.dores.subtitle')}
        seal={seal}
      />
    </div>
  )
}
