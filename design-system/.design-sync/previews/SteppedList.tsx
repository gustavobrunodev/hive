import { SteppedList, SteppedListItem } from "@hive/design-system";

export const DeploySequence = () => (
  <SteppedList style={{ maxWidth: 480 }}>
    <SteppedListItem
      title="Conectar repositório"
      description="Autorize o Hive a acessar o repositório que o agente vai operar."
    />
    <SteppedListItem
      title="Definir skills"
      description="Escolha quais skills o agente pode executar durante o deploy."
    />
    <SteppedListItem
      title="Configurar gatilho"
      description="Defina o evento que inicia a pipeline: push, PR ou agendamento."
    />
    <SteppedListItem
      title="Revisar permissões"
      description="Confirme o nível de autonomia: supervisionado ou autônomo."
    />
    <SteppedListItem
      title="Publicar agente"
      description="O agente entra em produção e passa a monitorar o repositório."
    />
  </SteppedList>
);

export const OnboardingChecklist = () => (
  <SteppedList style={{ maxWidth: 480 }}>
    <SteppedListItem
      title="Criar workspace"
      description="Cada equipe tem seu próprio workspace isolado de agentes."
    />
    <SteppedListItem
      title="Convidar colaboradores"
      description="Adicione os membros do time que vão revisar execuções."
    />
    <SteppedListItem
      title="Importar credenciais"
      description="Conecte os provedores de nuvem usados pelos agentes."
    />
  </SteppedList>
);
