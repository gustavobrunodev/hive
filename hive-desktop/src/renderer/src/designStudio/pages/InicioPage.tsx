import { useEffect, useId, useState } from 'react'
import { Button, Kbd } from '@hive/design-system'
import { t } from '../../i18n'
import { CampoDoChat, type ParteDoEnvio } from '../CampoDoChat'
import { doresEmAlta, fontesSemRelatorio, relatoriosDoProduto } from '../conversaModel'
import { RelatorioIcon } from '../icons'
import { FONTES, fonteName, salutation, type FonteId, type ModuleAgent } from '../model'
import { useDesignData, type ModuleData } from '../moduleData'
import { DorNote, FonteTile, ProdutoPicker } from '../parts'
import { relatorioOf, unidadeNota, type DorCitada, type RelatorioDeFonte } from '../relatorioModel'
import type { DesignRoute } from '../routes'
import { SampleSeal } from './PageHeader'

export interface InicioPageProps {
  /** The Hive profile's name; `null` greets without one (Unresolved 3). */
  userName: string | null
  seal: boolean
  navigate: (route: DesignRoute) => void
}

/** The Produto a citation belongs to: the first folder of its Relatório's path. */
function produtoDaCitacao(citacao: DorCitada): string {
  return citacao.relatorio.split('/')[0] ?? ''
}

/** The hint under the field (criterion 1): each key in a `<kbd>`, as `home.js` writes it. */
function Dica(): React.JSX.Element {
  return (
    <p className="ds-dica">
      <Kbd>{t('designStudio.home.dica.enter')}</Kbd>
      {t('designStudio.home.dica.envia')}
      <Kbd>{t('designStudio.home.dica.shift')}</Kbd>
      {t('designStudio.home.dica.mais')}
      <Kbd>{t('designStudio.home.dica.enter')}</Kbd>
      {t('designStudio.home.dica.quebra')}
      <Kbd>{t('designStudio.home.dica.ctrl')}</Kbd>
      {t('designStudio.home.dica.mais')}
      <Kbd>{t('designStudio.home.dica.v')}</Kbd>
      {t('designStudio.home.dica.cola')}
      <Kbd>{t('designStudio.home.dica.arroba')}</Kbd>
      {t('designStudio.home.dica.cita')}
    </p>
  )
}

/**
 * P2 — the module's home (criteria 1–3, `home.js`): the greeting, then the
 * chat field with its hint, the Produto choice, and "Dores em alta".
 *
 * Sending opens a conversa do Produto. A question left by the folha or by a
 * Gráficos insight ("Perguntar ao agente") is sent from here the moment it
 * lands, which is why the folha comes back to this page to ask it.
 *
 * The hour is read once, when the page is first shown, rather than on every
 * render: a greeting that flips under the cursor at noon reads as a glitch,
 * and the page stays mounted for the whole session anyway.
 */
export function InicioPage({ userName, seal, navigate }: InicioPageProps): React.JSX.Element {
  const [openedAt] = useState(() => new Date())
  const dados = useDesignData()
  const [escolhido, setEscolhido] = useState<string | null>(null)
  const [agente, setAgente] = useState<ModuleAgent | null>(null)
  const [enviando, setEnviando] = useState(false)
  const produto = escolhido ?? dados.catalogo?.produtos[0]?.nome ?? null
  const citadas = dados.rascunhos.citadas('inicio')
  const { rascunhos, conversas, geracao } = dados

  // A Dor of another Produto cited here (from the folha) brings that Produto
  // with it — adjusted while rendering, the moment the citation is new.
  const ultimaCitada = citadas.at(-1)
  const produtoCitado = ultimaCitada ? produtoDaCitacao(ultimaCitada) : null
  const [citadoVisto, setCitadoVisto] = useState<string | null>(null)
  if (produtoCitado !== citadoVisto) {
    setCitadoVisto(produtoCitado)
    if (produtoCitado !== null && produtoCitado !== produto) setEscolhido(produtoCitado)
  }

  const abrirConversa = async (
    envio: Parameters<ModuleData['conversas']['enviar']>[0]
  ): Promise<void> => {
    setEnviando(true)
    const id = await conversas.enviar(envio)
    setEnviando(false)
    if (id === null) {
      geracao.informar(t('designStudio.conversa.falha'))
      return
    }
    navigate({ pagina: 'conversa', produto: envio.produto, conversa: id })
  }

  const abrirConversaRef = useLatest(abrirConversa)

  // "Perguntar ao agente" (criteria 19, 20): the question the folha or an
  // insight left, sent as soon as the field knows who answers it.
  const pergunta = rascunhos.pergunta
  useEffect(() => {
    if (pergunta === null || agente === null) return
    const pendente = rascunhos.consumirPergunta()
    if (pendente === null) return
    void abrirConversaRef.current({
      produto: pendente.produto,
      conversa: null,
      texto: pendente.texto,
      citadas: [pendente.citacao],
      anexos: [],
      relatoriosAnexados: [],
      agente
    })
  }, [pergunta, agente, rascunhos, abrirConversaRef])

  const mudarProduto = (proximo: string): void => {
    setEscolhido(proximo)
    for (const citacao of citadas) {
      if (produtoDaCitacao(citacao) !== proximo) rascunhos.descitar('inicio', citacao)
    }
  }

  return (
    <div className="ds-page ds-inicio">
      <header className="ds-hero">
        <h1 className="ds-hero-title">
          {t('designStudio.home.greeting', salutation(openedAt.getHours()), userName)}
        </h1>
        <p className="ds-hero-subtitle">{t('designStudio.home.subtitle')}</p>
        {seal && <SampleSeal />}
      </header>
      {produto !== null && dados.catalogo && (
        <>
          <div className="ds-inicio-campo">
            <CampoDoChat
              campo="inicio"
              produto={produto}
              modo="inicio"
              agente={agente}
              onAgente={setAgente}
              respondendo={false}
              bloqueado={enviando}
              onEnviar={(parte: ParteDoEnvio) =>
                void abrirConversa({ produto, conversa: null, ...parte })
              }
            />
            <Dica />
            <div className="ds-inicio-produto">
              <ProdutoPicker catalogo={dados.catalogo} value={produto} onChange={mudarProduto} />
            </div>
          </div>
          <DoresEmAlta
            produto={produto}
            dados={dados}
            onVerTodas={() => {
              dados.setDoresProduto(produto)
              navigate({ pagina: 'dores' })
            }}
            onPrimeiro={() =>
              void conversas
                .iniciarGuiada(produto, fontesSemRelatorio(dados.relatorios, produto))
                .then((id) => {
                  if (id !== null) navigate({ pagina: 'conversa', produto, conversa: id })
                })
            }
          />
        </>
      )}
    </div>
  )
}

