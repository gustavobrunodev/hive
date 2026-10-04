import React from "react"
import type { NomeDoIcone } from "../../icones/icones"
import { cx } from "../../utils/cx"
import { BotaoIcone } from "../Botao/Botao"
import { Icone } from "../Icone/Icone"
import "./PainelFlutuante.css"

export type PainelFlutuanteProps = {
  /** Nome acessível do painel ("Inserir na tela Revisar"). */
  rotulo: string
  icone?: NomeDoIcone
  /** O alvo ("Depois do bloco “Beneficiário”"). */
  titulo: React.ReactNode
  /** A tela e a Proposta ("Revisar · Proposta A"). */
  subtitulo?: React.ReactNode
  /** Mostra o botão de fechar. */
  aoFechar?: () => void
  /** Botões do rodapé; dividem a largura. */
  rodape?: React.ReactNode
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
}

/** O painel de 300px do modo ao vivo (Editar, Inserir, Ajustar). Não é modal. */
export function PainelFlutuante({ rotulo, icone, titulo, subtitulo, aoFechar, rodape, className, style, children }: PainelFlutuanteProps) {
  return (
    <section className={cx("dst-painel-flutuante", className)} role="dialog" aria-label={rotulo} style={style}>
      <div className="dst-painel-flutuante__cab">
        {icone && <Icone nome={icone} />}
        <strong>
          {titulo}
          {subtitulo && <small>{subtitulo}</small>}
        </strong>
        {aoFechar && <BotaoIcone rotulo="Fechar" icone="fechar" onClick={aoFechar} />}
      </div>
      <div className="dst-painel-flutuante__corpo">{children}</div>
      {rodape && <div className="dst-painel-flutuante__pe">{rodape}</div>}
    </section>
  )
}

export type LinhaDoPainelProps = {
  /** O nome da escolha ("Onde", "Tamanho"). */
  rotulo: string
  /** O controle, alinhado à direita (um `Segmentado` compacto). */
  children: React.ReactNode
}

/** Uma linha "rótulo + controle" do corpo do painel. */
export function LinhaDoPainel({ rotulo, children }: LinhaDoPainelProps) {
  return (
    <div className="dst-painel-flutuante__linha">
      <span>{rotulo}</span>
      {children}
    </div>
  )
}

export type SugestoesProps<T extends string> = {
  opcoes: readonly { valor: T; rotulo: string }[]
  /** A sugestão marcada, ou `null`. */
  valor: T | null
  aoMudar: (valor: T) => void
  /** Nome acessível do grupo ("Sugestões"). */
  rotulo: string
}

/** Grade de duas colunas de sugestões; a marcada fica invertida em `tinta`. */
export function Sugestoes<T extends string>({ opcoes, valor, aoMudar, rotulo }: SugestoesProps<T>) {
  return (
    <div className="dst-sugestoes" role="group" aria-label={rotulo}>
      {opcoes.map((o) => (
        <button key={o.valor} type="button" aria-pressed={o.valor === valor} onClick={() => aoMudar(o.valor)}>
          {o.rotulo}
        </button>
      ))}
    </div>
  )
}

export type NavegacaoDeVariantesProps = {
  /** Índice começando em 1. */
  atual: number
  total: number
  /** O nome da Variante atual ("Aviso · Informativo"). */
  nome: string
  aoAnterior: () => void
  aoProxima: () => void
}

/** "Variante 2 de 3" com as setas de anterior e próxima. */
export function NavegacaoDeVariantes({ atual, total, nome, aoAnterior, aoProxima }: NavegacaoDeVariantesProps) {
  const uma = total < 2
  return (
    <div className="dst-variantes">
      <BotaoIcone rotulo="Variante anterior" icone="esq" onClick={aoAnterior} disabled={uma} />
      <strong role="status">
        Variante {atual} de {total}
        <span>{nome}</span>
      </strong>
      <BotaoIcone rotulo="Próxima Variante" icone="dir" onClick={aoProxima} disabled={uma} />
    </div>
  )
}
