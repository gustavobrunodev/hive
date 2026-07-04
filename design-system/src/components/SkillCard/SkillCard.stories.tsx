import type { Meta, StoryObj } from "@storybook/react"

import { SkillCard, SkillGrid, SkillSpinePin } from "./SkillCard"

/**
 * **Usage**
 *
 * - **When to use**: a skill/responsibility card in a roster — an optional
 *   number, role label, title, and free-form content, optionally closing
 *   with a `SkillSpinePin` row showing who drives vs. delegates it.
 *   `SkillGrid` is the asymmetric 3-column grid meant to hold a collection
 *   (see its CSS: the `lead` card spans two rows for emphasis).
 * - **When not**: for a scenario/example rather than a skill, use
 *   `CaseGrid`/`CaseCard`; for a short value pitch, use
 *   `ValueGrid`/`ValueCard`.
 * - **Do**: mark exactly one card `lead` per grid — it spans both rows via
 *   CSS (`.hds-skill-lead`) and gets `Panel`'s accent border, so more than
 *   one breaks the intended asymmetric layout.
 * - **Do**: pass `index` for entrance-animation stagger inside a
 *   `SkillGrid`, same convention as `CaseCard`/`ValueCard`.
 * - **Don't**: nest `SkillSpinePin` expecting `SkillCard` to render it
 *   automatically — it's a standalone sibling component; compose it inside
 *   `children` yourself where a card needs the drive/delegate rows.
 * - **A11y**: `title` renders as `<h3>` — keep the grid under an `<h2>` or
 *   higher. In `SkillSpinePin`, the drive/delegate meaning lives in the
 *   `driveLabel`/`delegateLabel` text next to each `PinChip` row, not in the
 *   chips' styling alone.
 * - **Tokens**: `--accent` (role label), `--ink`/`--muted` (title/body),
 *   `--border-strong` (skill number), `--surface` (`Panel` background),
 *   `--border`/`--border-strong` (default vs. `accentBorder` on `lead`).
 */
const meta = {
  title: "Data Display/SkillCard",
  component: SkillCard,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    role: "Backend",
    title: "Modelagem de dados",
    number: "01",
    lead: false,
    children: "Desenha esquemas e migrações consistentes com o domínio.",
  },
  argTypes: {
    lead: { control: "boolean" },
    index: { control: "number" },
  },
} satisfies Meta<typeof SkillCard>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Lead: Story = {
  args: {
    lead: true,
    number: "00",
    role: "Liderança técnica",
    title: "Arquitetura do sistema",
    children: "Define as fronteiras entre módulos e garante consistência entre times.",
  },
}

export const WithoutNumber: Story = {
  name: "Without number badge",
  args: {
    number: undefined,
  },
}

export const WithSpinePin: Story = {
  name: "With SkillSpinePin",
  render: (args) => (
    <SkillCard {...args}>
      <p>Desenha esquemas e migrações consistentes com o domínio.</p>
      <SkillSpinePin drive={["Ana"]} delegate={["Bruno", "Caio"]} />
    </SkillCard>
  ),
}

export const SpinePinStandalone: Story = {
  name: "SkillSpinePin (standalone)",
  render: () => <SkillSpinePin drive={["Ana"]} delegate={["Bruno", "Caio"]} />,
}

export const SpinePinDriveOnly: Story = {
  name: "SkillSpinePin (drive only)",
  render: () => <SkillSpinePin drive={["Ana"]} delegate={[]} />,
}

export const Grid: Story = {
  name: "SkillGrid (collection)",
  render: () => (
    <SkillGrid>
      <SkillCard index={0} lead number="00" role="Liderança técnica" title="Arquitetura do sistema">
        <p>Define as fronteiras entre módulos e garante consistência entre times.</p>
        <SkillSpinePin drive={["Ana"]} delegate={["Bruno"]} />
      </SkillCard>
      <SkillCard index={1} number="01" role="Backend" title="Modelagem de dados">
        Desenha esquemas e migrações consistentes com o domínio.
      </SkillCard>
      <SkillCard index={2} number="02" role="Frontend" title="Componentização">
        Mantém a UI consistente com o design system.
      </SkillCard>
      <SkillCard index={3} number="03" role="QA" title="Cobertura de testes">
        Garante que os fluxos críticos tenham testes automatizados.
      </SkillCard>
    </SkillGrid>
  ),
}
