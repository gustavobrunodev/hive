import { CodeBlock, Cor, Cmt } from "@hive/design-system";

export const DeployCommand = () => (
  <CodeBlock copyText="hive deploy --env production --skill review-agent">
    <Cmt># publica o agente de revisão em produção</Cmt>
    {"\n"}
    hive deploy <Cor>--env production</Cor> --skill review-agent
  </CodeBlock>
);

export const ConfigSnippet = () => (
  <CodeBlock copyText={`{\n  "skill": "triagem-agent",\n  "mode": "autonomous",\n  "timeout": 30000\n}`}>
    {"{"}
    {"\n  "}"skill": <Cor>"triagem-agent"</Cor>,{"\n  "}"mode":{" "}
    <Cor>"autonomous"</Cor>,{"\n  "}
    <Cmt>// tempo máximo de execução em ms</Cmt>
    {"\n  "}"timeout": <Cor>30000</Cor>
    {"\n}"}
  </CodeBlock>
);

export const MultiStepInstall = () => (
  <CodeBlock copyText="npm install @hive/design-system && hive init">
    <Cmt># instala a lib e inicializa o projeto</Cmt>
    {"\n"}npm install <Cor>@hive/design-system</Cor>
    {"\n"}hive init
  </CodeBlock>
);
