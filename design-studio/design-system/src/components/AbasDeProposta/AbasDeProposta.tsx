import React, { useRef } from "react"
import { cx } from "../../utils/cx"
import { Icone } from "../Icone/Icone"
import "./AbasDeProposta.css"

export type Proposta = {
  id: string
  /** "A · Status que avisa". */
  nome: string
  /** `ativa` ganha o ponto laranja; `descartada` fica riscada. */
  estado?: "ativa" | "rascunho" | "descartada"
  /** Dica com o resumo da Proposta. */
  descricao?: string
}

export type AbasDePropostaProps = {
  propostas: Proposta[]
  selecionada: string
  aoSelecionar: (id: string) => void
  /** Mostra o botão "Nova". */
  aoCriar?: () => void
  className?: string
}

/** As abas de Proposta no topo do canvas. Setas, Home e End trocam de aba. */
export function AbasDeProposta({ propostas, selecionada, aoSelecionar, aoCriar, className }: AbasDePropostaProps) {
  const lista = useRef<HTMLDivElement>(null)
  const mover = (e: React.KeyboardEvent, indice: number) => {
    const n = propostas.length
    const alvo =
      e.key === "ArrowRight" ? (indice + 1) % n : e.key === "ArrowLeft" ? (indice - 1 + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1
    if (alvo < 0) return
    e.preventDefault()
    const proposta = propostas[alvo]!
    aoSelecionar(proposta.id)
    lista.current?.querySelectorAll<HTMLButtonElement>("[role='tab']")[alvo]?.focus()
  }
  return (
    <div className={cx("dst-abas-proposta", className)}>
      <div ref={lista} className="dst-abas-proposta__lista" role="tablist" aria-label="Propostas">
        {propostas.map((p, i) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={p.id === selecionada}
            tabIndex={p.id === selecionada ? 0 : -1}
            title={p.descricao}
            className={cx("dst-abas-proposta__aba", p.estado === "descartada" && "dst-abas-proposta__aba--descartada")}
            onClick={() => aoSelecionar(p.id)}
            onKeyDown={(e) => mover(e, i)}
          >
            {p.estado === "ativa" && <span className="dst-abas-proposta__ponto" aria-hidden="true" />}
            <span>{p.nome}</span>
            {p.estado === "ativa" && <span className="dst-sr"> (ativa)</span>}
            {p.estado === "descartada" && <span className="dst-sr"> (descartada)</span>}
          </button>
        ))}
      </div>
      {aoCriar && (
        <button type="button" className="dst-abas-proposta__nova" onClick={aoCriar}>
          <Icone nome="mais" />
          Nova
        </button>
      )}
    </div>
  )
}
