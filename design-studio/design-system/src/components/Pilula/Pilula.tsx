import React from "react"
import type { NomeDoIcone } from "../../icones/icones"
import { cx } from "../../utils/cx"
import { Icone } from "../Icone/Icone"
import "./Pilula.css"

export type TomDaPilula = "alto" | "medio" | "baixo" | "ok" | "neutra"

export type PilulaProps = {
  tom: TomDaPilula
  icone?: NomeDoIcone
  className?: string
  children: React.ReactNode
}

/** Pílula de estado: Geist 600 0.75rem, canto `raio-pill`, sempre com palavra. */
export function Pilula({ tom, icone, className, children }: PilulaProps) {
  return (
    <span className={cx("dst-pilula", `dst-pilula--${tom}`, className)}>
      {icone && <Icone nome={icone} />}
      {children}
    </span>
  )
}

export type NivelDeImpacto = "alto" | "medio" | "baixo"

const IMPACTO: Record<NivelDeImpacto, { rotulo: string; icone: NomeDoIcone }> = {
  alto: { rotulo: "Alto", icone: "alerta" },
  medio: { rotulo: "Médio", icone: "impMedio" },
  baixo: { rotulo: "Baixo", icone: "impBaixo" },
}

export type PilulaDeImpactoProps = {
  nivel: NivelDeImpacto
  /** Troca a palavra ("Impacto alto"). Padrão: Alto, Médio, Baixo. */
  rotulo?: string
  className?: string
}

/** O impacto de uma Dor em três níveis, com ícone e palavra. */
export function PilulaDeImpacto({ nivel, rotulo, className }: PilulaDeImpactoProps) {
  const { rotulo: padrao, icone } = IMPACTO[nivel]
  return (
    <Pilula tom={nivel} icone={icone} className={className}>
      {rotulo ?? padrao}
    </Pilula>
  )
}

export type DirecaoDaTendencia = "sobe" | "desce" | "igual"

export type TendenciaProps = {
  direcao: DirecaoDaTendencia
  /** "22%"; ignorado quando a direção é `igual` (mostra "estável"). */
  valor?: string
  /** Período de comparação, vira dica. Padrão "Comparado aos 90 dias anteriores". */
  comparacao?: string
  className?: string
}

const PALAVRA: Record<DirecaoDaTendencia, string> = { sobe: "Alta de", desce: "Queda de", igual: "" }

/** A tendência de uma Dor: seta e porcentagem; alta em `critico-tinta`, queda em `ok-tinta`. */
export function Tendencia({ direcao, valor, comparacao = "Comparado aos 90 dias anteriores", className }: TendenciaProps) {
  return (
    <span className={cx("dst-tendencia", `dst-tendencia--${direcao}`, className)} title={comparacao}>
      <Icone nome={direcao} />
      {direcao === "igual" ? (
        "estável"
      ) : (
        <>
          <span className="dst-sr">{PALAVRA[direcao]} </span>
          {valor}
        </>
      )}
    </span>
  )
}
