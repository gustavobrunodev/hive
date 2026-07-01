import { SteppedList, SteppedListItem } from "@hive/design-system";

export const SingleStep = () => (
  <SteppedList style={{ maxWidth: 480 }}>
    <SteppedListItem
      title="Configurar gatilho"
      description="Defina o evento que inicia a pipeline: push, PR ou agendamento."
    />
  </SteppedList>
);

export const WithExtraContent = () => (
  <SteppedList style={{ maxWidth: 480 }}>
    <SteppedListItem
      title="Revisar permissões"
      description="Confirme o nível de autonomia antes de publicar o agente."
    >
      <span style={{ fontSize: "0.85rem", color: "var(--coral)" }}>
        Requer aprovação de um administrador.
      </span>
    </SteppedListItem>
  </SteppedList>
);
