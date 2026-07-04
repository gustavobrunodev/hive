import { ModeSplit, ModeBlock } from "@hive/design-system";

export const AutonomoVsSupervisionado = () => (
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

export const AgendadoVsSobDemanda = () => (
  <ModeSplit
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(2, 1fr)",
      gap: "20px",
      maxWidth: 760,
    }}
  >
    <ModeBlock
      label="Disparo"
      title="Agendado"
      items={["Roda em horário fixo", "Sem gatilho externo"]}
    >
      Executa sozinho seguindo um cron, ideal para relatórios e rotinas.
    </ModeBlock>
    <ModeBlock
      label="Disparo"
      title="Sob demanda"
      primary
      items={["Acionado por evento", "Resposta em segundos"]}
    >
      Reage a um webhook ou comando e entrega resultado em tempo real.
    </ModeBlock>
  </ModeSplit>
);
