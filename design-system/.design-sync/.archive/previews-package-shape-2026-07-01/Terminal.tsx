import { Terminal } from "@hive/design-system";

export const Running = () => (
  <Terminal
    title="agent — deploy.sh"
    command="hive deploy --env production"
    output="Build concluído. 3 serviços atualizados, 0 erros."
    phases={[
      { label: "plan", active: false },
      { label: "build", active: false },
      { label: "deploy", active: true },
    ]}
  />
);

export const NoOutput = () => (
  <Terminal
    title="agent — scaffold"
    command="hive new component Badge"
    phases={[{ label: "scaffold", active: true }]}
  />
);
