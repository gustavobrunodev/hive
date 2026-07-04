import { Flow, SpineLabel, Steps, Step } from "@hive/design-system";

export const Default = () => (
  <Flow style={{ marginTop: 0, maxWidth: 600 }}>
    <SpineLabel>
      Pipeline <b>Planejar → Executar → Validar</b>
    </SpineLabel>
    <Steps>
      <Step number={1} title="Planejar" last skills={[{ label: "Decomposição de tarefas", he: true }]}>
        O agente quebra o pedido em etapas executáveis.
      </Step>
    </Steps>
  </Flow>
);

export const DeployLabel = () => (
  <Flow style={{ marginTop: 0, maxWidth: 600 }}>
    <SpineLabel>
      Fase atual: <b>Deploy assistido</b>
    </SpineLabel>
    <Steps>
      <Step number={2} title="Deploy" last highlight skills={[{ label: "Produção", he: true }]}>
        Promove a versão para produção com rollback automático.
      </Step>
    </Steps>
  </Flow>
);
