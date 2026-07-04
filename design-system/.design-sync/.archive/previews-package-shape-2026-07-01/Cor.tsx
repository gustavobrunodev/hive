import { Cor, CodeBlock } from "@hive/design-system";

export const Standalone = () => (
  <div
    style={{
      display: "flex",
      gap: "16px",
      fontFamily: "monospace",
      background: "var(--bordo)",
      padding: "16px",
    }}
  >
    <Cor>--env production</Cor>
    <Cor>"autonomous"</Cor>
  </div>
);

export const InCodeBlock = () => (
  <CodeBlock copyText="hive deploy --env production">
    hive deploy <Cor>--env production</Cor>
  </CodeBlock>
);
