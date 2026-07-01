import { Button } from "@hive/design-system";

const stage = {
  background: "var(--bordo)",
  padding: "28px",
};

export const Primary = () => (
  <div style={stage}>
    <Button>Começar agora</Button>
  </div>
);

export const Ghost = () => (
  <div style={stage}>
    <Button variant="ghost">Ver documentação</Button>
  </div>
);

export const WithArrow = () => (
  <div style={stage}>
    <Button arrow href="/skills/harness-builder">
      Conhecer a skill
    </Button>
  </div>
);

export const NoCut = () => (
  <div style={stage}>
    <Button variant="ghost" cut={false}>
      Cancelar
    </Button>
  </div>
);

export const Group = () => (
  <div style={{ ...stage, display: "flex", gap: "14px", flexWrap: "wrap" }}>
    <Button arrow>Solicitar acesso</Button>
    <Button variant="ghost">Falar com vendas</Button>
  </div>
);
