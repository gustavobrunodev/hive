import { SkillGrid, SkillCard } from "@hive/design-system";

export const ThreeSkills = () => (
  <SkillGrid
    style={{
      display: "grid",
      gridTemplateColumns: "1.5fr 1fr 1fr",
      gridTemplateRows: "auto auto",
      gap: "18px",
      maxWidth: 920,
    }}
  >
    <SkillCard role="Operações" title="Orquestração de deploys" lead number={1} index={0}>
      <p>
        Coordena pipelines de múltiplos serviços, valida health checks e
        aciona rollback automático quando algo foge do esperado.
      </p>
    </SkillCard>
    <SkillCard role="Engenharia" title="Revisão de PR" number={2} index={1}>
      <p>Comenta riscos de segurança e sugere fixes direto no pull request.</p>
    </SkillCard>
    <SkillCard role="Dados" title="Resumo de métricas" number={3} index={2}>
      <p>Consulta o data warehouse e publica relatórios semanais no canal.</p>
    </SkillCard>
  </SkillGrid>
);

export const FullRoster = () => (
  <SkillGrid
    style={{
      display: "grid",
      gridTemplateColumns: "1.5fr 1fr 1fr",
      gridTemplateRows: "auto auto",
      gap: "18px",
      maxWidth: 920,
    }}
  >
    <SkillCard role="Operações" title="Orquestração de deploys" lead number={1} index={0}>
      <p>
        Coordena pipelines de múltiplos serviços, valida health checks e
        aciona rollback automático quando algo foge do esperado.
      </p>
    </SkillCard>
    <SkillCard role="Engenharia" title="Revisão de PR" number={2} index={1}>
      <p>Comenta riscos de segurança e sugere fixes direto no pull request.</p>
    </SkillCard>
    <SkillCard role="Dados" title="Resumo de métricas" number={3} index={2}>
      <p>Consulta o data warehouse e publica relatórios semanais no canal.</p>
    </SkillCard>
    <SkillCard role="Atendimento" title="Triagem de chamados" number={4} index={3}>
      <p>Classifica tickets e roteia para a equipe responsável.</p>
    </SkillCard>
    <SkillCard role="Segurança" title="Resposta a incidentes" number={5} index={4}>
      <p>Identifica anomalias de tráfego e isola o serviço afetado.</p>
    </SkillCard>
  </SkillGrid>
);
