import { Flow, SpineLabel, Steps, Step, Substeps, Sub } from "@hive/design-system";

export const AgentPipeline = () => (
  <Flow style={{ marginTop: 0, maxWidth: 640 }}>
    <SpineLabel>
      Pipeline <b>Planejar → Executar → Validar</b>
    </SpineLabel>
    <Steps>
      <Step
        number={1}
        title="Planejar"
        skills={[{ label: "Leitura de contexto" }, { label: "Decomposição de tarefas", he: true }]}
      >
        O agente analisa o pedido, consulta o histórico do repositório e quebra o
        trabalho em etapas executáveis.
      </Step>
      <Step
        number={2}
        title="Executar"
        skills={[{ label: "Edição de código" }, { label: "Chamadas de ferramenta" }]}
      >
        Aplica as mudanças, roda comandos no ambiente isolado e registra cada
        ação tomada para auditoria.
      </Step>
      <Step
        number={3}
        title="Validar"
        last
        skills={[{ label: "Testes", he: true }, { label: "Revisão" }]}
      >
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
  </Flow>
);

export const DeployPipeline = () => (
  <Flow style={{ marginTop: 0, maxWidth: 640 }}>
    <SpineLabel>
      Pipeline <b>Deploy assistido</b>
    </SpineLabel>
    <Steps>
      <Step number={1} title="Build" skills={[{ label: "CI" }]}>
        Compila os serviços alterados e publica os artefatos no registro interno.
      </Step>
      <Step number={2} title="Deploy" last highlight skills={[{ label: "Produção", he: true }]}>
        Promove a versão para produção com rollback automático em caso de falha.
      </Step>
    </Steps>
  </Flow>
);
