import React from "react"
import { icones, type NomeDoIcone } from "../../icones/icones"
import { cx } from "../../utils/cx"
import "./Icone.css"

export type IconeProps = {
  /** Qual ícone do conjunto. */
  nome: NomeDoIcone
  /** Lado em px quando o ícone aparece sozinho. Dentro dos componentes, o CSS de cada um define o tamanho. Padrão 18. */
  tamanho?: number
  /** Texto para leitor de tela. Sem ele o ícone é decorativo (`aria-hidden`). */
  rotulo?: string
  className?: string
}

/** Um ícone de traço do estúdio. Segue a cor do texto (`currentColor`). */
export function Icone({ nome, tamanho = 18, rotulo, className }: IconeProps) {
  return (
    <svg
      className={cx("dst-ic", className)}
      viewBox="0 0 24 24"
      width={tamanho}
      height={tamanho}
      fill={nome === "mais3" ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={rotulo ? "img" : undefined}
      aria-label={rotulo}
      aria-hidden={rotulo ? undefined : true}
      focusable="false"
      dangerouslySetInnerHTML={{ __html: icones[nome] }}
    />
  )
}
