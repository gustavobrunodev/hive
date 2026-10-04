import React from "react"
import type { NomeDoIcone } from "../../icones/icones"
import { cx } from "../../utils/cx"
import { ChipDeDor, type Fonte } from "../ChipDeFonte/ChipDeFonte"
import { Icone } from "../Icone/Icone"
import "./MensagemDaPessoa.css"

export type MensagemDaPessoaProps = {
  hora: string
  /** De onde veio ("Atalho", "Ponto de inserção no canvas"), antes da hora. */
  origem?: string
  /** O texto do balão. Ignorado quando há `selecao`. */
  children?: React.ReactNode
  /** Uma seleção feita no canvas no lugar do texto. */
  selecao?: { elemento: string; pedido?: string; icone?: NomeDoIcone }
  /** Dores citadas, abaixo do balão. */
  citacoes?: { fonte: Fonte; titulo: string }[]
  className?: string
}

/** O que a pessoa disse ou fez: balão de texto ou seleção no canvas. */
export function MensagemDaPessoa({ hora, origem, children, selecao, citacoes = [], className }: MensagemDaPessoaProps) {
  return (
    <article className={cx("dst-msg-pessoa", className)} aria-label={`Você, ${hora}`}>
      {selecao ? (
        <div className="dst-msg-pessoa__selecao">
          <Icone nome={selecao.icone ?? "inserir"} />
          <span>
            <b>{selecao.elemento}</b>
            {selecao.pedido && <small>{selecao.pedido}</small>}
          </span>
        </div>
      ) : (
        <div className="dst-msg-pessoa__bolha">{children}</div>
      )}
      {citacoes.length > 0 && (
        <div className="dst-msg-pessoa__citas">
          {citacoes.map((c) => (
            <ChipDeDor key={c.titulo} fonte={c.fonte} titulo={c.titulo} />
          ))}
        </div>
      )}
      <span className="dst-msg-pessoa__hora">{origem ? `${origem} · ${hora}` : hora}</span>
    </article>
  )
}
