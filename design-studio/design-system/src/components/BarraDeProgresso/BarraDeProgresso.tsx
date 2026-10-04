import React from "react"
import { cx } from "../../utils/cx"
import "./BarraDeProgresso.css"

export type BarraDeProgressoProps = {
  /** De 0 a 1; valores fora são limitados. */
  valor: number
  /** Nome acessível ("Progresso das Variantes"). */
  rotulo: string
  className?: string
}

/** Barra de 6px em `superficie-3` com o progresso em `acento`. */
export function BarraDeProgresso({ valor, rotulo, className }: BarraDeProgressoProps) {
  const pct = Math.round(Math.max(0, Math.min(1, valor)) * 100)
  return (
    <div className={cx("dst-progresso", className)} role="progressbar" aria-label={rotulo} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <i style={{ width: `${pct}%` }} />
    </div>
  )
}
