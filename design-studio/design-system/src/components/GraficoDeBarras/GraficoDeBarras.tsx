import React, { useId, useState } from "react"
import { cx } from "../../utils/cx"
import { formatarNumero, porcentagem } from "../../utils/numeros"
import { Botao } from "../Botao/Botao"
import { Painel } from "../Painel/Painel"
import "./GraficoDeBarras.css"

export type CategoriaDoGrafico = { id: string; nome: string; volume: number; dores?: number }

export type GraficoDeBarrasProps = {
  categorias: CategoriaDoGrafico[]
  /** A categoria em ênfase (laranja); as outras ficam em cinza de contexto. */
  emFoco?: string
  /** Volume de uma Dor filtrada dentro da categoria em foco: a barra se parte. */
  recorte?: { volume: number; rotulo: string }
  /** Torna cada linha um botão que troca a ênfase. */
  aoFocar?: (id: string) => void
  titulo?: string
  subtitulo?: string
  /** O que o volume conta, no cabeçalho da tabela ("Ligações", "Menções"). */
  unidade?: string
  className?: string
}

/** Volume por categoria de Dor, em forma de ênfase, com tabela gêmea. */
export function GraficoDeBarras({
  categorias,
  emFoco,
  recorte,
  aoFocar,
  titulo = "Dores por categoria",
  subtitulo = "Ligações no período. Toque numa categoria para destacá-la.",
  unidade = "Ligações",
  className,
}: GraficoDeBarrasProps) {
  const id = useId()
  const [tabela, setTabela] = useState(false)
  const soma = categorias.reduce((s, c) => s + c.volume, 0)
  const maximo = Math.max(1, ...categorias.map((c) => c.volume))
  const largura = (v: number) => `${((v / maximo) * 74).toFixed(2)}%`
  return (
    <Painel
      como="figure"
      idDoTitulo={id}
      titulo={titulo}
      subtitulo={subtitulo}
      className={cx("dst-graf-barras", className)}
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
              <th scope="col">Categoria</th>
              <th scope="col" className="num">{unidade}</th>
              <th scope="col" className="num">Participação</th>
              <th scope="col" className="num">Dores</th>
            </tr>
          </thead>
          <tbody>
            {categorias.map((c) => (
              <tr key={c.id}>
                <th scope="row">{c.nome}</th>
                <td className="num">{formatarNumero(c.volume)}</td>
                <td className="num">{porcentagem(c.volume, soma)}%</td>
                <td className="num">{c.dores ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <>
          <div className="dst-graf-barras__linhas">
            {categorias.map((c) => {
              const enfase = c.id === emFoco
              const partido = enfase && recorte && recorte.volume < c.volume
              const valor = `${formatarNumero(c.volume)} · ${porcentagem(c.volume, soma)}%`
              const conteudo = (
                <>
                  <span className="dst-graf-barras__rotulo">{c.nome}</span>
                  <span className="dst-graf-barras__trilho">
                    {partido ? (
                      <>
                        <span className="dst-graf-barras__barra dst-graf-barras__barra--parte" style={{ width: largura(recorte.volume) }} />
                        <span className="dst-graf-barras__barra dst-graf-barras__barra--resto" style={{ width: largura(c.volume - recorte.volume) }} />
                      </>
                    ) : (
                      <span className="dst-graf-barras__barra" style={{ width: largura(c.volume) }} />
                    )}
                    <span className="dst-graf-barras__valor">{valor}</span>
                  </span>
                </>
              )
              const classe = cx("dst-graf-barras__linha", enfase && "dst-graf-barras__linha--enfase")
              return aoFocar ? (
                <button key={c.id} type="button" className={classe} aria-pressed={enfase} onClick={() => aoFocar(c.id)}>
                  {conteudo}
                </button>
              ) : (
                <div key={c.id} className={classe}>
                  {conteudo}
                </div>
              )
            })}
          </div>
          {recorte && (
            <ul className="dst-graf-legenda">
              <li>
                <i className="dst-graf-chave dst-graf-chave--enfase" aria-hidden="true" />
                {recorte.rotulo}
              </li>
              <li>
                <i className="dst-graf-chave dst-graf-chave--lavada" aria-hidden="true" />
                Resto da categoria
              </li>
            </ul>
          )}
        </>
      )}
    </Painel>
  )
}
