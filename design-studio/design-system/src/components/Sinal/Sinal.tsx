import React from "react"
import { cx } from "../../utils/cx"
import "./Sinal.css"

export type SinalProps = {
  /** Lado em px. Padrão 30, o tamanho da lateral. */
  tamanho?: number
  /** Texto para leitor de tela; sem ele o sinal é decorativo. */
  rotulo?: string
  className?: string
}

/** O sinal do Design Studio. As cores seguem o tema (`acento` e `sobre-acento`). */
export function Sinal({ tamanho = 30, rotulo, className }: SinalProps) {
  return (
    <svg
      className={cx("dst-sinal", className)}
      viewBox="0 0 32 32"
      width={tamanho}
      height={tamanho}
      role={rotulo ? "img" : undefined}
      aria-label={rotulo}
      aria-hidden={rotulo ? undefined : true}
      focusable="false"
    >
      <rect x="2" y="2" width="28" height="28" rx="9" fill="var(--acento)" />
      <path d="M10 21.5h7.5a5.5 5.5 0 0 0 0-11H10z" fill="none" stroke="var(--sobre-acento)" strokeWidth="2.6" strokeLinejoin="round" />
      <circle cx="22.6" cy="21.4" r="2.1" fill="var(--sobre-acento)" />
    </svg>
  )
}

export type MarcaProps = {
  /** Vira link quando recebe `href`. */
  href?: string
  /** Mostra só o sinal (lateral recolhida); o nome continua para leitor de tela. */
  soSinal?: boolean
  className?: string
}

/** O sinal ao lado de "Design Studio" em Bricolage 700. */
export function Marca({ href, soSinal = false, className }: MarcaProps) {
  const conteudo = (
    <>
      <Sinal />
      <span className={cx(soSinal && "dst-sr")}>Design Studio</span>
    </>
  )
  return href ? (
    <a className={cx("dst-marca", className)} href={href}>
      {conteudo}
    </a>
  ) : (
    <span className={cx("dst-marca", className)}>{conteudo}</span>
  )
}
