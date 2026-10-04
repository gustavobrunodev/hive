import React from "react"

/* Peças de layout só das histórias (não exportadas pela lib). */

export function Fileira({ children, coluna = false, gap = 14 }: { children: React.ReactNode; coluna?: boolean; gap?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: coluna ? "column" : "row", flexWrap: "wrap", gap, alignItems: coluna ? "flex-start" : "center" }}>
      {children}
    </div>
  )
}

export function Rotulo({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--tinta-3)" }}>{children}</span>
}

export function Caixa({ children, largura, fundo }: { children: React.ReactNode; largura?: number; fundo?: string }) {
  return <div style={{ maxWidth: largura, background: fundo ? `var(--${fundo})` : undefined, padding: fundo ? 16 : undefined, borderRadius: fundo ? 18 : undefined }}>{children}</div>
}
