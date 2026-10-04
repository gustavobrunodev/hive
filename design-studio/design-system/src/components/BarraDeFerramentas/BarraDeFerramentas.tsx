import React from "react"
import type { NomeDoIcone } from "../../icones/icones"
import { cx } from "../../utils/cx"
import { Icone } from "../Icone/Icone"
import "./BarraDeFerramentas.css"

export type BarraFlutuanteProps = {
  /** Nome acessível da barra ("Ferramentas"). */
  rotulo: string
  className?: string
  children: React.ReactNode
}

/** A pill flutuante do canvas (`role="toolbar"`). Setas esquerda e direita andam entre os botões. */
export function BarraFlutuante({ rotulo, className, children }: BarraFlutuanteProps) {
  const andar = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return
    const botoes = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")]
    const i = botoes.indexOf(document.activeElement as HTMLButtonElement)
    if (i < 0) return
    e.preventDefault()
    const proximo = e.key === "ArrowRight" ? (i + 1) % botoes.length : (i - 1 + botoes.length) % botoes.length
    botoes[proximo]?.focus()
  }
  return (
    <div className={cx("dst-barra-flutuante", className)} role="toolbar" aria-label={rotulo} onKeyDown={andar}>
      {children}
    </div>
  )
}

export type FerramentaProps = {
  icone: NomeDoIcone
  rotulo: string
  /** Estado de alternância (`aria-pressed`). Omita para botões de ação. */
  pressionada?: boolean
  /** O único item laranja da barra ("Testar"). */
  destaque?: boolean
  /** Mostra só o ícone; o rótulo vira dica e nome acessível. */
  soIcone?: boolean
  className?: string
} & Omit<React.ComponentPropsWithoutRef<"button">, "className" | "children" | "type">

/** Um botão de 34px da barra flutuante. A pressionada fica invertida em `tinta`. */
export function Ferramenta({ icone, rotulo, pressionada, destaque = false, soIcone = false, className, ...resto }: FerramentaProps) {
  return (
    <button
      type="button"
      className={cx("dst-ferramenta", destaque && "dst-ferramenta--destaque", className)}
      aria-pressed={pressionada}
      title={rotulo}
      {...resto}
    >
      <Icone nome={icone} />
      <span className={cx(soIcone && "dst-sr")}>{rotulo}</span>
    </button>
  )
}

/** Divisória vertical entre grupos de ferramentas. */
export function SeparadorDeFerramenta() {
  return <span className="dst-ferramenta-sep" aria-hidden="true" />
}
