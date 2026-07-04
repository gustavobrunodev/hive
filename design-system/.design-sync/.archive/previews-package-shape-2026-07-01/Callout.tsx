import { Callout } from "@hive/design-system";

const stage = {
  background: "var(--bordo)",
  padding: "28px",
};

export const Gate = () => (
  <div style={{ ...stage, maxWidth: 420 }}>
    <Callout variant="gate" label="Gate">
      Requer aprovação humana antes de aplicar em produção.
    </Callout>
  </div>
);

export const Limits = () => (
  <div style={{ ...stage, maxWidth: 420 }}>
    <Callout variant="limits">
      O agente não tem acesso a credenciais de produção — toda escrita passa por um proxy auditado.
    </Callout>
  </div>
);

export const LimitsCustomIcon = () => (
  <div style={{ ...stage, maxWidth: 420 }}>
    <Callout variant="limits" icon="i">
      Limite de 50 chamadas de skill por execução para evitar loops de delegação.
    </Callout>
  </div>
);

export const Stacked = () => (
  <div style={{ ...stage, maxWidth: 420, display: "flex", flexDirection: "column", gap: "4px" }}>
    <Callout variant="gate" label="Gate · Deploy">
      Pipeline pausa em "deploy" até revisão do time de plataforma.
    </Callout>
    <Callout variant="limits">
      Rollback automático se a taxa de erro passar de 2% nos primeiros 5 minutos.
    </Callout>
  </div>
);
