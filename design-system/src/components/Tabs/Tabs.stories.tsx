import type { Meta, StoryObj } from "@storybook/react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "./Tabs"

const USAGE = `
**When to use / when not** — Tabs switch between mutually exclusive views of
equally-important content that share the same context (e.g. "Account" /
"Billing" / "Support" panels in one settings screen), where seeing every
sibling label at a glance helps orientation. Don't reach for Tabs as
app-level primary navigation (a top bar or sidebar router) — that's Nav /
Breadcrumb's job, not a scoped in-screen switcher's. Don't repurpose Tabs as
a numbered wizard either; SteppedList/Timeline own linear sequences.

**Do's & Don'ts**
- Do pick \`variant="segmented"\` for a small, self-contained control (inside
  a toolbar/Panel) and the default \`"underline"\` for a wider content-area
  switcher.
- Do keep \`disabled\` on triggers that are genuinely unavailable — Radix
  still renders them (as real \`disabled\` buttons), it just removes them
  from the roving-tabindex order and from click activation.
- Don't stuff more than ~5–6 triggers in one \`TabsList\`; if the row needs to
  wrap or scroll, the content isn't "one screen" anymore.
- Don't expect \`orientation="vertical"\` alone to lay the list out
  vertically — Radix only remaps arrow-key handling and \`aria-orientation\`;
  the flex-direction is still the consumer's CSS to write (see the Vertical
  story below), since Tabs.css ships no vertical layout by default.

**A11y** — Radix supplies \`role="tablist"/"tab"/"tabpanel"\`, wires
\`aria-controls\`/\`aria-labelledby\` between trigger and panel, and drives a
roving tabindex: only the active trigger sits in the natural Tab order.
ArrowLeft/ArrowRight (or ArrowUp/ArrowDown when \`orientation="vertical"\`)
move focus and, by default, also activate (\`activationMode="automatic"\`);
Home/End jump to the first/last enabled trigger; disabled triggers are
skipped entirely by arrow-key roving. Consumers are responsible for giving
\`TabsList\` an accessible name via \`aria-label\`/\`aria-labelledby\` when the
trigger labels alone don't supply enough page context.

**Relevant tokens** — \`--border\` (underline rule), \`--surface-2\`/
\`--surface\`/\`--shadow-1\` (segmented track + active pill), \`--muted\`/
\`--ink\`/\`--faint\` (label default/active/disabled), \`--accent\` (active
underline), \`--focus\` (focus ring), \`--rounded-full\`/\`--rounded-sm\`,
\`--ease-quart\`.
`

const meta = {
  title: "Navigation/Tabs",
  component: Tabs,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: { description: { component: USAGE } },
  },
} satisfies Meta<typeof Tabs>

export default meta

type Story = StoryObj<typeof meta>

export const Underline: Story = {
  render: () => (
    <Tabs defaultValue="account">
      <TabsList aria-label="Settings">
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="billing">Billing</TabsTrigger>
        <TabsTrigger value="support" disabled>
          Support
        </TabsTrigger>
      </TabsList>
      <TabsContent value="account">Manage your name, email, and password.</TabsContent>
      <TabsContent value="billing">View invoices and update your payment method.</TabsContent>
      <TabsContent value="support">Support panel content.</TabsContent>
    </Tabs>
  ),
}

export const Segmented: Story = {
  render: () => (
    <Tabs defaultValue="week">
      <TabsList aria-label="Report range" variant="segmented">
        <TabsTrigger value="day">Day</TabsTrigger>
        <TabsTrigger value="week">Week</TabsTrigger>
        <TabsTrigger value="month">Month</TabsTrigger>
      </TabsList>
      <TabsContent value="day">Showing today's data.</TabsContent>
      <TabsContent value="week">Showing this week's data.</TabsContent>
      <TabsContent value="month">Showing this month's data.</TabsContent>
    </Tabs>
  ),
}

/**
 * `orientation="vertical"` remaps Radix's keyboard handling to ArrowUp/
 * ArrowDown and sets `aria-orientation="vertical"`, but the vertical layout
 * itself (flex-direction, border side) is authored here on the story —
 * Tabs.css ships no vertical variant, by design, since the product register
 * hasn't needed one yet.
 */
export const Vertical: Story = {
  render: () => (
    <Tabs defaultValue="general" orientation="vertical" style={{ display: "flex", gap: "var(--s-5)" }}>
      <TabsList
        aria-label="Preferences"
        style={{
          flexDirection: "column",
          alignItems: "flex-start",
          borderBottom: "none",
          borderRight: "1px solid var(--border)",
          paddingRight: "var(--s-5)",
          gap: "var(--s-2)",
        }}
      >
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="notifications">Notifications</TabsTrigger>
        <TabsTrigger value="security">Security</TabsTrigger>
      </TabsList>
      <div>
        <TabsContent value="general">General preferences.</TabsContent>
        <TabsContent value="notifications">Notification preferences.</TabsContent>
        <TabsContent value="security">Security preferences.</TabsContent>
      </div>
    </Tabs>
  ),
}
