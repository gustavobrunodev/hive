import { t } from '../../i18n'
import { PageHeader } from './PageHeader'

/** P10 — Relatórios de Fonte: one section per Produto (task A, slice 2). Here, its frame. */
export function RelatoriosPage({ seal }: { seal: boolean }): React.JSX.Element {
  return (
    <div className="ds-page">
      <PageHeader
        title={t('designStudio.relatorios.title')}
        subtitle={t('designStudio.relatorios.subtitle')}
        seal={seal}
      />
    </div>
  )
}
