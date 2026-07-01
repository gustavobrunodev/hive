import { SkillSpinePin } from "@hive/design-system";

const stage: React.CSSProperties = {
  maxWidth: 320,
  background: "var(--bordo)",
  padding: "24px",
};

export const Default = () => (
  <div style={stage}>
    <SkillSpinePin drive={["L", "T", "B"]} delegate={["D", "A"]} />
  </div>
);

export const DriveOnly = () => (
  <div style={stage}>
    <SkillSpinePin drive={["T", "C", "R"]} delegate={[]} />
  </div>
);

export const CustomLabels = () => (
  <div style={stage}>
    <SkillSpinePin
      driveLabel="Executa"
      drive={["M", "A"]}
      delegateLabel="Escala para"
      delegate={["P"]}
    />
  </div>
);
