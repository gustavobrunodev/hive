import { Chip } from "@hive/design-system";

const stage = {
  background: "var(--bordo)",
  padding: "28px",
};

export const Tag = () => (
  <div style={stage}>
    <Chip variant="tag">
      Agent skill · <b>harness-builder</b>
    </Chip>
  </div>
);

export const PhaseSteps = () => (
  <div style={{ ...stage, display: "flex", gap: "8px", flexWrap: "wrap" }}>
    <Chip variant="phase" active>
      0 · Orientar
    </Chip>
    <Chip variant="phase">1 · Planejar</Chip>
    <Chip variant="phase">2 · Executar</Chip>
    <Chip variant="phase">3 · Validar</Chip>
  </div>
);

export const AgentList = () => (
  <div style={{ ...stage, display: "flex", gap: "8px", flexWrap: "wrap" }}>
    <Chip variant="agent">Cursor</Chip>
    <Chip variant="agent">Claude Code</Chip>
    <Chip variant="agent">Windsurf</Chip>
  </div>
);

export const SkillTags = () => (
  <div style={{ ...stage, display: "flex", gap: "8px", flexWrap: "wrap" }}>
    <Chip variant="skill">harness-engineer</Chip>
    <Chip variant="skill" tone="he">
      revisão-humana
    </Chip>
  </div>
);
