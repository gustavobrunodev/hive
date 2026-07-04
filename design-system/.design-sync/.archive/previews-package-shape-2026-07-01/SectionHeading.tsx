import { SectionHeading } from "@hive/design-system";

const stage = {
  background: "var(--bordo)",
  padding: "32px",
  maxWidth: 600,
};

export const Basic = () => (
  <div style={stage}>
    <SectionHeading>Como o Hive orquestra agentes</SectionHeading>
  </div>
);

export const WithEyebrowAndLead = () => (
  <div style={stage}>
    <SectionHeading
      eyebrow="Plataforma"
      lead="Cada skill é versionada, testada e implantada como um serviço independente — o agente só vê a interface."
    >
      Skills como unidade de trabalho
    </SectionHeading>
  </div>
);

export const WithId = () => (
  <div style={stage}>
    <SectionHeading
      id="seguranca"
      eyebrow="Confiança"
      lead="Toda ação destrutiva passa por um gate de aprovação humana antes de ser aplicada."
    >
      Segurança por padrão
    </SectionHeading>
  </div>
);
