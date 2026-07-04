import type { Meta, StoryObj } from "@storybook/react"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./Accordion"

const USAGE = `
**When to use / when not** — Accordion progressively discloses a vertical
stack of sections that share a common context (FAQ entries, settings
groups) where a user typically only needs one or two open at a time. Don't
use it for content that should always be visible (that's just a heading +
body) and don't use it for switching between mutually-exclusive *views* of
the same content — that's \`Tabs\`.

**Do's & Don'ts**
- Do always pass an explicit \`type="single"\` or \`type="multiple"\` — Radix
  has no implicit default, so this DS leaves it required rather than
  silently picking one for you. \`"single"\` is right for FAQ-style content
  where one open answer at a time reduces scroll; \`"multiple"\` is right for
  independent settings sections a user may want open side-by-side.
- Do pair \`type="single"\` with \`collapsible\` when the open item should be
  closable back to "all closed" — without it, a single-type accordion always
  keeps exactly one item open once one has been opened.
- Don't nest interactive controls that also respond to Space/Enter directly
  inside \`AccordionTrigger\`'s children — the whole header is the trigger
  button, so a nested button creates an invalid \`<button>\`-in-\`<button>\` and
  competing keyboard handlers.
- Don't put critical content only inside a closed section for SEO/first-paint
  purposes — Radix unmounts closed content from the DOM entirely (not just
  \`hidden\`), so it's genuinely absent until opened.

**A11y** — Radix wires \`AccordionTrigger\` with a roving tabindex across
triggers (ArrowUp/ArrowDown/Home/End move focus between headers, matching
the WAI-ARIA Accordion pattern), \`aria-expanded\` reflecting open state, and
\`aria-controls\`/\`aria-labelledby\` linking each trigger to its content panel.
\`disabled\` items are skipped by both arrow-key roving and Tab. The height
animation respects \`prefers-reduced-motion\`, collapsing to a near-instant
show/hide instead of an animated height.

**Relevant tokens** — \`--border\` (item dividers), \`--ink\`/\`--accent\` (trigger
default/hover text + chevron), \`--muted\` (content body), \`--faint\` (disabled
trigger + chevron), \`--focus\` (focus ring), \`--ease-quart\`/\`--ease-expo\`
(open/close easing).
`

const meta = {
  title: "Navigation/Accordion",
  component: Accordion,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: { description: { component: USAGE } },
  },
  args: {
    type: "single",
  },
} satisfies Meta<typeof Accordion>

export default meta

type Story = StoryObj<typeof meta>

export const SingleCollapsible: Story = {
  name: "Single (collapsible)",
  render: () => (
    <Accordion type="single" collapsible defaultValue="item-1" style={{ maxWidth: 480 }}>
      <AccordionItem value="item-1">
        <AccordionTrigger>What is Harness Design System?</AccordionTrigger>
        <AccordionContent>
          A component library covering brand, forms, overlays, feedback,
          navigation, layout, data display, and AI-chat surfaces, all
          themeable via a single <code>data-theme</code> attribute.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-2">
        <AccordionTrigger>Can I have more than one section open?</AccordionTrigger>
        <AccordionContent>
          Not with <code>type=&quot;single&quot;</code> — opening a section always
          closes the previously open one. Use <code>type=&quot;multiple&quot;</code>{" "}
          for independent sections.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-3">
        <AccordionTrigger disabled>Billing (unavailable on this plan)</AccordionTrigger>
        <AccordionContent>Upgrade to unlock billing settings.</AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
}

export const Multiple: Story = {
  render: () => (
    <Accordion type="multiple" defaultValue={["profile"]} style={{ maxWidth: 480 }}>
      <AccordionItem value="profile">
        <AccordionTrigger>Profile</AccordionTrigger>
        <AccordionContent>Name, email, and avatar settings.</AccordionContent>
      </AccordionItem>
      <AccordionItem value="notifications">
        <AccordionTrigger>Notifications</AccordionTrigger>
        <AccordionContent>Choose which emails and alerts you receive.</AccordionContent>
      </AccordionItem>
      <AccordionItem value="security">
        <AccordionTrigger>Security</AccordionTrigger>
        <AccordionContent>Two-factor auth and active sessions.</AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
}

/** `type="single"` without `collapsible` — once a section is opened, one
 * section always stays open; clicking its own trigger again cannot close it
 * back to "all closed". */
export const SingleNonCollapsible: Story = {
  name: "Single (non-collapsible)",
  render: () => (
    <Accordion type="single" defaultValue="a" style={{ maxWidth: 480 }}>
      <AccordionItem value="a">
        <AccordionTrigger>Section A</AccordionTrigger>
        <AccordionContent>Always at least one of these is open.</AccordionContent>
      </AccordionItem>
      <AccordionItem value="b">
        <AccordionTrigger>Section B</AccordionTrigger>
        <AccordionContent>Clicking this closes A and opens B — but clicking B again while it's already open won't close it.</AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
}
