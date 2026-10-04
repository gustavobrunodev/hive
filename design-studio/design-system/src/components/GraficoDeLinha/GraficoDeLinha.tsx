import React, { useId, useRef, useState } from "react"
import { cx } from "../../utils/cx"
import { escalaBonita, passoDosRotulos } from "../../utils/escala"
import { formatarNumero, porcentagem } from "../../utils/numeros"
import { useLarguraDoConteiner } from "../../utils/useLarguraDoConteiner"
import { Botao } from "../Botao/Botao"
import { Painel } from "../Painel/Painel"
import "./GraficoDeLinha.css"

export type PontoDaSerie = {
  /** Início da semana ("1 jul"). */
  rotulo: string
  valor: number
  /** Total do Relatório na semana, para a participação na dica. */
  total?: number
}

export type GraficoDeLinhaProps = {
  serie: PontoDaSerie[]
  /** O nome da série em ênfase ("Cotação e taxas"). */
  nomeDaSerie: string
  titulo?: string
  subtitulo?: string
  /** O que o valor conta, no plural ("ligações"). */
  unidade?: string
  /** Largura do desenho em px; sem ela o gráfico mede o contêiner. */
  largura?: number
  className?: string
}

const ALTURA = 236
const M = { e: 52, d: 64, t: 12, b: 30 }

