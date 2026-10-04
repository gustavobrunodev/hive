import React from "react"
import { marcasDosAgentes, type Agente } from "../../marcas/marcas"
import { cx } from "../../utils/cx"
import { ChipDeDor, type Fonte } from "../ChipDeFonte/ChipDeFonte"
import { LogoDoAgente } from "../LogoDoAgente/LogoDoAgente"
import { Painel } from "../Painel/Painel"
import "./Insight.css"

export type InsightProps = {
  /** A categoria ("Cotação e taxas"). */
  titulo: string
  /** Os números grandes do lado: parcela, tendência, recorrência. */
  numeros: { rotulo: string; valor: string }[]
  agente: Agente
  nomeDoAgente?: string
  /** A leitura do agente. */
  children: React.ReactNode
  /** O próximo passo sugerido, em negrito no começo. */
  proximoPasso?: string
  dores?: { fonte: Fonte; titulo: string }[]
  /** Botões do pé ("Resolver esta Dor", "Perguntar ao agente"). */
  acoes?: React.ReactNode
  /** A categoria em foco nos gráficos ganha `acento-suave`. */
  foco?: boolean
  className?: string
}

/** A leitura do agente sobre uma categoria de Dor. */
export function Insight({ titulo, numeros, agente, nomeDoAgente = marcasDosAgentes[agente].nome, children, proximoPasso, dores = [], acoes, foco = false, className }: InsightProps) {
  return (
    <article className={cx("dst-insight", foco && "dst-insight--foco", className)} aria-label={titulo}>
      <div className="dst-insight__lado">
        <h3>{titulo}</h3>
        <dl className="dst-insight__numeros">
          {numeros.map((n) => (
            <div key={n.rotulo}>
              <dt>{n.rotulo}</dt>
              <dd>{n.valor}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="dst-insight__corpo">
        <p className="dst-insight__autor">
          <LogoDoAgente agente={agente} tamanho="pequeno" />
          <span>{nomeDoAgente}</span>
        </p>
        <div className="dst-insight__texto">{children}</div>
        {proximoPasso && (
          <p className="dst-insight__passo">
            <b>Próximo passo:</b> {proximoPasso}
          </p>
        )}
        {dores.length > 0 && (
          <div className="dst-insight__dores">
            {dores.map((d) => (
              <ChipDeDor key={d.titulo} fonte={d.fonte} titulo={d.titulo} />
            ))}
          </div>
        )}
        {acoes && <div className="dst-insight__acoes">{acoes}</div>}
      </div>
    </article>
  )
}

export type PainelDeInsightsProps = {
  titulo?: string
  subtitulo?: string
  children: React.ReactNode
  className?: string
}

/** O painel inteiro com um `Insight` por categoria. */
export function PainelDeInsights({ titulo = "Insights por categoria", subtitulo, children, className }: PainelDeInsightsProps) {
  return (
    <Painel titulo={titulo} subtitulo={subtitulo} idDoTitulo="dst-insights-titulo" className={cx("dst-insights", className)}>
      <div className="dst-insights__lista">{children}</div>
    </Painel>
  )
}
