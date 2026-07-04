import { Table, Pkg, Stack, Cond } from "@hive/design-system";

export const AgentCapabilities = () => (
  <Table style={{ maxWidth: 640 }}>
    <thead>
      <tr>
        <th>Agente</th>
        <th>Stack</th>
        <th>Modo</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>
          <Pkg>triagem-agent</Pkg>
        </td>
        <td>
          <Stack>Node.js</Stack>
        </td>
        <td>Autônomo</td>
        <td>
          <Cond>Ativo</Cond>
        </td>
      </tr>
      <tr>
        <td>
          <Pkg>review-agent</Pkg>
        </td>
        <td>
          <Stack>Python</Stack>
        </td>
        <td>Supervisionado</td>
        <td>
          <Cond>Aguardando aprovação</Cond>
        </td>
      </tr>
      <tr>
        <td>
          <Pkg>deploy-agent</Pkg>
        </td>
        <td>
          <Stack>Go</Stack>
        </td>
        <td>Agendado</td>
        <td>
          <Cond>Pausado</Cond>
        </td>
      </tr>
    </tbody>
  </Table>
);

export const NoCutCorner = () => (
  <Table cut={false} style={{ maxWidth: 480 }}>
    <thead>
      <tr>
        <th>Pacote</th>
        <th>Versão</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>
          <Pkg>@hive/orchestrator</Pkg>
        </td>
        <td>2.4.0</td>
      </tr>
      <tr>
        <td>
          <Pkg>@hive/skills-runtime</Pkg>
        </td>
        <td>1.9.2</td>
      </tr>
    </tbody>
  </Table>
);
