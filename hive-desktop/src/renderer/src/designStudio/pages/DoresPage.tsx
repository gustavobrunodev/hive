import { useId, useState } from 'react'
import { Button } from '@hive/design-system'
import { t } from '../../i18n'
import { FONTES, fonteName, type FonteId } from '../model'
import { useDesignData } from '../moduleData'
import { DorNote, FonteTile, GeracaoPassos, ProdutoPicker } from '../parts'
import {
  columnDores,
  tiltFor,
  unidadeNota,
  formatNumber,
  ondeDoi,
  relatorioOf,
  visibleDores,
  type Catalogo,
  type DorCitada,
  type RelatorioDeFonte
} from '../relatorioModel'
import type { DesignRoute } from '../routes'
import type { GeracaoEmCurso } from '../useGeracao'
import { PageHeader } from './PageHeader'

/**
 * P8 — the Dores page: what the customers felt, said and did, one column per
 * Fonte (criteria 18–20).
 *
 * The title names the Produto the picker shows; "Onde dói" counts the visible
 * Dores per journey screen and filters the three columns to one; each column
 * shows the top five of its Fonte's most recent Relatório as notes in the
 * Fonte's colour — or, without a Relatório, the way to generate one.
 */
export function DoresPage({
  seal,
  navigate
}: {
  seal: boolean
  navigate: (route: DesignRoute) => void
}): React.JSX.Element {
  const dados = useDesignData()
  const catalogo = dados.catalogo
  const produto = catalogo ? (dados.doresProduto ?? catalogo.produtos[0]?.nome ?? null) : null
  if (!catalogo || !produto) {
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
  return <DoresDoProduto catalogo={catalogo} produto={produto} seal={seal} navigate={navigate} />
}

function DoresDoProduto({
  catalogo,
  produto,
  seal,
  navigate
}: {
  catalogo: Catalogo
  produto: string
  seal: boolean
  navigate: (route: DesignRoute) => void
}): React.JSX.Element {
  const dados = useDesignData()
  // The screen filter belongs to the Produto it was chosen on: switching
  // Produto shows every Dor of the new one.
  const [filtro, setFiltro] = useState<{ produto: string; tela: string } | null>(null)
  const tela = filtro?.produto === produto ? filtro.tela : null
  const relatorios = FONTES.map((fonte) => relatorioOf(dados.relatorios, produto, fonte))
  const comRelatorio = relatorios.filter((r): r is RelatorioDeFonte => r !== null)
  const telas = catalogo.produtos.find((entry) => entry.nome === produto)?.telas ?? []
  const abrir = (citacao: DorCitada, origem: HTMLElement): void =>
    dados.folha.abrir(citacao, origem)

  return (
    <div className="ds-page ds-dores">
      <PageHeader
        title={t('designStudio.dores.titleProduto', produto)}
        subtitle={t('designStudio.dores.subtitle')}
        seal={seal}
        actions={
          <ProdutoPicker catalogo={catalogo} value={produto} onChange={dados.setDoresProduto} />
        }
      />
      {comRelatorio.length > 0 && (
        <OndeDoi
          telas={telas}
          relatorios={comRelatorio}
          selecionada={tela}
          onEscolher={(escolhida) =>
            setFiltro(
              escolhida === null || escolhida === tela ? null : { produto, tela: escolhida }
            )
          }
        />
      )}
      <div className="ds-colunas" role="group" aria-label={t('designStudio.dores.colunas')}>
        {FONTES.map((fonte, index) => (
          <DorColumn
            key={fonte}
            catalogo={catalogo}
            produto={produto}
            fonte={fonte}
            relatorio={relatorios[index]}
            tela={tela}
            emCurso={dados.geracao.emCurso}
            volume={dados.volumeDe(produto, fonte)}
            onGerar={() => dados.geracao.pedir(produto, fonte)}
            onAbrir={abrir}
            onRelatorio={(caminho) => navigate({ pagina: 'relatorio', relatorio: caminho })}
          />
        ))}
      </div>
    </div>
  )
}

/** "Onde dói" (criterion 20): one button per journey screen, with its count. */
function OndeDoi({
  telas,
  relatorios,
  selecionada,
  onEscolher
}: {
  telas: readonly string[]
  relatorios: readonly RelatorioDeFonte[]
  selecionada: string | null
  onEscolher: (tela: string | null) => void
}): React.JSX.Element {
  const contagens = ondeDoi(telas, visibleDores(relatorios))
  return (
    <div className="ds-onde" role="group" aria-label={t('designStudio.dores.ondeDoiLabel')}>
      <span className="ds-onde-rotulo" aria-hidden="true">
        {t('designStudio.dores.ondeDoi')}
      </span>
      {contagens.map((entrada) => (
        <button
          key={entrada.tela}
          type="button"
          className="ds-onde-tela"
          aria-pressed={selecionada === entrada.tela}
          aria-label={t('designStudio.dores.tela', entrada.tela, entrada.contagem, entrada.quente)}
          data-hot={entrada.quente || undefined}
          disabled={entrada.desabilitada}
          onClick={() => onEscolher(entrada.tela)}
        >
          {entrada.tela}
          <b className="ds-onde-n">{entrada.contagem}</b>
        </button>
      ))}
      {selecionada !== null && (
        <Button
          cut={false}
          variant="ghost"
          className="wb-btn wb-btn-sm ds-btn-sec"
          onClick={() => onEscolher(null)}
        >
          {t('designStudio.dores.verTodas')}
        </Button>
      )}
    </div>
  )
}

interface DorColumnProps {
  catalogo: Catalogo
  produto: string
  fonte: FonteId
  relatorio: RelatorioDeFonte | null
  tela: string | null
  emCurso: GeracaoEmCurso | null
  volume: number | null
  onGerar: () => void
  onAbrir: (citacao: DorCitada, origem: HTMLElement) => void
  onRelatorio: (caminho: string) => void
}

/** One Fonte's column: its header, then its notes — or the generation, or the way to start one. */
function DorColumn(props: DorColumnProps): React.JSX.Element {
  const { catalogo, produto, fonte, relatorio, onRelatorio } = props
  const headingId = useId()
  const meta = catalogo.fontes.find((entry) => entry.id === fonte)
  return (
    <section className="ds-coluna" aria-labelledby={headingId} data-fonte={fonte}>
      <div className="ds-coluna-cab">
        <FonteTile fonte={fonte} />
        <div className="ds-coluna-titulos">
          <h2 id={headingId} className="ds-coluna-titulo">
            {fonteName(fonte)}
          </h2>
          <p className="ds-coluna-meta">
            {relatorio
              ? t(
                  'designStudio.dores.noPeriodo',
                  formatNumber(relatorio.volume),
                  meta?.unidade ?? ''
                )
              : (meta?.descricao ?? '')}
          </p>
        </div>
        {relatorio && (
          <button type="button" className="ds-link" onClick={() => onRelatorio(relatorio.caminho)}>
            {t('designStudio.dores.relatorio')}
          </button>
        )}
      </div>
      <ColumnBody {...props} produto={produto} />
    </section>
  )
}

function ColumnBody({
  catalogo,
  produto,
  fonte,
  relatorio,
  tela,
  emCurso,
  volume,
  onGerar,
  onAbrir
}: DorColumnProps): React.JSX.Element {
  const unidade = catalogo.fontes.find((entry) => entry.id === fonte)?.unidade ?? ''
  if (emCurso && emCurso.produto === produto && emCurso.fonte === fonte) {
    return (
      <div className="ds-coluna-corpo">
        <GeracaoPassos fonte={fonte} passo={emCurso.passo} volume={volume} unidade={unidade} />
      </div>
    )
  }
  if (!relatorio) {
    return (
      <div className="ds-coluna-vazia">
        <p className="ds-coluna-vazia-titulo">
          {t('designStudio.dores.semRelatorio', fonteName(fonte))}
        </p>
        <p>{t('designStudio.dores.semRelatorioFrase')}</p>
        <Button cut={false} className="wb-btn wb-btn-sm" onClick={onGerar}>
          {t('designStudio.dores.gerar', fonteName(fonte))}
        </Button>
      </div>
    )
  }
  const dores = columnDores(relatorio).filter((dor) => tela === null || dor.tela === tela)
  if (dores.length === 0) {
    return (
      <div className="ds-coluna-vazia">
        <p>{t('designStudio.dores.nenhumaNaTela', fonteName(fonte), tela ?? '')}</p>
      </div>
    )
  }
  return (
    <ul className="ds-notas">
      {dores.map((dor) => (
        <li key={dor.id}>
          <DorNote
            dor={dor}
            fonte={fonte}
            unidade={unidadeNota(catalogo, fonte)}
            tilt={tiltFor(dor.rank, fonte)}
            onActivate={(origem) => onAbrir({ relatorio: relatorio.caminho, dor: dor.id }, origem)}
          />
        </li>
      ))}
    </ul>
  )
}
