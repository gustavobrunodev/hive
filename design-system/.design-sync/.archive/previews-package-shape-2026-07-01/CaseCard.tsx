import { CaseGrid, CaseCard } from "@hive/design-system";

export const Single = () => (
  <CaseGrid style={{ maxWidth: 360 }}>
    <CaseCard
      tag="Atendimento"
      title="Triagem de chamados"
      prompt="Classifique o chamado e sugira a equipe responsável."
      mode="Autônomo"
    >
      O agente lê o ticket, identifica a categoria e roteia para o time certo
      sem intervenção humana.
    </CaseCard>
  </CaseGrid>
);

export const Grid = () => (
  <CaseGrid
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(2, 1fr)",
      gap: "16px",
      maxWidth: 720,
    }}
  >
    <CaseCard
      tag="Engenharia"
      title="Revisão de PR"
      prompt="Aponte riscos de segurança antes do merge."
      mode="Supervisionado"
      index={0}
    >
      Comenta diretamente no pull request com achados e sugestões de fix.
    </CaseCard>
    <CaseCard
      tag="Dados"
      title="Resumo semanal"
      prompt="Gere o resumo de métricas toda segunda-feira."
      mode="Agendado"
      index={1}
    >
      Consulta o data warehouse e publica o relatório no canal do time.
    </CaseCard>
  </CaseGrid>
);
