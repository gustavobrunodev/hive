import { Steps, Step, Substeps, Sub } from "@hive/design-system";

export const Default = () => (
  <Steps style={{ maxWidth: 600 }}>
    <Step
      number={1}
      title="Planejar"
      skills={[{ label: "Leitura de contexto" }, { label: "Decomposição de tarefas", he: true }]}
      last
    >
      O agente analisa o pedido, consulta o histórico do repositório e quebra o
      trabalho em etapas executáveis.
    </Step>
  </Steps>
);

export const Highlighted = () => (
  <Steps style={{ maxWidth: 600 }}>
    <Step
      number={2}
      title="Deploy em produção"
      highlight
      skills={[{ label: "Produção", he: true }, { label: "Rollback automático" }]}
      last
    >
      Promove a versão para produção com rollback automático em caso de falha.
    </Step>
  </Steps>
);

export const WithSubsteps = () => (
  <Steps style={{ maxWidth: 600 }}>
    <Step number={3} title="Validar" last skills={[{ label: "Testes", he: true }]}>
      Roda a suíte de testes e revisa o diff antes de abrir o pull request.
      <Substeps>
        <Sub label="01" skill="Testes automatizados">
          Executa unitários e de integração no ambiente de staging.
        </Sub>
        <Sub label="02" skill="Checklist de segurança">
          Verifica segredos expostos e permissões excessivas no diff.
        </Sub>
      </Substeps>
    </Step>
  </Steps>
);
