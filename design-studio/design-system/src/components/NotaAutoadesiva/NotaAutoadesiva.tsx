import React from "react"
import { cx } from "../../utils/cx"
import { ChipDeFonte, FONTES, type Fonte } from "../ChipDeFonte/ChipDeFonte"
import { Icone } from "../Icone/Icone"
import { Tendencia, type DirecaoDaTendencia, type NivelDeImpacto } from "../Pilula/Pilula"
import "./NotaAutoadesiva.css"

const NOME_DO_IMPACTO: Record<NivelDeImpacto, string> = { alto: "Alto", medio: "Médio", baixo: "Baixo" }

export type NotaAutoadesivaProps = {
  fonte: Fonte
  /** O título da Dor, até 3 linhas. */
  titulo: string
  /** "1.284 ligações", "412 menções", "2.140 clientes". */
  volume?: string
  impacto?: NivelDeImpacto
  tendencia?: { direcao: DirecaoDaTendencia; valor?: string }
  /** Giro em graus, entre -1.8 e 1.8 (valores fora são limitados). */
  giro?: number
  /** Com `aoClicar` a nota vira botão alternável; `marcada` diz se está escolhida. */
  marcada?: boolean
  aoClicar?: () => void
  /** A frase completa do cliente, na dica. */
  descricao?: string
  /** `grande` é a nota colada no canvas ao lado do frame. */
  tamanho?: "normal" | "grande"
  className?: string
}

/** A Dor colada no quadro como papel: a cor diz a Fonte, o rodapé diz o tamanho e o impacto. */
export function NotaAutoadesiva({
  fonte,
  titulo,
  volume,
  impacto,
  tendencia,
  giro = 0,
  marcada = false,
  aoClicar,
  descricao,
  tamanho = "normal",
  className,
}: NotaAutoadesivaProps) {
  const r = Math.max(-1.8, Math.min(1.8, giro))
  const classes = cx("dst-nota", `dst-nota--${fonte}`, tamanho === "grande" && "dst-nota--grande", className)
  const corpo = (
    <>
      <span className="dst-nota__check" aria-hidden="true">
        <Icone nome="ok" />
      </span>
      <span className="dst-nota__fonte">
        <ChipDeFonte fonte={fonte} />
        <span className="dst-sr">{FONTES[fonte].nome}: </span>
      </span>
      <span className="dst-nota__titulo">{titulo}</span>
      {(volume || impacto || tendencia) && (
        <span className="dst-nota__pe">
          {volume && (
            <span className="dst-nota__volume">
              <Icone nome={FONTES[fonte].icone} />
              <span>{volume}</span>
            </span>
          )}
          {impacto && (
            <span className={cx("dst-nota__impacto", `dst-nota__impacto--${impacto}`)}>
              <span className="dst-sr">Impacto </span>
              {NOME_DO_IMPACTO[impacto]}
            </span>
          )}
          {tendencia && <Tendencia direcao={tendencia.direcao} valor={tendencia.valor} />}
        </span>
      )}
    </>
  )
  const estilo = { "--r": `${r}deg` } as React.CSSProperties
  return aoClicar ? (
    <button type="button" className={classes} style={estilo} title={descricao} aria-pressed={marcada} onClick={aoClicar}>
      {corpo}
    </button>
  ) : (
    <div className={classes} style={estilo} title={descricao}>
      {corpo}
    </div>
  )
}
