import { t } from '../../i18n'

/**
 * The "Dados de exemplo" seal.
 *
 * Every number the POC shows is synthetic, and the module's navigation says so
 * in its last line. A page repeats it in its own header only while that
 * navigation is out of sight — the sidebar hidden, or on the Arquivos tab — so
 * the fact is always on screen exactly once.
 */
export function SampleSeal(): React.JSX.Element {
  return <span className="ds-seal">{t('designStudio.sampleData')}</span>
}

export interface PageHeaderProps {
  title: string
  subtitle?: string
  /** Show the seal: the module navigation is out of sight. */
  seal: boolean
}

/**
 * A page's header (P8, P10, P11): title and subtitle on the leading side, the
 * seal on the trailing side — where the page's own controls (the Produto
 * picker, the Leitura | Gráficos switch) join it — on one line while there is
 * room for it.
 */
export function PageHeader({ title, subtitle, seal }: PageHeaderProps): React.JSX.Element {
  return (
    <header className="ds-page-head">
      <div className="ds-page-titles">
        <h1 className="ds-page-title">{title}</h1>
        {subtitle !== undefined && <p className="ds-page-subtitle">{subtitle}</p>}
      </div>
      {seal && (
        <div className="ds-page-actions">
          <SampleSeal />
        </div>
      )}
    </header>
  )
}
