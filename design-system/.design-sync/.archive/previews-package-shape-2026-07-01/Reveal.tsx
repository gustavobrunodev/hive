import { Reveal } from "@hive/design-system";

export const Heading = () => (
  <div style={{ background: "var(--bordo)", padding: "28px" }}>
    <Reveal style={{ maxWidth: 480 }}>
      <h2 style={{ marginBottom: 8 }}>Delegue com confiança</h2>
      <p style={{ color: "var(--muted)" }}>
        Cada agente registra o que fez, por quê, e o que ainda precisa de revisão
        humana antes do deploy.
      </p>
    </Reveal>
  </div>
);

export const Callout = () => (
  <div style={{ background: "var(--bordo)", padding: "28px" }}>
    <Reveal as="section" style={{ maxWidth: 480 }}>
      <h3 style={{ marginBottom: 6 }}>Pronto para produção</h3>
      <p style={{ color: "var(--muted)", fontSize: "0.95rem" }}>
        Testes, checklist de segurança e aprovação ficam registrados na mesma
        timeline da execução.
      </p>
    </Reveal>
  </div>
);
