import React, { useId } from "react"
import { cx } from "../../utils/cx"
import { BotaoEnviar } from "../Botao/Botao"
import { ChipDeDor, type Fonte } from "../ChipDeFonte/ChipDeFonte"
import { Icone } from "../Icone/Icone"
import "./CampoDoChat.css"

export type Citacao = { id: string; fonte: Fonte; titulo: string }

export type CampoDoChatProps = {
  valor: string
  aoMudar: (texto: string) => void
  /** Chamado pelo botão de enviar ou por Enter (Shift+Enter quebra a linha). */
  aoEnviar: (envio: { texto: string; citacoes: Citacao[] }) => void
  /** Dores citadas com @, mostradas acima do texto. */
  citacoes?: Citacao[]
  aoRemoverCitacao?: (id: string) => void
  /** Seletores à esquerda, depois do botão de anexar (Protótipo). */
  seletores?: React.ReactNode
  /** Seletor à direita, antes do microfone (agente e modelo). */
  agente?: React.ReactNode
  /** Mostra o botão de anexar. */
  aoAnexar?: () => void
  /** Mostra o microfone. */
  aoGravar?: () => void
  gravando?: boolean
  placeholder?: string
  /** Nome acessível do campo. Padrão "Mensagem para o agente". */
  rotulo?: string
  /** `inicio` (grande, no Início) ou `compacto` (vista de trabalho). */
  tamanho?: "inicio" | "compacto"
  className?: string
}

/** O campo onde a pessoa conversa com o agente. */
export function CampoDoChat({
  valor,
  aoMudar,
  aoEnviar,
  citacoes = [],
  aoRemoverCitacao,
  seletores,
  agente,
  aoAnexar,
  aoGravar,
  gravando = false,
  placeholder = "Peça uma mudança, cite uma Dor com @…",
  rotulo = "Mensagem para o agente",
  tamanho = "inicio",
  className,
}: CampoDoChatProps) {
  const id = useId()
  const podeEnviar = valor.trim().length > 0 || citacoes.length > 0
  const enviar = () => {
    if (podeEnviar) aoEnviar({ texto: valor.trim(), citacoes })
  }
  return (
    <div className={cx("dst-campo-chat", tamanho === "compacto" && "dst-campo-chat--compacto", className)}>
      {citacoes.length > 0 && (
        <div className="dst-campo-chat__contexto">
          {citacoes.map((c) => (
            <ChipDeDor key={c.id} fonte={c.fonte} titulo={c.titulo} aoRemover={aoRemoverCitacao ? () => aoRemoverCitacao(c.id) : undefined} />
          ))}
        </div>
      )}
      <label className="dst-sr" htmlFor={id}>
        {rotulo}
      </label>
      <textarea
        id={id}
        className="dst-campo-chat__texto"
        value={valor}
        placeholder={placeholder}
        rows={2}
        onChange={(e) => aoMudar(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            enviar()
          }
        }}
      />
      <div className="dst-campo-chat__barra">
        {aoAnexar && (
          <button type="button" className="dst-campo-chat__redondo" aria-label="Anexar arquivo ou print" title="Anexar arquivo ou print" onClick={aoAnexar}>
            <Icone nome="mais" />
          </button>
        )}
        {seletores}
        <span className="dst-campo-chat__espaco" />
        {agente}
        {aoGravar && (
          <button
            type="button"
            className={cx("dst-campo-chat__redondo", gravando && "dst-campo-chat__redondo--gravando")}
            aria-label={gravando ? "Parar de gravar" : "Falar com o agente"}
            aria-pressed={gravando}
            onClick={aoGravar}
          >
            <Icone nome={gravando ? "parar" : "mic"} />
          </button>
        )}
        <BotaoEnviar disabled={!podeEnviar} onClick={enviar} />
      </div>
    </div>
  )
}
