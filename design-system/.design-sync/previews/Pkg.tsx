import { Pkg, Table } from "@hive/design-system";

export const Standalone = () => (
  <div
    style={{
      display: "flex",
      gap: "16px",
      background: "var(--bordo)",
      padding: "16px",
    }}
  >
    <Pkg>triagem-agent</Pkg>
    <Pkg>review-agent</Pkg>
    <Pkg>@hive/skills-runtime</Pkg>
  </div>
);

export const InTableCell = () => (
  <Table style={{ maxWidth: 420 }}>
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
    </tbody>
  </Table>
);
