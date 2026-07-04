import { DotsBackground } from "@hive/design-system";

export const HeroBackdrop = () => (
  <div
    style={{
      position: "relative",
      height: 280,
      background: "var(--bordo)",
      overflow: "hidden",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
      padding: 24,
    }}
  >
    <DotsBackground />
    <div style={{ position: "relative", zIndex: 1, maxWidth: 360 }}>
      <h2 style={{ color: "var(--ink)", marginBottom: 8 }}>Orquestre agentes em produção</h2>
      <p style={{ color: "var(--muted)", fontSize: "0.95rem" }}>
        Delegue tarefas, monitore execuções e valide cada deploy com confiança.
      </p>
    </div>
  </div>
);

export const SectionBand = () => (
  <div
    style={{
      position: "relative",
      height: 180,
      background: "var(--bordo)",
      overflow: "hidden",
      display: "flex",
      alignItems: "flex-end",
      padding: 20,
    }}
  >
    <DotsBackground />
    <span style={{ position: "relative", zIndex: 1, color: "var(--coral)", fontWeight: 600, fontSize: "0.85rem" }}>
      Skills · Deploys · Pipelines
    </span>
  </div>
);
