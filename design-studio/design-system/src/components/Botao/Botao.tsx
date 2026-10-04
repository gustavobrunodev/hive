import React from "react"
import type { NomeDoIcone } from "../../icones/icones"
import { cx } from "../../utils/cx"
import { Icone } from "../Icone/Icone"
import "./Botao.css"

type Ancora = React.ComponentPropsWithoutRef<"a">
type BotaoNativo = React.ComponentPropsWithoutRef<"button">

export type BotaoProps = {
  /** `primario` (laranja, a ação principal), `secundario` (superfície com borda) ou `terciario` (transparente). Padrão `primario`. */
  variante?: "primario" | "secundario" | "terciario"
  /** `pequeno` para rodapés de painel. */
  tamanho?: "normal" | "pequeno"
  /** Ícone antes do rótulo. */
  icone?: NomeDoIcone
  /** Vira link (`<a>`) quando recebe `href`. */
  href?: string
  className?: string
  children?: React.ReactNode
} & Omit<Ancora & BotaoNativo, "href" | "className" | "children" | "type"> & { type?: "button" | "submit" | "reset" }

/** Botão do estúdio. Repassa a ref para o `<button>` ou `<a>`. */
export const Botao = React.forwardRef<HTMLButtonElement | HTMLAnchorElement, BotaoProps>(function Botao(
  { variante = "primario", tamanho = "normal", icone, href, className, children, type = "button", ...resto },
  ref
) {
  const classes = cx("dst-botao", `dst-botao--${variante}`, tamanho === "pequeno" && "dst-botao--pequeno", className)
  const conteudo = (
    <>
      {icone && <Icone nome={icone} />}
      {children}
    </>
  )
  if (href) {
    return (
      <a ref={ref as React.Ref<HTMLAnchorElement>} className={classes} href={href} {...(resto as Ancora)}>
        {conteudo}
      </a>
    )
  }
  return (
    <button ref={ref as React.Ref<HTMLButtonElement>} type={type} className={classes} {...(resto as BotaoNativo)}>
      {conteudo}
    </button>
  )
})

export type BotaoIconeProps = {
  /** Nome acessível e dica do botão ("Fechar", "Recolher a barra lateral"). Obrigatório. */
  rotulo: string
  icone: NomeDoIcone
  className?: string
} & Omit<BotaoNativo, "className" | "children" | "type">

/** Botão só de ícone, 34px, transparente. */
export const BotaoIcone = React.forwardRef<HTMLButtonElement, BotaoIconeProps>(function BotaoIcone(
  { rotulo, icone, className, ...resto },
  ref
) {
  return (
    <button ref={ref} type="button" className={cx("dst-botao-icone", className)} aria-label={rotulo} title={rotulo} {...resto}>
      <Icone nome={icone} />
    </button>
  )
})

export type BotaoEnviarProps = {
  /** Nome acessível. Padrão "Enviar". */
  rotulo?: string
  className?: string
} & Omit<BotaoNativo, "className" | "children">

/** O círculo laranja de 38px que envia a mensagem do campo do chat. */
export function BotaoEnviar({ rotulo = "Enviar", className, type = "button", ...resto }: BotaoEnviarProps) {
  return (
    <button type={type} className={cx("dst-botao-enviar", className)} aria-label={rotulo} {...resto}>
      <Icone nome="enviar" />
    </button>
  )
}
