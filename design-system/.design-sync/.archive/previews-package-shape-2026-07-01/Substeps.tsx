import { Steps, Step, Substeps, Sub } from "@hive/design-system";

export const Default = () => (
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

export const ThreeSubs = () => (
  <Steps style={{ maxWidth: 600 }}>
    <Step number={1} title="Executar" last skills={[{ label: "Chamadas de ferramenta" }]}>
      Aplica as mudanças no ambiente isolado, em três frentes paralelas.
      <Substeps>
        <Sub label="01" skill="Edição de código">
          Aplica o diff gerado pelo planejador nos arquivos afetados.
        </Sub>
        <Sub label="02" skill="Instalação de dependências">
          Resolve e instala pacotes novos exigidos pela mudança.
        </Sub>
        <Sub label="03" skill="Build local">
          Compila o projeto para garantir que não há erros de sintaxe.
        </Sub>
      </Substeps>
    </Step>
  </Steps>
);
