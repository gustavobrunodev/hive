import React, { useId } from "react"
import { cx } from "../../utils/cx"
import "./MolduraDeAparelho.css"

export type MolduraDeAparelhoProps = {
  /** O nome da tela ("Revisar"). */
  nome: string
  /** Mostra "· em foco" em `acento-tinta`. */
  emFoco?: boolean
  /** `criando` mostra o esqueleto; `na-fila` esmaece o frame. */
  estado?: "pronto" | "criando" | "na-fila"
  /** Texto depois do nome quando o agente está trabalhando ("Claude está desenhando…"). */
  legenda?: string
  /** `celular` (390×780) ou `desktop` (janela 1040×680). */
  dispositivo?: "celular" | "desktop"
  /** Endereço mostrado na barra da janela de desktop. */
  url?: string
  /** Pulsa uma vez um anel laranja: o agente acabou de mudar esta tela. */
  realce?: boolean
  /** O conteúdo da tela: o Protótipo, com o design system do cliente. */
  children?: React.ReactNode
  className?: string
}

function Esqueleto() {
  return (
    <div className="dst-moldura__esqueleto" aria-hidden="true">
      <i style={{ width: "55%" }} />
      <i className="dst-moldura__esqueleto-alto" />
      <i />
      <i style={{ width: "80%" }} />
      <i className="dst-moldura__esqueleto-alto" />
      <i style={{ width: "40%" }} />
    </div>
  )
}

/** O frame onde cada tela do Protótipo vive no canvas. */
export function MolduraDeAparelho({
  nome,
  emFoco = false,
  estado = "pronto",
  legenda,
  dispositivo = "celular",
  url = "prototipo.local",
  realce = false,
  children,
  className,
}: MolduraDeAparelhoProps) {
  const id = useId()
  const tela = estado === "criando" ? <Esqueleto /> : children
  const fila = estado === "na-fila"
  return (
    <figure
      className={cx("dst-moldura", `dst-moldura--${estado}`, realce && "dst-moldura--realce", className)}
      aria-busy={estado === "criando" || undefined}
      aria-labelledby={id}
    >
      <figcaption id={id} className="dst-moldura__rotulo">
        <b>{nome}</b>
        {legenda ? <span>{legenda}</span> : fila ? <span>na fila</span> : emFoco ? <span className="dst-moldura__em-foco">· em foco</span> : null}
      </figcaption>
      {dispositivo === "celular" ? (
        <div className="dst-moldura__aparelho">
          <div className="dst-moldura__tela">{tela}</div>
        </div>
      ) : (
        <div className="dst-moldura__janela">
          <div className="dst-moldura__janela-barra" aria-hidden="true">
            <i />
            <i />
            <i />
            <span>{url}</span>
          </div>
          <div className="dst-moldura__tela dst-moldura__tela--janela">{tela}</div>
        </div>
      )}
    </figure>
  )
}
