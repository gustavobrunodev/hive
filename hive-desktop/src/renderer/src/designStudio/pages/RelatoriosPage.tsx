import { useId } from 'react'
import { Button } from '@hive/design-system'
import { t } from '../../i18n'
import { FONTES, fonteName, type FonteId } from '../model'
import { useDesignData } from '../moduleData'
import { FonteTile } from '../parts'
import {
  capitalize,
  formatGeneratedAt,
  formatNumber,
  formatPeriod,
  relatorioOf,
  type Catalogo,
  type ProdutoDoCatalogo,
  type RelatorioDeFonte
} from '../relatorioModel'
import type { DesignRoute } from '../routes'
import type { GeracaoEmCurso } from '../useGeracao'
import { PageHeader } from './PageHeader'

/**
 * P10 — Relatórios de Fonte: one section per Produto, one row per Fonte, in
 * the order Likert, Voz do Cliente, FullStory (criterion 24). A row with a
 * Relatório opens its Leitura; one without asks for it, and shows the
 * generation's step in the button's place while it runs.
 */
export function RelatoriosPage({
  seal,
  navigate
}: {
  seal: boolean
  navigate: (route: DesignRoute) => void
}): React.JSX.Element {
  const dados = useDesignData()
  return (
    <div className="ds-page ds-relatorios">
      <PageHeader
        title={t('designStudio.relatorios.title')}
        subtitle={t('designStudio.relatorios.subtitle')}
        seal={seal}
      />
      {dados.catalogo?.produtos.map((produto) => (
        <ProdutoSection
          key={produto.id}
          catalogo={dados.catalogo as Catalogo}
          produto={produto}
          relatorios={dados.relatorios}
          emCurso={dados.geracao.emCurso}
          onGerar={(fonte) => dados.geracao.pedir(produto.nome, fonte)}
          onAbrir={(caminho) => navigate({ pagina: 'relatorio', relatorio: caminho })}
        />
      ))}
    </div>
  )
}

function ProdutoSection({
  catalogo,
  produto,
  relatorios,
  emCurso,
  onGerar,
  onAbrir
}: {
  catalogo: Catalogo
  produto: ProdutoDoCatalogo
  relatorios: readonly RelatorioDeFonte[] | null
  emCurso: GeracaoEmCurso | null
  onGerar: (fonte: FonteId) => void
  onAbrir: (caminho: string) => void
}): React.JSX.Element {
  const headingId = useId()
  return (
    <section className="ds-rel-produto" aria-labelledby={headingId}>
      <h2 id={headingId} className="ds-rel-produto-titulo">
        {produto.nome}
        <small>{t('designStudio.relatorios.descricao', produto.descricao)}</small>
      </h2>
      <ul className="ds-rel-lista">
        {FONTES.map((fonte) => (
          <li key={fonte}>
            <RelatorioLinha
              catalogo={catalogo}
              produto={produto.nome}
              fonte={fonte}
              relatorio={relatorioOf(relatorios, produto.nome, fonte)}
              gerando={
                emCurso?.produto === produto.nome && emCurso.fonte === fonte ? emCurso.passo : null
              }
              onGerar={() => onGerar(fonte)}
              onAbrir={onAbrir}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}

/** One row: the Fonte's tile, the Fonte and its meta, the highlight and its meta, the action. */
function RelatorioLinha({
  catalogo,
  produto,
  fonte,
  relatorio,
  gerando,
  onGerar,
  onAbrir
}: {
  catalogo: Catalogo
  produto: string
  fonte: FonteId
  relatorio: RelatorioDeFonte | null
  gerando: number | null
  onGerar: () => void
  onAbrir: (caminho: string) => void
}): React.JSX.Element {
  const meta = catalogo.fontes.find((entry) => entry.id === fonte)
  const nome = fonteName(fonte)
  return (
    <div className="ds-rel-linha" data-fonte={fonte}>
      <FonteTile fonte={fonte} />
      <span className="ds-rel-fonte">
        <b>{nome}</b>
        <small>
          {relatorio
            ? t('designStudio.relatorios.periodo', produto, formatPeriod(relatorio.periodo))
            : t('designStudio.relatorios.naoGerado', produto)}
        </small>
      </span>
      {relatorio ? (
        <span className="ds-rel-destaque">
          {capitalize(relatorio.destaque)}
          <small>
            {t(
              'designStudio.relatorios.meta',
              formatNumber(relatorio.volume),
              meta?.unidade ?? '',
              formatGeneratedAt(relatorio.geradoEm)
            )}
          </small>
        </span>
      ) : (
        <span className="ds-rel-destaque ds-rel-descricao">{meta?.descricao}</span>
      )}
      <span className="ds-rel-acao">
        <RowAction
          relatorio={relatorio}
          gerando={gerando}
          rotulo={
            relatorio
              ? t('designStudio.relatorios.abrirLabel', nome, produto)
              : t('designStudio.relatorios.gerarLabel', nome, produto)
          }
          onGerar={onGerar}
          onAbrir={onAbrir}
        />
      </span>
    </div>
  )
}

function RowAction({
  relatorio,
  gerando,
  rotulo,
  onGerar,
  onAbrir
}: {
  relatorio: RelatorioDeFonte | null
  gerando: number | null
  rotulo: string
  onGerar: () => void
  onAbrir: (caminho: string) => void
}): React.JSX.Element {
  if (relatorio) {
    return (
      <Button
        cut={false}
        variant="ghost"
        className="wb-btn wb-btn-sm ds-btn-sec"
        aria-label={rotulo}
        onClick={() => onAbrir(relatorio.caminho)}
      >
        {t('designStudio.relatorios.abrir')}
      </Button>
    )
  }
  if (gerando !== null) {
    return (
      <span className="ds-gerando" role="status">
        {t('designStudio.geracao.gerandoN', gerando)}
      </span>
    )
  }
  return (
    <Button cut={false} className="wb-btn wb-btn-sm" aria-label={rotulo} onClick={onGerar}>
      {t('designStudio.relatorios.gerar')}
    </Button>
  )
}
