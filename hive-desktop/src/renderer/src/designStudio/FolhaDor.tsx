import { useEffect, useId } from 'react'
import { Button, Sheet, SheetClose, SheetContent, SheetTitle } from '@hive/design-system'
import { t } from '../i18n'
import { ChatBubbleIcon, CloseIcon } from '../ui/icons'
import { fonteName, type FonteId } from './model'
import { useDesignData, type ModuleData } from './moduleData'
import { FonteTile } from './parts'
import {
  factsOf,
  formatEvidenceDate,
  formatNumber,
  impactWord,
  sameScreen,
  visibleDores,
  type Dor,
  type DorCitada,
  type Evidencia,
  type RelatorioDeFonte
} from './relatorioModel'
import type { DesignRoute } from './routes'
import { conversationField, type CampoId } from './useRascunhos'

/**
 * P9 — the folha da Dor: a modal panel on the right edge, the height of the
 * window (criterion 21). Header, chips, the Fonte's three facts, the summary,
 * the Evidências the Relatório chose and the Dores on the same screen, all in
 * one scroller — and the actions in a bar fixed at the panel's foot, outside
 * it.
 *
 * Closing (Esc, "Fechar") hands focus back to the note that opened it
 * (criterion 23), even when the person walked through "Na mesma tela" first.
 */
export function FolhaDor({
  route,
  navigate
}: {
  route: DesignRoute
  navigate: (route: DesignRoute) => void
}): React.JSX.Element {
  const dados = useDesignData()
  const { aberta, origem, fechar } = dados.folha
  return (
    <Sheet
      open={aberta !== null}
      onOpenChange={(open) => {
        if (!open) fechar()
      }}
    >
      <SheetContent
        side="right"
        className="ds-folha"
        aria-describedby={undefined}
        onCloseAutoFocus={(event) => {
          if (origem?.isConnected) {
            event.preventDefault()
            origem.focus()
          }
        }}
      >
        {aberta && (
          <FolhaConteudo citacao={aberta} dados={dados} route={route} navigate={navigate} />
        )}
      </SheetContent>
    </Sheet>
  )
}

function FolhaConteudo({
  citacao,
  dados,
  route,
  navigate
}: {
  citacao: DorCitada
  dados: ModuleData
  route: DesignRoute
  navigate: (route: DesignRoute) => void
}): React.JSX.Element {
  const relatorio = dados.relatorioEm(citacao.relatorio)
  const { carregar } = dados
  useEffect(() => {
    if (relatorio === undefined) carregar(citacao.relatorio)
  }, [relatorio, carregar, citacao.relatorio])
  const dor = relatorio?.dores.find((entry) => entry.id === citacao.dor)
  if (!relatorio || !dor) {
    return (
      <div className="ds-folha-cab">
        <SheetTitle className="ds-folha-titulo">{t('designStudio.folha.carregando')}</SheetTitle>
        <FecharFolha />
      </div>
    )
  }
  const visiveis = visibleDores(
    (dados.relatorios ?? []).filter((r) => r.produto === relatorio.produto)
  )
  const campo: CampoId =
    route.pagina === 'conversa' ? conversationField(route.produto, route.conversa) : 'inicio'
  const citar = (): void => {
    dados.rascunhos.citar(campo, citacao)
    dados.folha.fechar()
    if (campo === 'inicio') navigate({ pagina: 'inicio' })
  }
  const perguntar = (): void => {
    dados.rascunhos.perguntar({
      produto: relatorio.produto,
      citacao,
      texto: t('designStudio.folha.pergunta', dor.titulo)
    })
    dados.folha.fechar()
    navigate({ pagina: 'inicio' })
  }
  return (
    <>
      <div className="ds-folha-cab">
        <SheetTitle className="ds-folha-titulo">{dor.titulo}</SheetTitle>
        <FecharFolha />
      </div>
      <div className="ds-folha-corpo">
        <FolhaChips dor={dor} relatorio={relatorio} />
        <dl className="ds-fatos">
          {factsOf(dor, relatorio).map((fato) => (
            <div key={fato.rotulo} className="ds-fato">
              <dt>{fato.rotulo}</dt>
              <dd>{fato.valor}</dd>
            </div>
          ))}
        </dl>
        <p className="ds-folha-resumo">{dor.resumo}</p>
        <Evidencias dor={dor} fonte={relatorio.fonte} />
        {dor.tela && (
          <MesmaTela
            tela={dor.tela}
            outras={sameScreen(visiveis, citacao, dor.tela)}
            onAbrir={(outra) => dados.folha.abrir(outra)}
          />
        )}
      </div>
      <div className="ds-folha-pe" role="group" aria-label={t('designStudio.folha.acoes')}>
        <Button cut={false} variant="ghost" className="wb-btn ds-btn-sec" onClick={citar}>
          <span aria-hidden="true">@</span>
          {route.pagina === 'conversa'
            ? t('designStudio.folha.citarNestaConversa')
            : t('designStudio.folha.citarNoChat')}
        </Button>
        <Button cut={false} variant="ghost" className="wb-btn ds-btn-sec" onClick={perguntar}>
          <ChatBubbleIcon size={14} />
          {t('designStudio.folha.perguntar')}
        </Button>
      </div>
    </>
  )
}

function FecharFolha(): React.JSX.Element {
  return (
    <SheetClose asChild>
      <button type="button" className="ds-icon-btn" aria-label={t('designStudio.folha.fechar')}>
        <CloseIcon size={16} />
      </button>
    </SheetClose>
  )
}

