import { t } from '../../i18n'
import { fonteName, fonteOfPath } from '../model'
import { PageHeader } from './PageHeader'

/** The page's title: "Relatório de <Fonte>", the Fonte read off the file's path (decision 3). */
function relatorioTitle(relatorio: string): string {
  const fonte = fonteOfPath(relatorio)
  return fonte === null
    ? t('designStudio.relatorio.titleNoFonte')
    : t('designStudio.relatorio.title', fonteName(fonte))
}

/**
 * P11/P12 — one Relatório de Fonte, in its Leitura and Gráficos views (task A,
 * slice 4). Here, its frame. `relatorio` is the file's path relative to `<raiz>`.
 */
export function RelatorioPage({
  relatorio,
  seal
}: {
  relatorio: string
  seal: boolean
}): React.JSX.Element {
  return (
    <div className="ds-page">
      <PageHeader title={relatorioTitle(relatorio)} seal={seal} />
    </div>
  )
}
