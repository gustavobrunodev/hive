import { useEffect, useState } from 'react'
import { Button, SegmentedControl } from '@hive/design-system'
import { t } from '../../i18n'
import { ArrowLeftIcon, RefreshIcon } from '../../ui/icons'
import { fonteName, fonteOfPath } from '../model'
import { useDesignData } from '../moduleData'
import { FonteTile, GeracaoPassos } from '../parts'
import { formatGeneratedAt, formatPeriod, type RelatorioDeFonte } from '../relatorioModel'
import type { DesignRoute } from '../routes'
import { PageHeader, SampleSeal } from './PageHeader'
import { RelatorioGraficos } from './RelatorioGraficos'
import { RelatorioLeitura } from './RelatorioLeitura'

/** The page's title: "Relatório de <Fonte>", the Fonte read off the file's path (decision 3). */
function relatorioTitle(relatorio: string): string {
  const fonte = fonteOfPath(relatorio)
  return fonte === null
    ? t('designStudio.relatorio.titleNoFonte')
    : t('designStudio.relatorio.title', fonteName(fonte))
}

/**
 * P11/P12 — one Relatório de Fonte, in its Leitura and Gráficos views
 * (criteria 25–31). `relatorio` is the file's path relative to `<raiz>`.
 *
 * Read from the Relatórios in use, or on demand when it is an older file — a
 * citation keeps pointing at the Relatório it was made from. A file that is
 * gone shows "Relatório não encontrado" (criterion 31).
 */
export function RelatorioPage({
  relatorio: caminho,
  seal,
  navigate
}: {
  relatorio: string
  seal: boolean
  navigate: (route: DesignRoute) => void
}): React.JSX.Element {
  const dados = useDesignData()
  const relatorio = dados.relatorioEm(caminho)
  const carregou = dados.relatorios !== null
  const { carregar } = dados
  useEffect(() => {
    // Only once the Relatórios in use are known: the file may be one of them.
    if (carregou && relatorio === undefined) carregar(caminho)
  }, [carregou, relatorio, carregar, caminho])

  if (relatorio === null) {
    return (
      <div className="ds-page">
        <div className="ds-vazio">
          <h1 className="ds-vazio-titulo">{t('designStudio.relatorio.naoEncontrado')}</h1>
          <p>{t('designStudio.relatorio.naoEncontradoFrase')}</p>
          <Button
            cut={false}
            variant="ghost"
            className="wb-btn ds-btn-sec"
            onClick={() => navigate({ pagina: 'relatorios' })}
          >
            {t('designStudio.relatorio.verRelatorios')}
          </Button>
        </div>
      </div>
    )
  }
  if (relatorio === undefined) {
    return (
      <div className="ds-page">
        <PageHeader title={relatorioTitle(caminho)} seal={seal} />
      </div>
    )
  }
  return <RelatorioAberto relatorio={relatorio} seal={seal} navigate={navigate} />
}

type Vista = 'leitura' | 'graficos'

function RelatorioAberto({
  relatorio,
  seal,
  navigate
}: {
  relatorio: RelatorioDeFonte
  seal: boolean
  navigate: (route: DesignRoute) => void
}): React.JSX.Element {
  const dados = useDesignData()
  const [vista, setVista] = useState<Vista>('leitura')
  const emCurso = dados.geracao.emCurso
  const gerandoAqui =
    emCurso !== null && emCurso.produto === relatorio.produto && emCurso.fonte === relatorio.fonte
  const unidade = dados.catalogo?.fontes.find((f) => f.id === relatorio.fonte)?.unidade ?? ''
  return (
    <div className="ds-page ds-relatorio">
      <header className="ds-relatorio-cab">
        <button
          type="button"
          className="ds-voltar"
          onClick={() => navigate({ pagina: 'relatorios' })}
        >
          <ArrowLeftIcon size={14} />
          {t('designStudio.relatorio.voltar')}
        </button>
        <div className="ds-relatorio-id">
          <FonteTile fonte={relatorio.fonte} size="lg" />
          <div className="ds-relatorio-titulos">
            <h1 className="ds-page-title">
              {t('designStudio.relatorio.title', fonteName(relatorio.fonte))}
            </h1>
            <p className="ds-relatorio-meta">
              {t(
                'designStudio.relatorio.meta',
                relatorio.produto,
                formatPeriod(relatorio.periodo),
                formatGeneratedAt(relatorio.geradoEm),
                relatorio.geradoPor.agente
              )}
            </p>
          </div>
          {seal && <SampleSeal />}
        </div>
      </header>
      <div className="ds-relatorio-barra">
        <SegmentedControl
          ariaLabel={t('designStudio.relatorio.vistas')}
          size="md"
          value={vista}
          onChange={(id) => setVista(id as Vista)}
          options={[
            { id: 'leitura', label: t('designStudio.relatorio.leitura') },
            { id: 'graficos', label: t('designStudio.relatorio.graficos') }
          ]}
        />
        <Button
          cut={false}
          variant="ghost"
          className="wb-btn ds-btn-sec"
          onClick={() => dados.geracao.pedir(relatorio.produto, relatorio.fonte)}
        >
          <RefreshIcon size={14} />
          {t('designStudio.relatorio.gerarDeNovo')}
        </Button>
      </div>
      {gerandoAqui && (
        <GeracaoPassos
          fonte={relatorio.fonte}
          passo={emCurso.passo}
          volume={dados.volumeDe(relatorio.produto, relatorio.fonte)}
          unidade={unidade}
        />
      )}
      {vista === 'leitura' ? (
        <RelatorioLeitura relatorio={relatorio} />
      ) : (
        <RelatorioGraficos relatorio={relatorio} navigate={navigate} />
      )}
    </div>
  )
}
