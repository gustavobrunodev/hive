import { Nav } from "@hive/design-system";

export const Default = () => (
  <Nav
    brand="Hive"
    brandHref="#top"
    links={[
      { href: "#produto", label: "Produto" },
      { href: "#skills", label: "Skills" },
      { href: "#casos", label: "Casos de uso" },
      { href: "#precos", label: "Preços" },
    ]}
    cta={{ href: "#start", label: "Começar" }}
  />
);

export const SemCta = () => (
  <Nav
    brand="Hive"
    brandHref="#top"
    links={[
      { href: "#docs", label: "Documentação" },
      { href: "#status", label: "Status" },
    ]}
  />
);
