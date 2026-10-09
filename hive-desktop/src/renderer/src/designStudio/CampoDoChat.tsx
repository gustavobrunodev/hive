import { useEffect, useId } from 'react'
import { PromptInput } from '@hive/design-system'
import { t } from '../i18n'
import { EnginePicker } from '../chat/EnginePicker'
import { DictationBar } from '../dictation/DictationBar'
import { useAsrDictation, type AsrDictation } from '../dictation/useAsrDictation'
import { AgentSwitcher } from '../ui/AgentSwitcher'
import { MicIcon } from '../ui/icons'
import { VoiceModelGate } from '../voice/VoiceModelGate'
import { ContextoDoCampo } from './campo/ContextoDoCampo'
import { ListaDoArroba } from './campo/ListaDoArroba'
import { MenuDoMais } from './campo/MenuDoMais'
import { opcaoId } from './campo/useArroba'
import { useCampo, type Campo, type ParteDoEnvio } from './campo/useCampo'
import { doresDoArroba, relatoriosDoProduto } from './conversaModel'
import type { ModuleAgent } from './model'
import { useDesignData, type ModuleData } from './moduleData'
import { unidadeNota } from './relatorioModel'
import { useAgenteDoCampo, type AgenteDoCampo } from './useAgenteDoCampo'
import type { CampoId } from './useRascunhos'

export type { ParteDoEnvio } from './campo/useCampo'

export interface CampoDoChatProps {
  campo: CampoId
  produto: string
  modo: 'inicio' | 'conversa'
  agente: ModuleAgent | null
  onAgente: (agente: ModuleAgent) => void
  /** The agent is answering: Enviar becomes "Parar" (criterion 14). */
  respondendo: boolean
  /** Nothing goes out right now — a send is on its way or the conversation is still being read. */
  bloqueado?: boolean
  onEnviar: (envio: ParteDoEnvio) => void
  onParar?: () => void
}

/** The row under the text: `+`, then who answers and on which model, then the microphone. */
function BarraDoCampo({
  campo,
  produto,
  dados,
  agente,
  motor,
  voice
}: {
  campo: Campo
  produto: string
  dados: ModuleData
  agente: ModuleAgent | null
  motor: AgenteDoCampo
  voice: AsrDictation
}): React.JSX.Element {
  const { dictation, voiceGate } = voice
  return (
    <>
      <MenuDoMais
        produto={produto}
        relatorios={relatoriosDoProduto(dados.relatorios, produto)}
        onArquivos={() => void campo.attachments.pick()}
        onColar={() => dados.geracao.informar(t('designStudio.campo.colarDica'))}
        onCitar={campo.arroba.abrir}
        onRelatorio={campo.anexarRelatorio}
        onCloseFocus={() => campo.textareaRef.current?.focus()}
      />
      <span className="ds-campo-espaco" aria-hidden="true" />
      <AgentSwitcher
        agents={motor.agentes}
        value={agente?.id ?? null}
        locked={false}
        onChange={motor.escolherAgente}
      />
      <EnginePicker
        capabilities={motor.capabilities}
        model={agente?.modelo ?? ''}
        effort={agente?.esforco ?? ''}
        onModelChange={motor.escolherModelo}
        onEffortChange={motor.escolherEsforco}
        onRefresh={motor.refresh}
        refreshing={motor.refreshing}
      />
      <button
        type="button"
        className="wb-attach-btn wb-mic-btn"
        aria-label={t('dictation.start')}
        aria-pressed={dictation.active}
        title={t('dictation.startHint')}
        onPointerEnter={voiceGate.blocked ? undefined : dictation.prewarm}
        onFocus={voiceGate.blocked ? undefined : dictation.prewarm}
        onClick={() => voiceGate.guard(dictation.start)}
      >
        <MicIcon size={15} />
      </button>
    </>
  )
}

/** The dictation's transport, over the row while a take is live — the Hive composer's own. */
function Transporte({ voice }: { voice: AsrDictation }): React.JSX.Element {
  const { dictation } = voice
  return (
    <DictationBar
      phase={dictation.phase}
      levels={dictation.levels}
      failure={dictation.failure}
      partial={dictation.partial}
      onFinish={dictation.finish}
      onDiscard={dictation.discard}
      onRetry={dictation.retry}
      onRequestMic={dictation.start}
    />
  )
}

/**
 * The module's chat field (P2/P13, `composer.js`), on the Hive's own pieces:
 * the DS `PromptInput`, the agent switcher and engine picker filtered to the
 * module's agents, the Hive's attachments (picker, drag), its dictation and its
 * send ⇄ stop. What is the module's own: the `@` list of Dores, the cited
 * Dores as chips, the Relatórios attached from the `+`, and Ctrl+V of a print.
 */
