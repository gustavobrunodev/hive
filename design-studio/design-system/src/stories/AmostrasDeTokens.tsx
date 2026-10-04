import React from "react"
import { cores, espacos, estilosDeTexto, familias, raios, sombras } from "../tokens/tokens"

/* Peças das páginas de Fundamentos (só Storybook). */

export function Cores() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
      {cores.map((c) => (
        <div key={c.nome} style={{ display: "grid", gap: 6, fontSize: 13 }}>
          <div style={{ display: "flex", height: 44, borderRadius: 10, overflow: "hidden", border: "1px solid var(--borda)" }}>
            <span title={`claro ${c.claro}`} style={{ flex: 1, background: c.claro }} />
            <span title={`escuro ${c.escuro ?? c.claro}`} style={{ flex: 1, background: c.escuro ?? c.claro }} />
          </div>
          <code style={{ fontWeight: 600 }}>--{c.nome}</code>
          <span style={{ color: "var(--tinta-3)", fontVariantNumeric: "tabular-nums" }}>
            {c.claro} · {c.escuro ?? "igual"}
          </span>
          <span style={{ color: "var(--tinta-2)" }}>{c.uso}</span>
        </div>
      ))}
    </div>
  )
}

export function Medidas() {
  const linha = (nome: string, valor: string, uso: string, amostra: React.ReactNode) => (
    <tr key={nome}>
      <td style={{ padding: "6px 10px" }}><code>--{nome}</code></td>
      <td style={{ padding: "6px 10px", fontVariantNumeric: "tabular-nums" }}>{valor}</td>
      <td style={{ padding: "6px 10px" }}>{amostra}</td>
      <td style={{ padding: "6px 10px", color: "var(--tinta-2)" }}>{uso}</td>
    </tr>
  )
  return (
    <table style={{ borderCollapse: "collapse", fontSize: 13, width: "100%" }}>
      <tbody>
        {raios.map((r) => linha(r.nome, r.valor, r.uso, <span style={{ display: "inline-block", width: 40, height: 28, background: "var(--acento-suave)", border: "1px solid var(--acento-tinta)", borderRadius: r.valor }} />))}
        {espacos.map((e) => linha(e.nome, e.valor, e.uso, <span style={{ display: "inline-block", width: e.valor, height: 12, background: "var(--graf-contexto)" }} />))}
        {sombras.map((s) => linha(s.nome, "claro/escuro", s.uso, <span style={{ display: "inline-block", width: 40, height: 28, borderRadius: 8, background: "var(--superficie)", boxShadow: `var(--${s.nome})` }} />))}
      </tbody>
    </table>
  )
}

export function Tipos() {
  return (
    <div style={{ display: "grid", gap: 18 }}>
      {estilosDeTexto.map((t) => (
        <div key={t.nome} style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 12, color: "var(--tinta-3)", fontWeight: 600 }}>
            {t.nome} · {t.tamanho}/{t.alturaDeLinha} · {t.peso} · {t.familia === "titulo" ? "Bricolage Grotesque" : "Geist"}
          </span>
          <span style={{ fontFamily: familias[t.familia], fontSize: t.tamanho, lineHeight: t.alturaDeLinha, fontWeight: t.peso, letterSpacing: t.espacamento, fontVariationSettings: t.tamanhoOptico ? `'opsz' ${t.tamanhoOptico}` : undefined }}>
            {t.amostra}
          </span>
          <span style={{ fontSize: 13, color: "var(--tinta-2)" }}>{t.uso}</span>
        </div>
      ))}
    </div>
  )
}
