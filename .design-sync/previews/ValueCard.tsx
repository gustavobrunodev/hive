import { ValueGrid, ValueCard } from "@hive/design-system";

export const Single = () => (
  <ValueGrid style={{ maxWidth: 360 }}>
    <ValueCard kicker="01" title="Autonomia de verdade" index={0}>
      O agente decide, executa e reporta — sem depender de um humano para
      cada passo do fluxo.
    </ValueCard>
  </ValueGrid>
);

export const Grid = () => (
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

export const FourUp = () => (
  <ValueGrid
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: "18px",
      maxWidth: 1180,
    }}
  >
    <ValueCard kicker="Velocidade" title="Deploy em minutos" index={0}>
      Da ideia ao agente em produção sem esperar fila de engenharia.
    </ValueCard>
    <ValueCard kicker="Controle" title="Limites claros" index={1}>
      Você define o que cada agente pode e não pode fazer.
    </ValueCard>
    <ValueCard kicker="Confiança" title="Revisão contínua" index={2}>
      Métricas e logs acompanham cada execução em tempo real.
    </ValueCard>
    <ValueCard kicker="Custo" title="Paga pelo uso" index={3}>
      Sem licenças fixas — você escala o gasto junto com o time.
    </ValueCard>
  </ValueGrid>
);
