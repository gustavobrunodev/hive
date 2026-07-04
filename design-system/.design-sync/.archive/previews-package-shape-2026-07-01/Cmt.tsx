import { Cmt, CodeBlock } from "@hive/design-system";

export const Standalone = () => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      fontFamily: "monospace",
      background: "var(--bordo)",
      padding: "16px",
    }}
  >
    <Cmt># publica o agente em produção</Cmt>
    <Cmt>// tempo máximo de execução em ms</Cmt>
  </div>
);

export const InCodeBlock = () => (
  <CodeBlock copyText="hive deploy --env production">
    <Cmt># publica o agente de revisão em produção</Cmt>
    {"\n"}hive deploy --env production
  </CodeBlock>
);
