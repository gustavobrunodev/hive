import { Stack, Table } from "@hive/design-system";

export const Standalone = () => (
  <div
    style={{
      display: "flex",
      gap: "16px",
      background: "var(--bordo)",
      padding: "16px",
    }}
  >
    <Stack>Node.js</Stack>
    <Stack>Python</Stack>
    <Stack>Go</Stack>
  </div>
);

export const InTableCell = () => (
  <Table style={{ maxWidth: 420 }}>
    <thead>
      <tr>
        <th>Agente</th>
        <th>Stack</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>triagem-agent</td>
        <td>
          <Stack>Node.js</Stack>
        </td>
      </tr>
    </tbody>
  </Table>
);
