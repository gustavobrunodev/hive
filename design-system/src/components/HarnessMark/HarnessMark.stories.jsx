/* Preview stories — mesmo padrão de window.__dsPreview usado pelos outros
   componentes (ver components/<group>/<Name>/<Name>.html no mirror). Cada
   export PascalCase vira uma célula na grade de variantes. */
import React from "react";
import { HarnessMark } from "./HarnessMark";

export function Simbolo() {
  return <HarnessMark variant="symbol" size={56} />;
}

export function Horizontal() {
  return <HarnessMark variant="horizontal" size={44} />;
}

export function Vertical() {
  return <HarnessMark variant="stacked" size={56} />;
}

export function Logotipo() {
  return <HarnessMark variant="wordmark" size={26} />;
}

export function IconeDeApp() {
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      <HarnessMark variant="icon" size={96} />
      <HarnessMark variant="icon" size={96} background="var(--bordo-sensatez)" />
      <HarnessMark variant="icon" size={96} background="var(--coral)" tone="mono" color="#260a12" />
    </div>
  );
}

export function Negativa() {
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      <span style={{ background: "var(--coral)", padding: 20, display: "inline-flex" }}>
        <HarnessMark variant="horizontal" size={40} tone="mono" color="#260a12" />
      </span>
      <span style={{ background: "var(--bordo-sensatez)", padding: 20, display: "inline-flex" }}>
        <HarnessMark variant="horizontal" size={40} tone="mono" color="#ded4d4" />
      </span>
    </div>
  );
}
