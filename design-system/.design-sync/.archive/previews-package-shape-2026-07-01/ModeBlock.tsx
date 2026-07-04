import { ModeSplit, ModeBlock } from "@hive/design-system";

export const Standalone = () => (
  <div style={{ maxWidth: 380 }}>
    <ModeBlock
      label="Modo"
      title="Autônomo"
      primary
      items={["Decide sem aprovação", "Executa e reporta", "Rollback automático"]}
    >
      O agente toma a decisão final e age sozinho dentro dos limites
      configurados.
    </ModeBlock>
  </div>
);

export const NoItems = () => (
  <div style={{ maxWidth: 380 }}>
    <ModeBlock label="Modo" title="Manual">
      Toda ação passa por aprovação explícita de um operador humano antes de
      ser executada.
    </ModeBlock>
  </div>
);

export const Pair = () => (
  <ModeSplit
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(2, 1fr)",
      gap: "20px",
      maxWidth: 760,
    }}
  >
    <ModeBlock
      label="Modo"
      title="Autônomo"
      primary
      items={["Decide sem aprovação", "Executa e reporta", "Rollback automático"]}
    >
      O agente toma a decisão final e age sozinho dentro dos limites
      configurados.
    </ModeBlock>
    <ModeBlock
      label="Modo"
      title="Supervisionado"
      items={["Sugere a ação", "Aguarda aprovação", "Registra a decisão humana"]}
    >
      O agente prepara o plano, mas só executa depois do aceite de um
      revisor.
    </ModeBlock>
  </ModeSplit>
);
