import React from "react"
import { marcasDosAgentes, type Agente } from "../../marcas/marcas"
import { cx } from "../../utils/cx"
import { Icone } from "../Icone/Icone"
import { LogoDoAgente } from "../LogoDoAgente/LogoDoAgente"
import "./MensagemDoAgente.css"

export type MensagemDoAgenteProps = {
  agente: Agente
  /** Padrão: o nome do agente ("Claude", "Devin"). */
  nome?: string
  /** O modelo em chip ("Sonnet"). */
  modelo?: string
  hora: string
  /** O texto da resposta; parágrafos ficam a 10px um do outro. */
  children: React.ReactNode
  /** O que foi aplicado, em pill laranja ("Aviso inserido · Variante 2"). */
  carimbo?: string
  /** Uma linha por coisa que o agente fez e conferiu. */
  acoes?: string[]
  /** "Aviso inserido": o Ponto de restauração criado por esta resposta. */
  pontoDeRestauracao?: string
  /** Torna o Ponto de restauração clicável. */
  aoAbrirPonto?: () => void
  className?: string
}

/** A resposta do agente na conversa: quem é, o que fez e o registro do que mudou. */
export function MensagemDoAgente({
  agente,
  nome = marcasDosAgentes[agente].nome,
  modelo,
  hora,
  children,
  carimbo,
  acoes = [],
  pontoDeRestauracao,
  aoAbrirPonto,
  className,
}: MensagemDoAgenteProps) {
  const ponto = pontoDeRestauracao && (
    <>
      <Icone nome="historico" />
      Ponto de restauração · {pontoDeRestauracao}
    </>
  )
  return (
    <article className={cx("dst-msg", className)} aria-label={`${nome}, ${hora}`}>
      <div className="dst-msg__cab">
        <LogoDoAgente agente={agente} />
        <b>{nome}</b>
        {modelo && <span className="dst-msg__modelo">{modelo}</span>}
        <span className="dst-msg__hora">{hora}</span>
      </div>
      <div className="dst-msg__texto">{children}</div>
      {carimbo && (
        <span className="dst-msg__carimbo">
          <Icone nome="ok" />
          {carimbo}
        </span>
      )}
      {acoes.length > 0 && (
        <ul className="dst-msg__acoes" aria-label="O que o agente fez">
          {acoes.map((a) => (
            <li key={a}>
              <Icone nome="ok" />
              {a}
            </li>
          ))}
        </ul>
      )}
      {ponto &&
        (aoAbrirPonto ? (
          <button type="button" className="dst-msg__ponto" onClick={aoAbrirPonto}>
            {ponto}
          </button>
        ) : (
          <span className="dst-msg__ponto">{ponto}</span>
        ))}
    </article>
  )
}
