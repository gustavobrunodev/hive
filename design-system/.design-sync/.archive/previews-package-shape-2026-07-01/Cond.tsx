import { Cond, Table } from "@hive/design-system";

export const Standalone = () => (
  <div
    style={{
      display: "flex",
      gap: "16px",
      background: "var(--bordo)",
      padding: "16px",
    }}
  >
    <Cond>Ativo</Cond>
    <Cond>Aguardando aprovação</Cond>
    <Cond>Pausado</Cond>
  </div>
);

export const InTableCell = () => (
  <Table style={{ maxWidth: 420 }}>
    <thead>
      <tr>
        <th>Agente</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>deploy-agent</td>
        <td>
          <Cond>Pausado</Cond>
        </td>
      </tr>
    </tbody>
  </Table>
);
