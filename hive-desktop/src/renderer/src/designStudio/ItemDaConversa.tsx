import { useEffect } from 'react'
import { Attachment, Button } from '@hive/design-system'
import { t } from '../i18n'
import { TurnErrorNotice } from '../chat/TurnErrorNotice'
import { claudeTurnError } from '../claudeAuth/claudeSession'
import { agentVisual } from '../ui/agentVisuals'
import { HistoryIcon, PlugIcon } from '../ui/icons'
import { doresQueMaisPesam, trechosDaResposta } from './conversaModel'
import { RelatorioIcon } from './icons'
import {
  fonteName,
  MODULE_AGENTS,
  moduleAgentName,
  type FonteId,
  type ModuleAgentId
} from './model'
import type { ModuleData } from './moduleData'
import { FonteTile, GeracaoPassos } from './parts'
import {
  capitalize,
  formatNumber,
  impactWord,
  type DorCitada,
  type RelatorioDeFonte
} from './relatorioModel'
import type { DesignRoute } from './routes'
import type { ItemDaConversa as Item } from './useConversas'

/** What every item needs from the page around it. */
export interface ContextoDoItem {
  produto: string
  dados: ModuleData
  /** The Produto's Relatórios in use — the ones a reply's Dor marks resolve against. */
  relatorios: readonly RelatorioDeFonte[]
  navigate: (route: DesignRoute) => void
  onEscolherFonte: (fonte: FonteId) => void
  /** "Conectar conta", when the account lane can repair the failed turn. */
  conta: { conectar: () => void; conectando: boolean } | null
}

function nomeDoAgente(id: string | null): string | null {
  if (id === null) return null
  return (MODULE_AGENTS as readonly string[]).includes(id)
    ? moduleAgentName(id as ModuleAgentId)
    : null
}

/** A Dor cited in a reply, as a chip that opens its folha (criterion 12). */
function ChipDeDor({
  citacao,
  titulo,
  fonte,
  dados
}: {
  citacao: DorCitada
  titulo: string
  fonte: FonteId
  dados: ModuleData
}): React.JSX.Element {
  return (
    <button
      type="button"
      className="ds-chip-dor ds-chip-dor-btn"
      data-fonte={fonte}
      aria-label={t('designStudio.conversa.abrirDor', titulo)}
      onClick={(event) => dados.folha.abrir(citacao, event.currentTarget)}
    >
      <FonteTile fonte={fonte} size="sm" />
      <span className="ds-chip-dor-titulo">{titulo}</span>
    </button>
  )
}

/** A static chip of a Dor the person cited in their own message. */
function CitacaoDaPessoa({
  citacao,
  dados
}: {
  citacao: DorCitada
  dados: ModuleData
}): React.JSX.Element | null {
  const relatorio = dados.relatorioEm(citacao.relatorio)
  const dor = relatorio?.dores.find((entry) => entry.id === citacao.dor)
  if (!relatorio || !dor) return null
  return <ChipDeDor citacao={citacao} titulo={dor.titulo} fonte={relatorio.fonte} dados={dados} />
}

/** The agent above its reply: its logo, its name and the model that gave it (criterion 16). */
function CabecaDoAgente({
  agente,
  modelo
}: {
  agente: string | null
  modelo: string | null
}): React.JSX.Element | null {
  const nome = nomeDoAgente(agente)
  if (nome === null) return null
  const Logo = agentVisual(agente).icon
  return (
    <p className="ds-msg-cab">
      <span className="ds-msg-logo" aria-hidden="true">
        <Logo size={14} />
      </span>
      <b className="ds-msg-agente">{nome}</b>
      {modelo && <span className="ds-msg-modelo">{modelo}</span>}
    </p>
  )
}

