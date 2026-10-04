import React from "react"
import type { NomeDoIcone } from "../../icones/icones"
import { cx } from "../../utils/cx"
import { BotaoIcone } from "../Botao/Botao"
import { Icone } from "../Icone/Icone"
import { Segmentado } from "../Segmentado/Segmentado"
import { SeloExemplo } from "../SeloExemplo/SeloExemplo"
import { Marca } from "../Sinal/Sinal"
import "./Lateral.css"

export type ItemDaLateral = { id: string; rotulo: string; icone: NomeDoIcone; href?: string }
export type RecenteDaLateral = { id: string; titulo: string; subtitulo: string; icone: NomeDoIcone; href?: string }
export type Tema = "claro" | "escuro"

export type LateralProps = {
  /** Itens principais (Início, Protótipos, Dores, Relatórios). */
  itens: ItemDaLateral[]
  /** Id do item da página atual (`aria-current="page"`). */
  atual?: string
  aoNavegar?: (id: string) => void
  /** O botão de começar ("Nova conversa"). */
  novo?: { rotulo: string; href?: string; aoClicar?: () => void }
  recentes?: RecenteDaLateral[]
  /** Itens do rodapé (Configurações). */
  rodape?: ItemDaLateral[]
  tema?: Tema
  aoMudarTema?: (tema: Tema) => void
  conta?: { nome: string; papel: string; iniciais: string }
  /** Mostra o selo "Dados de exemplo". Padrão `true`. */
  exemplo?: boolean
  /** Só ícones, 68px. */
  recolhida?: boolean
  /** Mostra o botão de recolher/abrir. */
  aoRecolher?: () => void
  className?: string
}

function Item({ item, atual, aoNavegar, classe, recolhida }: { item: ItemDaLateral; atual?: string; aoNavegar?: (id: string) => void; classe: string; recolhida: boolean }) {
  const props = {
    className: classe,
    "aria-current": item.id === atual ? ("page" as const) : undefined,
    title: item.rotulo,
    onClick: aoNavegar ? () => aoNavegar(item.id) : undefined,
  }
  const conteudo = (
    <>
      <Icone nome={item.icone} />
      <span className={cx(recolhida && "dst-sr")}>{item.rotulo}</span>
    </>
  )
  return item.href ? (
    <a href={item.href} {...props}>
      {conteudo}
    </a>
  ) : (
    <button type="button" {...props}>
      {conteudo}
    </button>
  )
}

/** A barra lateral do app: marca, começar, navegação, Recentes, tema e conta. */
export function Lateral({
  itens,
  atual,
  aoNavegar,
  novo,
  recentes = [],
  rodape = [],
  tema,
  aoMudarTema,
  conta,
  exemplo = true,
  recolhida = false,
  aoRecolher,
  className,
}: LateralProps) {
  return (
    <aside className={cx("dst-lateral", recolhida && "dst-lateral--recolhida", className)} aria-label="Navegação">
      <div className="dst-lateral__topo">
        <Marca href="#" soSinal={recolhida} />
        {aoRecolher && (
          <BotaoIcone rotulo={recolhida ? "Abrir a barra lateral" : "Recolher a barra lateral"} icone="lateral" onClick={aoRecolher} />
        )}
      </div>
      {novo &&
        (novo.href ? (
          <a className="dst-lateral__novo" href={novo.href} onClick={novo.aoClicar} title={novo.rotulo}>
            <Icone nome="novo" />
            <span className={cx(recolhida && "dst-sr")}>{novo.rotulo}</span>
          </a>
        ) : (
          <button type="button" className="dst-lateral__novo" onClick={novo.aoClicar} title={novo.rotulo}>
            <Icone nome="novo" />
            <span className={cx(recolhida && "dst-sr")}>{novo.rotulo}</span>
          </button>
        ))}
      <nav className="dst-lateral__nav">
        {itens.map((item) => (
          <Item key={item.id} item={item} atual={atual} aoNavegar={aoNavegar} classe="dst-lateral__item" recolhida={recolhida} />
        ))}
      </nav>
      {recentes.length > 0 && !recolhida && (
        <div className="dst-lateral__secao">
          <p className="dst-lateral__rotulo">Recentes</p>
          <div className="dst-lateral__recentes">
            {recentes.map((r) => {
              const corpo = (
                <>
                  <span className="dst-lateral__rec-ic">
                    <Icone nome={r.icone} />
                  </span>
                  <span className="dst-lateral__rec-txt">
                    <b>{r.titulo}</b>
                    <small>{r.subtitulo}</small>
                  </span>
                </>
              )
              const props = { className: "dst-lateral__recente", "aria-current": r.id === atual ? ("page" as const) : undefined, onClick: aoNavegar ? () => aoNavegar(r.id) : undefined }
              return r.href ? (
                <a key={r.id} href={r.href} {...props}>
                  {corpo}
                </a>
              ) : (
                <button key={r.id} type="button" {...props}>
                  {corpo}
                </button>
              )
            })}
          </div>
        </div>
      )}
      <div className="dst-lateral__rodape">
        {tema && aoMudarTema && (
          <Segmentado
            forma="pill"
            rotulo="Tema"
            valor={tema}
            aoMudar={aoMudarTema}
            className="dst-lateral__tema"
            opcoes={[
              { valor: "claro", rotulo: "Tema claro", icone: "sol", soIcone: true },
              { valor: "escuro", rotulo: "Tema escuro", icone: "lua", soIcone: true },
            ]}
          />
        )}
        {rodape.map((item) => (
          <Item key={item.id} item={item} atual={atual} aoNavegar={aoNavegar} classe="dst-lateral__item" recolhida={recolhida} />
        ))}
        {conta && (
          <div className="dst-lateral__conta">
            <span className="dst-lateral__avatar" aria-hidden="true">
              {conta.iniciais}
            </span>
            <span className={cx("dst-lateral__rec-txt", recolhida && "dst-sr")}>
              <b>{conta.nome}</b>
              <small>{conta.papel}</small>
            </span>
          </div>
        )}
        {exemplo && <SeloExemplo forma="linha" className={cx(recolhida && "dst-lateral__exemplo--recolhido")} />}
      </div>
    </aside>
  )
}
