import React from "react"
import type { NomeDoIcone } from "../../icones/icones"
import { cx } from "../../utils/cx"
import { Icone } from "../Icone/Icone"
import "./ChipDeFonte.css"

export type Fonte = "likert" | "voz" | "fullstory"

export const FONTES: Record<Fonte, { nome: string; icone: NomeDoIcone }> = {
  likert: { nome: "Likert", icone: "likert" },
  voz: { nome: "Voz do Cliente", icone: "voz" },
  fullstory: { nome: "FullStory", icone: "fullstory" },
}

export type ChipDeFonteProps = {
  fonte: Fonte
  /** `p` (24px), `m` (36px) ou `g` (52px). */
  tamanho?: "p" | "m" | "g"
  /** Anuncia o nome da Fonte; desligado quando o nome está escrito ao lado. */
  anunciar?: boolean
  className?: string
}

/** O quadradinho com o ícone da Fonte, na cor dela. */
export function ChipDeFonte({ fonte, tamanho = "p", anunciar = false, className }: ChipDeFonteProps) {
  return (
    <span
      className={cx("dst-chip-fonte", `dst-chip-fonte--${fonte}`, tamanho !== "p" && `dst-chip-fonte--${tamanho}`, className)}
      role={anunciar ? "img" : undefined}
      aria-label={anunciar ? FONTES[fonte].nome : undefined}
      aria-hidden={anunciar ? undefined : true}
    >
      <Icone nome={FONTES[fonte].icone} />
    </span>
  )
}

export type ChipDeDorProps = {
  fonte: Fonte
  /** O título da Dor; corta com reticências. */
  titulo: string
  /** Mostra o botão de remover a citação. */
  aoRemover?: () => void
  /** Nome acessível do botão de remover. Padrão "Tirar a citação". */
  rotuloRemover?: string
  className?: string
}

/** A Dor citada: pill branco com o chip da Fonte e o título. */
export function ChipDeDor({ fonte, titulo, aoRemover, rotuloRemover = "Tirar a citação", className }: ChipDeDorProps) {
  return (
    <span className={cx("dst-chip-dor", className)} title={titulo}>
      <ChipDeFonte fonte={fonte} />
      <span className="dst-chip-dor__texto">{titulo}</span>
      {aoRemover && (
        <button type="button" className="dst-chip-dor__remover" aria-label={`${rotuloRemover}: ${titulo}`} onClick={aoRemover}>
          <Icone nome="fechar" />
        </button>
      )}
    </span>
  )
}