function Resposta({
  item,
  contexto
}: {
  item: Extract<Item, { tipo: 'agente' }>
  contexto: ContextoDoItem
}): React.JSX.Element {
  return (
    <article className="ds-msg ds-msg-agente" data-escrevendo={item.escrevendo || undefined}>
      <CabecaDoAgente agente={item.agente} modelo={item.modelo} />
      <div className="ds-msg-texto">
        {trechosDaResposta(item.texto, contexto.relatorios).map((trecho, index) =>
          trecho.tipo === 'texto' ? (
            <span key={index}>{trecho.texto}</span>
          ) : (
            <ChipDeDor
              key={index}
              citacao={trecho.citacao}
              titulo={trecho.dor.titulo}
              fonte={trecho.fonte}
              dados={contexto.dados}
            />
          )
        )}
        {item.escrevendo && <span className="ds-cursor" aria-hidden="true" />}
      </div>
    </article>
  )
}

/** "Por qual Fonte quer começar?", with one button per Fonte still without a Relatório (criterion 3). */
function PerguntaDeFonte({
  item,
  contexto
}: {
  item: Extract<Item, { tipo: 'guiada' }>
  contexto: ContextoDoItem
}): React.JSX.Element {
  const { dados, produto } = contexto
  return (
    <article className="ds-msg ds-msg-app">
      <p>{t('designStudio.conversa.guiadaAbertura', produto)}</p>
      <p>{t('designStudio.conversa.guiadaPergunta')}</p>
      {item.escolhida === null && (
        <div
          className="ds-escolhas"
          role="group"
          aria-label={t('designStudio.conversa.fontesLabel')}
        >
          {item.fontes.map((fonte) => {
            const volume = dados.volumeDe(produto, fonte)
            const meta = dados.catalogo?.fontes.find((entry) => entry.id === fonte)
            return (
              <button
                key={fonte}
                type="button"
                className="ds-escolha"
                onClick={() => contexto.onEscolherFonte(fonte)}
              >
                <FonteTile fonte={fonte} size="sm" />
                <span className="ds-escolha-texto">
                  <b>{fonteName(fonte)}</b>
                  <small>
                    {volume === null
                      ? (meta?.descricao ?? '')
                      : t(
                          'designStudio.conversa.fonteNoPeriodo',
                          formatNumber(volume),
                          meta?.unidade ?? ''
                        )}
                  </small>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </article>
  )
}

/** The Relatório just generated, as the conversation shows it: the highlight and the Dores that weigh most. */
function RelatorioPronto({
  caminho,
  contexto
}: {
  caminho: string
  contexto: ContextoDoItem
}): React.JSX.Element {
  const { dados, navigate } = contexto
  const relatorio = dados.relatorioEm(caminho)
  const { carregar } = dados
  useEffect(() => {
    if (relatorio === undefined) carregar(caminho)
  }, [relatorio, carregar, caminho])
  if (!relatorio) return <p className="ds-msg-app">{t('designStudio.folha.carregando')}</p>
  const unidade = dados.catalogo?.fontes.find((entry) => entry.id === relatorio.fonte)
  return (
    <>
      <p>{t('designStudio.conversa.pronto', capitalize(relatorio.destaque))}</p>
      <div className="ds-cartao-relatorio">
        <div className="ds-cartao-relatorio-cab">
          <FonteTile fonte={relatorio.fonte} />
          <span>
            <b>
              {t(
                'designStudio.conversa.relatorioCartao',
                fonteName(relatorio.fonte),
                relatorio.produto
              )}
            </b>
            <small>
              {t(
                'designStudio.conversa.relatorioMeta',
                formatNumber(relatorio.volume),
                unidade?.unidade ?? '',
                relatorio.destaque
              )}
            </small>
          </span>
        </div>
        <ol className="ds-cartao-relatorio-dores">
          {doresQueMaisPesam(relatorio).map((dor) => (
            <li key={dor.id}>
              <button
                type="button"
                className="ds-cartao-dor"
                onClick={(event) =>
                  dados.folha.abrir(
                    { relatorio: relatorio.caminho, dor: dor.id },
                    event.currentTarget
                  )
                }
              >
                <span className="ds-cartao-dor-rank" aria-hidden="true">
                  {dor.rank}
                </span>
                <span className="ds-cartao-dor-titulo">{dor.titulo}</span>
                <span className="ds-impacto" data-impacto={dor.impacto}>
                  {impactWord(dor.impacto)}
                </span>
              </button>
            </li>
          ))}
        </ol>
        <Button
          cut={false}
          variant="ghost"
          className="wb-btn wb-btn-sm ds-btn-sec"
          onClick={() => navigate({ pagina: 'relatorio', relatorio: relatorio.caminho })}
        >
          <RelatorioIcon size={14} />
          {t('designStudio.conversa.abrirRelatorio')}
        </Button>
      </div>
    </>
  )
}

function Geracao({
  item,
  contexto
}: {
  item: Extract<Item, { tipo: 'geracao' }>
  contexto: ContextoDoItem
}): React.JSX.Element {
  const { dados, produto } = contexto
  if (item.estado === 'pronto' && item.relatorio) {
    return (
      <article className="ds-msg ds-msg-app">
        <RelatorioPronto caminho={item.relatorio} contexto={contexto} />
      </article>
    )
  }
  if (item.estado === 'falhou') {
    return (
      <article className="ds-msg ds-msg-app">
        <p>{t(`designStudio.geracao.${item.motivo ?? 'erro'}`, fonteName(item.fonte))}</p>
      </article>
    )
  }
  const emCurso = dados.geracao.emCurso
  const passo =
    emCurso && emCurso.produto === produto && emCurso.fonte === item.fonte ? emCurso.passo : 1
  const unidade = dados.catalogo?.fontes.find((entry) => entry.id === item.fonte)?.unidade ?? ''
  return (
    <article className="ds-msg ds-msg-app">
      <GeracaoPassos
        fonte={item.fonte}
        passo={passo}
        volume={dados.volumeDe(produto, item.fonte)}
        unidade={unidade}
      />
    </article>
  )
}

/** A failed turn (Unresolved 2): the account lane's notice and repair, or the module's one sentence. */
function Falha({
  item,
  contexto
}: {
  item: Extract<Item, { tipo: 'falha' }>
  contexto: ContextoDoItem
}): React.JSX.Element {
  const conta = claudeTurnError(item.erro)
  if (conta) {
    return (
      <TurnErrorNotice
        text={conta.text}
        icon={<PlugIcon size={16} />}
        busy={contexto.conta?.conectando ?? false}
        action={
          contexto.conta
            ? {
                label: t('claude.connectCta'),
                busyLabel: t('claude.connecting'),
                onClick: contexto.conta.conectar
              }
            : null
        }
      />
    )
  }
  return <TurnErrorNotice text={t('designStudio.conversa.falha')} />
}

/** One thing in a conversation, drawn by its kind. */
export function ItemDaConversa({
  item,
  contexto
}: {
  item: Item
  contexto: ContextoDoItem
}): React.JSX.Element {
  switch (item.tipo) {
    case 'pessoa':
      return (
        <article className="ds-msg ds-msg-pessoa" aria-label={t('designStudio.conversa.voce')}>
          {item.anexos.length > 0 && (
            <div className="ds-msg-anexos">
              {item.anexos.map((nome, index) => (
                <Attachment key={`${nome}-${index}`} name={nome} truncate="middle" title={nome} />
              ))}
            </div>
          )}
          <p className="ds-bolha">{item.texto}</p>
          {item.citadas.length > 0 && (
            <div className="ds-msg-citas">
              {item.citadas.map((citacao) => (
                <CitacaoDaPessoa
                  key={`${citacao.relatorio}#${citacao.dor}`}
                  citacao={citacao}
                  dados={contexto.dados}
                />
              ))}
            </div>
          )}
        </article>
      )
    case 'agente':
      return <Resposta item={item} contexto={contexto} />
    case 'linha':
      return (
        <p className="ds-registro">
          <HistoryIcon size={13} aria-hidden="true" />
          <span>{item.texto}</span>
        </p>
      )
    case 'falha':
      return <Falha item={item} contexto={contexto} />
    case 'guiada':
      return <PerguntaDeFonte item={item} contexto={contexto} />
    case 'geracao':
      return <Geracao item={item} contexto={contexto} />
  }
}