/** The latest value of `value`, for callbacks an effect fires without re-subscribing. */
function useLatest<T>(value: T): { current: T } {
  const [ref] = useState(() => ({ current: value }))
  useEffect(() => {
    ref.current = value
  })
  return ref
}

/** "Dores em alta" (criteria 2, 3): per Fonte, the two notes that weigh most — or the way to a Relatório. */
function DoresEmAlta({
  produto,
  dados,
  onVerTodas,
  onPrimeiro
}: {
  produto: string
  dados: ModuleData
  onVerTodas: () => void
  onPrimeiro: () => void
}): React.JSX.Element {
  const headingId = useId()
  const temAlguma = relatoriosDoProduto(dados.relatorios, produto).length > 0
  return (
    <section className="ds-inicio-secao" aria-labelledby={headingId}>
      <div className="ds-inicio-secao-topo">
        <h2 id={headingId} className="ds-inicio-secao-titulo">
          {t('designStudio.home.emAlta')}
        </h2>
        <p className="ds-inicio-secao-frase">{t('designStudio.home.emAltaFrase')}</p>
      </div>
      {temAlguma ? (
        <div className="ds-emalta">
          {FONTES.map((fonte) => (
            <Cluster
              key={fonte}
              produto={produto}
              fonte={fonte}
              relatorio={relatorioOf(dados.relatorios, produto, fonte)}
              dados={dados}
              onVerTodas={onVerTodas}
            />
          ))}
        </div>
      ) : (
        <div className="ds-inicio-vazio">
          <p className="ds-inicio-vazio-titulo">{t('designStudio.home.semNenhum', produto)}</p>
          <p>{t('designStudio.home.semNenhumFrase')}</p>
          <Button cut={false} className="wb-btn" onClick={onPrimeiro}>
            <RelatorioIcon size={14} />
            {t('designStudio.home.gerarPrimeiro', produto)}
          </Button>
        </div>
      )}
    </section>
  )
}

function Cluster({
  produto,
  fonte,
  relatorio,
  dados,
  onVerTodas
}: {
  produto: string
  fonte: FonteId
  relatorio: RelatorioDeFonte | null
  dados: ModuleData
  onVerTodas: () => void
}): React.JSX.Element {
  const headingId = useId()
  const emCurso = dados.geracao.emCurso
  return (
    <section className="ds-cluster" aria-labelledby={headingId} data-fonte={fonte}>
      <div className="ds-cluster-cab">
        <FonteTile fonte={fonte} size="sm" />
        <h3 id={headingId} className="ds-cluster-titulo">
          {fonteName(fonte)}
        </h3>
        {relatorio && (
          <button type="button" className="ds-link" onClick={onVerTodas}>
            {t('designStudio.home.verTodas')}
          </button>
        )}
      </div>
      {relatorio ? (
        <ul className="ds-cluster-notas">
          {doresEmAlta(relatorio).map((dor) => {
            const citacao = { relatorio: relatorio.caminho, dor: dor.id }
            return (
              <li key={dor.id}>
                <DorNote
                  dor={dor}
                  fonte={fonte}
                  unidade={unidadeNota(dados.catalogo, fonte)}
                  pressed={dados.rascunhos.estaCitada('inicio', citacao)}
                  onActivate={() => dados.rascunhos.alternar('inicio', citacao)}
                />
              </li>
            )
          })}
        </ul>
      ) : emCurso && emCurso.produto === produto && emCurso.fonte === fonte ? (
        <p className="ds-cluster-vazio" role="status">
          {t('designStudio.home.gerando', fonteName(fonte), emCurso.passo)}
        </p>
      ) : (
        <div className="ds-cluster-vazio">
          <span>{t('designStudio.home.semRelatorioFonte', fonteName(fonte))}</span>
          <Button
            cut={false}
            variant="ghost"
            className="wb-btn wb-btn-sm ds-btn-sec"
            onClick={() => dados.geracao.pedir(produto, fonte)}
          >
            <RelatorioIcon size={14} />
            {t('designStudio.home.gerar')}
          </Button>
        </div>
      )}
    </section>
  )
}
