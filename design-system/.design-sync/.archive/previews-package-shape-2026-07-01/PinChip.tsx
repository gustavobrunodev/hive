import { PinChip } from "@hive/design-system";

const stage = {
  background: "var(--bordo)",
  padding: "28px",
};

export const Drive = () => (
  <div style={stage}>
    <PinChip variant="drive">D</PinChip>
  </div>
);

export const Delegate = () => (
  <div style={stage}>
    <PinChip variant="deleg">G</PinChip>
  </div>
);

export const SkillRow = () => (
  <div style={{ ...stage, display: "flex", gap: "10px", alignItems: "center" }}>
    <PinChip variant="drive">D</PinChip>
    <span style={{ color: "var(--ink)", fontSize: "0.9rem" }}>
      harness-builder — conduz o pipeline de build
    </span>
  </div>
);

export const Legend = () => (
  <div style={{ ...stage, display: "flex", flexDirection: "column", gap: "10px" }}>
    <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
      <PinChip variant="drive">D</PinChip>
      <span style={{ color: "var(--ink)", fontSize: "0.9rem" }}>Conduz — o agente é dono da skill</span>
    </div>
    <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
      <PinChip variant="deleg">G</PinChip>
      <span style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Delega — aciona outro agente especialista</span>
    </div>
  </div>
);
