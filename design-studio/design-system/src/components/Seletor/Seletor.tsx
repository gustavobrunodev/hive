import React from "react"
import type { NomeDoIcone } from "../../icones/icones"
import type { Agente } from "../../marcas/marcas"
import { cx } from "../../utils/cx"
import { Icone } from "../Icone/Icone"
import { LogoDoAgente } from "../LogoDoAgente/LogoDoAgente"
import "./Seletor.css"

export type SeletorProps = {
  /** O valor atual ("Novo Protótipo", "Claude"). */
  valor: string
  /** Complemento em `tinta-3` depois do valor ("· Câmbio", "Sonnet"). */
  complemento?: string
  /** Ícone à esquerda. Ignorado quando há `agente`. */
  icone?: NomeDoIcone
  /** Mostra a logo do agente no lugar do ícone. */
  agente?: Agente
  /** Estado do menu que o seletor abre. */
  aberto?: boolean
  className?: string
} & Omit<React.ComponentPropsWithoutRef<"button">, "className" | "children" | "type">

/** Pill de 34px que abre um menu de escolha: agente e modelo, Protótipo. Repassa a ref. */
export const Seletor = React.forwardRef<HTMLButtonElement, SeletorProps>(function Seletor(
  { valor, complemento, icone, agente, aberto, className, ...resto },
  ref
) {
  return (
    <button ref={ref} type="button" className={cx("dst-seletor", className)} aria-haspopup="menu" aria-expanded={aberto} {...resto}>
      {agente ? <LogoDoAgente agente={agente} /> : icone && <Icone nome={icone} />}
      <span>
        {valor}
        {complemento && <span className="dst-seletor__complemento"> {complemento}</span>}
      </span>
      <Icone nome="baixo" className="dst-seletor__seta" />
    </button>
  )
})
