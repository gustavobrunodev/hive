import React from "react"
import { marcasDosAgentes, type Agente } from "../../marcas/marcas"
import { cx } from "../../utils/cx"
import "./LogoDoAgente.css"

export type LogoDoAgenteProps = {
  agente: Agente
  /** `normal` (24px, mensagens e seletores), `pequeno` (20px, autoria do insight) ou `grande` (40px, Configurações). */
  tamanho?: "normal" | "pequeno" | "grande"
  /** Anuncia o nome do agente para leitor de tela. Desligado quando o nome já está escrito ao lado. */
  anunciar?: boolean
  className?: string
}

/** A logo oficial do agente num ladrilho neutro. */
export function LogoDoAgente({ agente, tamanho = "normal", anunciar = false, className }: LogoDoAgenteProps) {
  const marca = marcasDosAgentes[agente]
  return (
    <span
      className={cx("dst-logo-agente", `dst-logo-agente--${agente}`, tamanho !== "normal" && `dst-logo-agente--${tamanho}`, className)}
      role={anunciar ? "img" : undefined}
      aria-label={anunciar ? marca.nome : undefined}
      aria-hidden={anunciar ? undefined : true}
    >
      <svg viewBox={marca.viewBox} aria-hidden="true" focusable="false">
        <path d={marca.caminho} fill={marca.cor} />
      </svg>
    </span>
  )
}