export function CampoDoChat(props: CampoDoChatProps): React.JSX.Element {
  const { campo: campoId, produto, modo, agente, onAgente, respondendo, onEnviar, onParar } = props
  const bloqueado = props.bloqueado === true
  const dados = useDesignData()
  const campo = useCampo(campoId, dados)
  const listaId = useId()
  const voice = useAsrDictation({
    value: campo.texto,
    setValue: campo.setTexto,
    textareaRef: campo.textareaRef
  })
  const motor = useAgenteDoCampo(agente, onAgente, dados.geracao.informar)
  const ditando = voice.dictation.active
  const { arroba } = campo
  const opcoes = arroba.aberta ? doresDoArroba(dados.relatorios, produto, arroba.consulta) : []
  const ativa = arroba.aberta && opcoes.length > 0 ? opcaoId(listaId, arroba.destaque) : null

  // The field's name, on the textarea the DS draws (`composer.js`: "Mensagem
  // para o agente"), and the `@` list it drives.
  useEffect(() => {
    const node = campo.textareaRef.current
    if (!node) return
    node.setAttribute('aria-label', t('designStudio.campo.rotulo'))
    if (ativa === null) {
      node.removeAttribute('aria-controls')
      node.removeAttribute('aria-activedescendant')
      return
    }
    node.setAttribute('aria-controls', listaId)
    node.setAttribute('aria-activedescendant', ativa)
  })

  const enviar = (escrito: string): void => {
    if (bloqueado || respondendo || ditando || agente === null) return
    const parte = campo.enviar(escrito, agente)
    if (parte) onEnviar(parte)
  }

  return (
    <div
      className="wb-composer wb-composer-wrap ds-campo"
      data-modo={modo}
      data-arrastando={campo.attachments.dragActive || undefined}
      {...campo.attachments.dragHandlers}
      onPasteCapture={campo.colar}
      onKeyDownCapture={(event) => {
        arroba.teclado(event, opcoes.length, (index) => campo.escolherDor(opcoes[index]))
        voice.dictation.handleKeyDown(event)
      }}
    >
      {arroba.aberta && (
        <ListaDoArroba
          id={listaId}
          produto={produto}
          dores={opcoes}
          semRelatorio={relatoriosDoProduto(dados.relatorios, produto).length === 0}
          destaque={arroba.destaque}
          onDestacar={arroba.setDestaque}
          onEscolher={campo.escolherDor}
          unidade={(visivel) => unidadeNota(dados.catalogo, visivel.relatorio.fonte)}
        />
      )}
      <PromptInput
        className="ds-campo-input"
        value={campo.texto}
        onChange={(valor) => {
          campo.setTexto(valor)
          arroba.aoEditar()
        }}
        onSubmit={enviar}
        placeholder={t(
          modo === 'inicio'
            ? 'designStudio.campo.placeholderInicio'
            : 'designStudio.campo.placeholderConversa'
        )}
        streaming={respondendo || ditando || bloqueado}
        onStop={respondendo ? onParar : undefined}
        stopLabel={t('designStudio.campo.parar')}
        sendLabel={t('designStudio.campo.enviar')}
        allowEmptySubmit={campo.temContexto}
        highlighted={ditando}
        minRows={modo === 'inicio' ? 3 : 2}
        textareaRef={campo.textareaRef}
        attachments={
          campo.temContexto ? (
            <ContextoDoCampo
              citadas={campo.citadas}
              relatorios={campo.relatorios}
              attachments={campo.attachments}
              dados={dados}
              onTirar={(citacao) => dados.rascunhos.descitar(campoId, citacao)}
              onTirarRelatorio={campo.tirarRelatorio}
            />
          ) : undefined
        }
        toolbar={
          <BarraDoCampo
            campo={campo}
            produto={produto}
            dados={dados}
            agente={agente}
            motor={motor}
            voice={voice}
          />
        }
        toolbarOverlay={ditando ? <Transporte voice={voice} /> : undefined}
      />
      {campo.attachments.dragActive && (
        <div className="ds-campo-soltar" aria-hidden="true">
          {t('designStudio.campo.soltar')}
        </div>
      )}
      <VoiceModelGate
        open={voice.voiceGate.open}
        onOpenChange={voice.voiceGate.setOpen}
        onOpenSettings={() => voice.voiceGate.setOpen(false)}
      />
    </div>
  )
}