/** Recorrência semana a semana de uma série, com mira, dica, teclado e tabela gêmea. */
export function GraficoDeLinha({
  serie,
  nomeDaSerie,
  titulo = "Recorrência semana a semana",
  subtitulo,
  unidade = "ligações",
  largura,
  className,
}: GraficoDeLinhaProps) {
  const id = useId()
  const caixa = useRef<HTMLDivElement>(null)
  const [tabela, setTabela] = useState(false)
  const [sel, setSel] = useState<number | null>(null)
  const W = Math.max(280, useLarguraDoConteiner(caixa, largura))
  const n = serie.length
  const pw = W - M.e - M.d
  const ph = ALTURA - M.t - M.b
  const { passo, topo } = escalaBonita(Math.max(0, ...serie.map((p) => p.valor)))
  const X = (i: number) => M.e + (n <= 1 ? pw / 2 : (i / (n - 1)) * pw)
  const Y = (v: number) => M.t + ph - (v / topo) * ph
  const traco = serie.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(p.valor).toFixed(1)}`).join(" ")
  const area = n ? `${traco} L${X(n - 1).toFixed(1)} ${Y(0).toFixed(1)} L${X(0).toFixed(1)} ${Y(0).toFixed(1)} Z` : ""
  const ticks: number[] = []
  for (let v = 0; v <= topo + 0.001; v += passo) ticks.push(v)
  const passoX = passoDosRotulos(n, pw)
  const ultimo = serie[n - 1]
  const atual = sel === null ? null : serie[sel] ?? null

  const mostrar = (i: number) => setSel(Math.max(0, Math.min(n - 1, i)))
  const teclas = (e: React.KeyboardEvent) => {
    const base = sel ?? n - 1
    const destino = e.key === "ArrowRight" ? base + 1 : e.key === "ArrowLeft" ? base - 1 : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : null
    if (destino !== null) {
      e.preventDefault()
      mostrar(destino)
    } else if (e.key === "Escape") setSel(null)
  }
  const aoMover = (e: React.PointerEvent<HTMLDivElement>) => {
    const x = e.clientX - e.currentTarget.getBoundingClientRect().left
    if (!Number.isFinite(x) || n === 0) return
    mostrar(Math.round(((x - M.e) / pw) * (n - 1)))
  }
  const contexto = (p: PontoDaSerie) => (p.total ? `${porcentagem(p.valor, p.total)}% das ${formatarNumero(p.total)} ${unidade} do Relatório nesta semana` : null)
  const ctxAtual = atual ? contexto(atual) : null
  const leitura = atual ? [`Semana de ${atual.rotulo}: ${formatarNumero(atual.valor)} ${unidade}, ${nomeDaSerie}.`, ctxAtual && `${ctxAtual}.`].filter(Boolean).join(" ") : ""
  const dicaEsquerda = sel === null ? 0 : X(sel) + 14 + 220 > W ? X(sel) - 14 - 220 : X(sel) + 14

  return (
    <Painel
      como="figure"
      idDoTitulo={id}
      titulo={titulo}
      subtitulo={subtitulo ?? `${nomeDaSerie}, semana a semana.`}
      className={cx("dst-graf-linha", className)}
      acao={
        <Botao variante="terciario" tamanho="pequeno" icone={tabela ? "grafico" : "tabela"} onClick={() => setTabela((t) => !t)}>
          {tabela ? "Ver gráfico" : "Ver tabela"}
        </Botao>
      }
    >
      {tabela ? (
        <table className="dst-graf-tabela">
          <caption className="dst-sr">{titulo}</caption>
          <thead>
            <tr>
              <th scope="col">Semana de</th>
              <th scope="col" className="num">{nomeDaSerie}</th>
              <th scope="col" className="num">Todas as Dores</th>
              <th scope="col" className="num">Participação</th>
            </tr>
          </thead>
          <tbody>
            {serie.map((p) => (
              <tr key={p.rotulo}>
                <th scope="row">{p.rotulo}</th>
                <td className="num">{formatarNumero(p.valor)}</td>
                <td className="num">{p.total !== undefined ? formatarNumero(p.total) : "—"}</td>
                <td className="num">{p.total ? `${porcentagem(p.valor, p.total)}%` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div
          ref={caixa}
          className="dst-graf-linha__caixa"
          tabIndex={0}
          role="group"
          aria-label={`${nomeDaSerie}, ${n} semanas. Use as setas para ler semana a semana.`}
          onKeyDown={teclas}
          onFocus={() => sel === null && n > 0 && mostrar(n - 1)}
          onBlur={() => setSel(null)}
          onPointerMove={aoMover}
          onPointerLeave={() => setSel(null)}
        >
          <svg width={W} height={ALTURA} viewBox={`0 0 ${W} ${ALTURA}`} aria-hidden="true">
            {ticks.map((v) => (
              <g key={v}>
                <line className="dst-gl-grade" x1={M.e} x2={W - M.d} y1={Y(v)} y2={Y(v)} />
                <text className="dst-gl-tick" x={M.e - 8} y={Y(v) + 4} textAnchor="end">
                  {formatarNumero(v)}
                </text>
              </g>
            ))}
            <line className="dst-gl-eixo" x1={M.e} x2={W - M.d} y1={Y(0)} y2={Y(0)} />
            {serie.map((p, i) =>
              i % passoX === 0 ? (
                <text key={p.rotulo} className="dst-gl-tick" x={X(i)} y={ALTURA - 8} textAnchor="middle">
                  {p.rotulo}
                </text>
              ) : null
            )}
            {n > 0 && <path className="dst-gl-area" d={area} />}
            {n > 0 && <path className="dst-gl-linha" d={traco} />}
            {ultimo && (
              <>
                <circle className="dst-gl-ponto" cx={X(n - 1)} cy={Y(ultimo.valor)} r={4} />
                <text className="dst-gl-fim" x={X(n - 1) + 10} y={Y(ultimo.valor) + 4}>
                  {formatarNumero(ultimo.valor)}
                </text>
              </>
            )}
            {atual && sel !== null && (
              <>
                <line className="dst-gl-cruz" x1={X(sel)} x2={X(sel)} y1={M.t} y2={Y(0)} />
                <circle className="dst-gl-ponto" cx={X(sel)} cy={Y(atual.valor)} r={4} />
              </>
            )}
          </svg>
          {atual && (
            <div className="dst-graf-dica" style={{ left: Math.max(0, dicaEsquerda), top: M.t + 6 }} aria-hidden="true">
              <p className="dst-graf-dica__titulo">Semana de {atual.rotulo}</p>
              <p className="dst-graf-dica__linha">
                <i className="dst-graf-chave dst-graf-chave--linha" />
                <b>{formatarNumero(atual.valor)}</b>
                <span>{nomeDaSerie}</span>
              </p>
              {ctxAtual && <p className="dst-graf-dica__ctx">{ctxAtual}</p>}
            </div>
          )}
          <p className="dst-sr" aria-live="polite">
            {leitura}
          </p>
        </div>
      )}
    </Painel>
  )
}
