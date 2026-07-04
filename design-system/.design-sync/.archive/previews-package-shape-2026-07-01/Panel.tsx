import { Panel } from "@hive/design-system";

export const Basic = () => (
  <Panel style={{ maxWidth: 360, padding: "22px 24px" }}>
    <h3 style={{ margin: 0, fontFamily: "var(--ff-display)", color: "var(--ink)" }}>Pipeline de deploy</h3>
    <p style={{ marginTop: "10px", color: "var(--muted)", fontSize: "0.92rem" }}>
      Três etapas — plan, build e deploy — executadas em sequência pelo agente, com checkpoint manual antes de
      produção.
    </p>
  </Panel>
);

export const AccentLift = () => (
  <Panel
    hover="lift"
    accentBorder
    style={{ maxWidth: 360, padding: "22px 24px" }}
  >
    <h3 style={{ margin: 0, fontFamily: "var(--ff-display)", color: "var(--ink)" }}>Skill em destaque</h3>
    <p style={{ marginTop: "10px", color: "var(--muted)", fontSize: "0.92rem" }}>
      Painel interativo — eleva ao passar o mouse e usa borda com tom coral para indicar recomendação.
    </p>
  </Panel>
);

export const AsArticle = () => (
  <Panel as="article" cut={false} style={{ maxWidth: 360, padding: "20px 22px" }}>
    <span style={{ color: "var(--coral)", fontSize: "0.8rem", fontWeight: 600 }}>Changelog · v2.4</span>
    <p style={{ marginTop: "8px", color: "var(--ink)", fontSize: "0.92rem" }}>
      Sem corte diagonal — usado quando o painel está dentro de uma lista densa de itens.
    </p>
  </Panel>
);
