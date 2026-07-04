import { Stagger } from "@hive/design-system";

export const SkillList = () => (
  <Stagger style={{ maxWidth: 480, display: "grid", gap: 12 }}>
    <div style={{ background: "var(--surface)", border: "1px solid var(--line)", padding: "12px 16px" }}>
      <strong style={{ color: "var(--ink)" }}>Planejar</strong>
      <p style={{ color: "var(--muted)", fontSize: "0.88rem", margin: "4px 0 0" }}>
        Decompõe o pedido em etapas executáveis.
      </p>
    </div>
    <div style={{ background: "var(--surface)", border: "1px solid var(--line)", padding: "12px 16px" }}>
      <strong style={{ color: "var(--ink)" }}>Executar</strong>
      <p style={{ color: "var(--muted)", fontSize: "0.88rem", margin: "4px 0 0" }}>
        Aplica mudanças e registra cada ação tomada.
      </p>
    </div>
    <div style={{ background: "var(--surface)", border: "1px solid var(--line)", padding: "12px 16px" }}>
      <strong style={{ color: "var(--ink)" }}>Validar</strong>
      <p style={{ color: "var(--muted)", fontSize: "0.88rem", margin: "4px 0 0" }}>
        Roda testes e checklist de segurança antes do merge.
      </p>
    </div>
  </Stagger>
);

export const MetricRow = () => (
  <Stagger style={{ maxWidth: 480, display: "flex", gap: 16 }}>
    <div style={{ textAlign: "center" }}>
      <div style={{ fontFamily: "var(--ff-num)", fontSize: "1.6rem", color: "var(--coral)" }}>128</div>
      <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>agentes ativos</div>
    </div>
    <div style={{ textAlign: "center" }}>
      <div style={{ fontFamily: "var(--ff-num)", fontSize: "1.6rem", color: "var(--coral)" }}>97%</div>
      <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>deploys validados</div>
    </div>
    <div style={{ textAlign: "center" }}>
      <div style={{ fontFamily: "var(--ff-num)", fontSize: "1.6rem", color: "var(--coral)" }}>4min</div>
      <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>tempo médio</div>
    </div>
  </Stagger>
);
