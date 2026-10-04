import React from "react"
import { cx } from "../../utils/cx"
import "./CursorDoAgente.css"

export type CursorDoAgenteProps = {
  /** O nome no rótulo ("Claude", "Devin"). */
  nome: string
  /** Posição em px dentro do contêiner posicionado. */
  x?: number
  y?: number
  /** Some com transição quando `false`. Padrão `true`. */
  visivel?: boolean
  className?: string
}

/** A presença do agente no quadro: seta laranja com o nome. Decorativo para leitor de tela. */
export function CursorDoAgente({ nome, x = 0, y = 0, visivel = true, className }: CursorDoAgenteProps) {
  return (
    <div className={cx("dst-cursor-agente", !visivel && "dst-cursor-agente--oculto", className)} aria-hidden="true" style={{ transform: `translate(${x}px, ${y}px)` }}>
      <svg viewBox="0 0 24 24" focusable="false">
        <path d="M4 3l15 7-6.6 2.1L10 19z" fill="var(--acento)" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
      <span>{nome}</span>
    </div>
  )
}
