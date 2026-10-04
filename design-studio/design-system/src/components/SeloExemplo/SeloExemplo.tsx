import React from "react"
import { cx } from "../../utils/cx"
import "./SeloExemplo.css"

export type SeloExemploProps = {
  /** `pill` (cabeçalho, lateral recolhida, celular) ou `linha` (lateral aberta). */
  forma?: "pill" | "linha"
  /** Padrão "Dados de exemplo". */
  texto?: string
  className?: string
}

/** O selo que acompanha todo dado sintético. */
export function SeloExemplo({ forma = "pill", texto = "Dados de exemplo", className }: SeloExemploProps) {
  return <span className={cx("dst-selo-exemplo", `dst-selo-exemplo--${forma}`, className)}>{texto}</span>
}
