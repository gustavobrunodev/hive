import { ValueGrid, ValueCard } from "@hive/design-system";

export const TwoUp = () => (
  <ValueGrid
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(2, 1fr)",
      gap: "20px",
      maxWidth: 680,
    }}
  >
    <ValueCard kicker="01" title="Menos retrabalho" index={0}>
      O agente aprende com cada correção e não repete o mesmo erro duas
      vezes.
    </ValueCard>
    <ValueCard kicker="02" title="Visibilidade total" index={1}>
      Todo passo de raciocínio fica disponível para auditoria do time.
    </ValueCard>
  </ValueGrid>
);

export const ThreeUp = () => (
  <ValueGrid
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: "20px",
      maxWidth: 960,
    }}
  >
    <ValueCard kicker="01" title="Autonomia de verdade" index={0}>
      O agente decide, executa e reporta — sem depender de um humano para
      cada passo do fluxo.
    </ValueCard>
    <ValueCard kicker="02" title="Auditável por padrão" index={1}>
      Cada ação fica registrada: o que foi feito, por quê e com qual
      ferramenta.
    </ValueCard>
    <ValueCard kicker="03" title="Escala sem fricção" index={2}>
      Adicione novos agentes ao time sem reescrever processos ou treinar do
      zero.
    </ValueCard>
  </ValueGrid>
);
