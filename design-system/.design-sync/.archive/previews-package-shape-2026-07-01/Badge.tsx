import { Badge } from "@hive/design-system";

export const Accent = () => <Badge variant="accent">Novo</Badge>;

export const Muted = () => <Badge variant="muted">Arquivado</Badge>;

export const Variants = () => (
  <div style={{ display: "flex", gap: "12px" }}>
    <Badge variant="accent">Em produção</Badge>
    <Badge variant="muted">Rascunho</Badge>
  </div>
);
