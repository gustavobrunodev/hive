import React from "react"
import type { NomeDoIcone } from "../../icones/icones"
import { cx } from "../../utils/cx"
import { Icone } from "../Icone/Icone"
import "./Toast.css"

export type ToastProps = {
  /** O que acabou de acontecer ("Elemento inserido · Ponto de restauração criado"). */
  children: React.ReactNode
  /** Padrão `ok`; use `info` ou `alerta` quando não for confirmação. */
  icone?: NomeDoIcone
  /** Esmaece antes de sair. */
  saindo?: boolean
  className?: string
}

/** Aviso curto e invertido que confirma o que acabou de acontecer. */
export function Toast({ children, icone = "ok", saindo = false, className }: ToastProps) {
  return (
    <div className={cx("dst-toast", saindo && "dst-toast--saindo", className)} role="status">
      <Icone nome={icone} />
      <span>{children}</span>
    </div>
  )
}
