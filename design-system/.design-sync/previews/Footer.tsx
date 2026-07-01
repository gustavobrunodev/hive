import { Footer } from "@hive/design-system";

export const Default = () => (
  <Footer
    brand="Hive"
    tagline="Orquestre agentes de código e operação em um único painel, do deploy ao pipeline."
    bottomItems={[
      "© 2026 Hive",
      <a href="#privacidade">Privacidade</a>,
      <a href="#termos">Termos</a>,
    ]}
  />
);

export const SemBottomItems = () => (
  <Footer
    brand="Hive"
    tagline="Skills, deploys e delegação de tarefas — tudo em um só lugar."
  />
);