/** "<Fonte> · <n>ª em <Produto>", the screen (when the Dor has one) and the impact. */
function FolhaChips({
  dor,
  relatorio
}: {
  dor: Dor
  relatorio: RelatorioDeFonte
}): React.JSX.Element {
  return (
    <div className="ds-folha-chips">
      <span className="ds-chip">
        <FonteTile fonte={relatorio.fonte} size="sm" />
        {t('designStudio.folha.posicao', fonteName(relatorio.fonte), dor.rank, relatorio.produto)}
      </span>
      {dor.tela && <span className="ds-chip">{t('designStudio.folha.tela', dor.tela)}</span>}
      <span className="ds-chip ds-impacto" data-impacto={dor.impacto}>
        {t('designStudio.folha.impacto', impactWord(dor.impacto))}
      </span>
    </div>
  )
}

function Evidencias({ dor, fonte }: { dor: Dor; fonte: FonteId }): React.JSX.Element {
  const headingId = useId()
  return (
    <section className="ds-folha-bloco" aria-labelledby={headingId}>
      <h3 id={headingId} className="ds-folha-bloco-titulo">
        {t('designStudio.folha.evidencias')}
        <small>
          {t('designStudio.folha.evidenciasMeta', dor.evidencias.length, formatNumber(dor.volume))}
        </small>
      </h3>
      {dor.evidencias.map((evidencia) => (
        <EvidenciaCard key={evidencia.id} evidencia={evidencia} fonte={fonte} />
      ))}
    </section>
  )
}

/** One Evidência in its Fonte's shape (criterion 21): a score, a call, or a session. */
function EvidenciaCard({
  evidencia,
  fonte
}: {
  evidencia: Evidencia
  fonte: FonteId
}): React.JSX.Element {
  const quando = formatEvidenceDate(evidencia.data)
  if (fonte === 'likert') {
    const nota = evidencia.nota ?? 0
    return (
      <article className="ds-evid" data-fonte="likert">
        <div className="ds-evid-topo">
          <span className="ds-escala" role="img" aria-label={t('designStudio.folha.nota', nota)}>
            {[1, 2, 3, 4, 5].map((i) => (
              <i key={i} data-on={i <= nota || undefined} />
            ))}
            <em aria-hidden="true">{t('designStudio.folha.nota', nota)}</em>
          </span>
          <span className="ds-evid-meta">
            {[evidencia.id, quando, evidencia.canal].filter(Boolean).join(' · ')}
          </span>
        </div>
        <blockquote className="ds-evid-texto">“{evidencia.texto}”</blockquote>
      </article>
    )
  }
  if (fonte === 'voz') {
    return (
      <article className="ds-evid" data-fonte="voz">
        <div className="ds-evid-topo">
          <span className="ds-evid-meta">
            {[t('designStudio.folha.ligacao', evidencia.id), quando, evidencia.duracao]
              .filter(Boolean)
              .join(' · ')}
          </span>
          {evidencia.rechamada && (
            <span className="ds-chip">{t('designStudio.folha.ligouDeNovo')}</span>
          )}
        </div>
        <div className="ds-transcricao">
          {(evidencia.trechos ?? []).map((trecho) => (
            <div key={`${trecho.t}-${trecho.quem}`} className="ds-fala" data-quem={trecho.quem}>
              <time>{trecho.t}</time>
              <b>{trecho.quem}</b>
              <p>{trecho.texto}</p>
            </div>
          ))}
        </div>
        {evidencia.motivo && (
          <p className="ds-evid-meta">{t('designStudio.folha.motivo', evidencia.motivo)}</p>
        )}
      </article>
    )
  }
  return (
    <article className="ds-evid" data-fonte="fullstory">
      <span className="ds-evid-meta">
        {[t('designStudio.folha.sessao', evidencia.id), quando].join(' · ')}
      </span>
      <b className="ds-evid-sinal">
        {t('designStudio.folha.sinalEm', evidencia.sinal ?? '', evidencia.elemento ?? '')}
      </b>
      <p className="ds-evid-texto">{evidencia.detalhe}</p>
      <span className="ds-evid-meta">
        {t(
          'designStudio.folha.sessaoMeta',
          evidencia.dispositivo ?? '',
          evidencia.tela ?? '',
          evidencia.momento ?? ''
        )}
      </span>
    </article>
  )
}

/** "Na mesma tela": the other visible Dores of this screen, each opening its own folha. */
function MesmaTela({
  tela,
  outras,
  onAbrir
}: {
  tela: string
  outras: ReturnType<typeof sameScreen>
  onAbrir: (citacao: DorCitada) => void
}): React.JSX.Element {
  const headingId = useId()
  return (
    <section className="ds-folha-bloco" aria-labelledby={headingId}>
      <h3 id={headingId} className="ds-folha-bloco-titulo">
        {t('designStudio.folha.mesmaTela')} <small>{tela}</small>
      </h3>
      {outras.length === 0 ? (
        <p className="ds-folha-vazio">{t('designStudio.folha.nenhumaOutra')}</p>
      ) : (
        <ul className="ds-relacionadas">
          {outras.map(({ dor, relatorio }) => (
            <li key={`${relatorio.caminho}#${dor.id}`}>
              <button
                type="button"
                className="ds-relacionada"
                onClick={() => onAbrir({ relatorio: relatorio.caminho, dor: dor.id })}
              >
                <FonteTile fonte={relatorio.fonte} size="sm" />
                <span className="ds-relacionada-titulo">{dor.titulo}</span>
                <span className="ds-impacto" data-impacto={dor.impacto}>
                  {impactWord(dor.impacto)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
