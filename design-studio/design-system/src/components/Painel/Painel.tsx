import React from "react"
import { cx } from "../../utils/cx"
import "./Painel.css"

export type PainelProps = {
  /** Título do cabeçalho (h2 por padrão). */
  titulo?: React.ReactNode
  subtitulo?: React.ReactNode
  /** Ação à direita do cabeçalho ("Ver tabela"). */
  acao?: React.ReactNode
  /** Elemento do painel. `figure` para gráficos. */
  como?: "section" | "figure" | "div"
  /** Id do título, para `aria-labelledby` do painel. */
  idDoTitulo?: string
  className?: string
  children: React.ReactNode
}

/** A superfície de página: `superficie`, borda `borda`, canto `raio-l`, `sombra-1`. */
export function Painel({ titulo, subtitulo, acao, como = "section", idDoTitulo, className, children }: PainelProps) {
  const Elemento = como
  return (
    <Elemento className={cx("dst-painel", className)} aria-labelledby={titulo && idDoTitulo ? idDoTitulo : undefined}>
      {(titulo || acao) && (
        <div className="dst-painel__cab">
          <div>
            {titulo && <h2 id={idDoTitulo}>{titulo}</h2>}
            {subtitulo && <p>{subtitulo}</p>}
          </div>
          {acao}
        </div>
      )}
      {children}
    </Elemento>
  )
}
