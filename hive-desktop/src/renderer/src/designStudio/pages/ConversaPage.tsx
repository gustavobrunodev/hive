import { useEffect, useRef, useState } from 'react'
import { TypingIndicator } from '@hive/design-system'
import { t } from '../../i18n'
import { sessionTitle } from '../../chat/sessionMeta'
import type { ClaudeAuthSession } from '../../claudeAuth/useClaudeAuth'
import { ChatBubbleIcon } from '../../ui/icons'
import { CampoDoChat } from '../CampoDoChat'
import { perguntasProntas, relatoriosDoProduto } from '../conversaModel'
import { DorIcon, RelatorioIcon } from '../icons'
import { ItemDaConversa } from '../ItemDaConversa'
import { useDesignData } from '../moduleData'
import type { DesignRoute } from '../routes'
import type { ModuleConversation } from '../useDesignStudio'
import { conversationField } from '../useRascunhos'
import { SampleSeal } from './PageHeader'

/** The conversation's title: the module's own, else the history list's — or "Conversa" before either knows it. */
function conversaTitle(
  local: string | undefined,
  conversation: ModuleConversation | undefined
): string {
  if (local) return local
  return conversation === undefined
    ? t('designStudio.conversa.titleUnknown')
    : sessionTitle(conversation)
}

export interface ConversaPageProps {
  produto: string
  conversa: string
  /** The conversation's row in the listing ("Recentes"), when it has one. */
  conversation: ModuleConversation | undefined
  seal: boolean
  navigate: (route: DesignRoute) => void
  claudeAuth?: ClaudeAuthSession
}

/**
 * P13 — the conversa do Produto (criteria 10–17, `home.js` and `chat.js`):
 * the title, the chips "<Produto>", "<n> de 3 Relatórios" and "Sem Protótipo",
 * the messages, the ready questions and the field.
 *
 * Only the reply's text and the module's own lines are drawn: no tool, path,
 * command or permission ever reaches this page (criterion 17) — main sends it
 * nothing else.
 */
export function ConversaPage({
  produto,
  conversa,
  conversation,
  seal,
  navigate,
  claudeAuth
}: ConversaPageProps): React.JSX.Element {
  const dados = useDesignData()
  const { conversas } = dados
  const atual = conversas.de(produto, conversa)
  const [conectando, setConectando] = useState(false)
  const fim = useRef<HTMLDivElement>(null)

  useEffect(() => {
    conversas.abrir(produto, conversa)
  }, [conversas, produto, conversa])

  const itens = atual?.itens ?? []
  useEffect(() => {
    fim.current?.scrollIntoView?.({ block: 'end' })
  }, [itens.length])

  const relatorios = relatoriosDoProduto(dados.relatorios, produto)
  const respondendo = atual?.turno != null
  const ocupada = atual?.ocupada ?? true
  const aguardando = respondendo && !itens.some((item) => item.tipo === 'agente' && item.escrevendo)

  const perguntar = (texto: string): void => {
    if (!atual || ocupada || respondendo || atual.agente === null) return
    void conversas.enviar({
      produto,
      conversa,
      texto,
      citadas: [],
      anexos: [],
      relatoriosAnexados: [],
      agente: atual.agente
    })
  }

  const conta = claudeAuth
    ? {
        conectando,
        conectar: () => {
          if (conectando) return
          setConectando(true)
          void claudeAuth
            .connect()
            .then((ok) => {
              if (ok) conversas.reenviar(produto, conversa)
            })
            .finally(() => setConectando(false))
        }
      }
    : null

  return (
    <div className="ds-page ds-conversa">
      <header className="ds-conversa-head">
        <h1 className="ds-conversa-title">{conversaTitle(atual?.titulo, conversation)}</h1>
        <div
          className="ds-conversa-chips"
          role="group"
          aria-label={t('designStudio.conversa.contexto')}
        >
          <span className="ds-chip">
            <DorIcon size={13} />
            {produto}
          </span>
          <span className="ds-chip">
            <RelatorioIcon size={13} />
            {t('designStudio.conversa.chipRelatorios', relatorios.length)}
          </span>
          <span className="ds-chip">
            <ChatBubbleIcon size={13} />
            {t('designStudio.conversa.semPrototipo')}
          </span>
          {seal && <SampleSeal />}
        </div>
      </header>
      <div
        className="ds-msgs"
        role="log"
        aria-live="polite"
        aria-label={t('designStudio.conversa.mensagens')}
      >
        {itens.map((item) => (
          <ItemDaConversa
            key={item.id}
            item={item}
            contexto={{
              produto,
              dados,
              relatorios,
              navigate,
              onEscolherFonte: (fonte) => conversas.escolherFonte(produto, conversa, fonte),
              conta
            }}
          />
        ))}
        {aguardando && (
          <TypingIndicator className="ds-digitando" label={t('designStudio.conversa.escrevendo')} />
        )}
        <div ref={fim} />
      </div>
      <div className="ds-conversa-pe">
        <div
          className="ds-atalhos"
          role="group"
          aria-label={t('designStudio.conversa.perguntasLabel')}
        >
          {perguntasProntas().map((pergunta) => (
            <button
              key={pergunta}
              type="button"
              className="ds-atalho"
              aria-disabled={ocupada || respondendo || undefined}
              onClick={() => perguntar(pergunta)}
            >
              {pergunta}
            </button>
          ))}
        </div>
        <CampoDoChat
          campo={conversationField(produto, conversa)}
          produto={produto}
          modo="conversa"
          agente={atual?.agente ?? null}
          onAgente={(agente) => conversas.trocarAgente(produto, conversa, agente)}
          respondendo={respondendo}
          bloqueado={ocupada && !respondendo}
          onEnviar={(parte) => void conversas.enviar({ produto, conversa, ...parte })}
          onParar={() => conversas.parar(produto, conversa)}
        />
      </div>
    </div>
  )
}
