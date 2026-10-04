import React from "react"
import { cx } from "../../utils/cx"
import { Pilula, PilulaDeImpacto } from "../Pilula/Pilula"
import "./CartaoDeRevisao.css"

export type Achado = { nivel: "resolvido" | "alto" | "medio" | "baixo"; texto: string }

export type CartaoDeRevisaoProps = {
  /** "Revisão de usabilidade da Proposta A". */
  titulo: string
  achados: Achado[]
  className?: string
}

/** O cartão em que o agente devolve uma revisão: um achado por linha, com o nível à esquerda. */
export function CartaoDeRevisao({ titulo, achados, className }: CartaoDeRevisaoProps) {
  return (
    <section className={cx("dst-revisao", className)} aria-label={titulo}>
      <p className="dst-revisao__titulo">{titulo}</p>
      <ul className="dst-revisao__achados">
        {achados.map((a) => (
          <li key={a.texto} className="dst-revisao__achado">
            {a.nivel === "resolvido" ? (
              <Pilula tom="ok" icone="ok">
                Resolvido
              </Pilula>
            ) : (
              <PilulaDeImpacto nivel={a.nivel} />
            )}
            <span>{a.texto}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
