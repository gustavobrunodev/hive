import type { Meta, StoryObj } from "@storybook/react"

import { Skeleton } from "./Skeleton"

const meta = {
  title: "Feedback/Skeleton",
  component: Skeleton,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: `
A content-loading placeholder block. Skeleton is deliberately shapeless —
there's no \`variant="circle" | "text"\` prop; consumers compose a shape by
setting \`width\`/\`height\`/\`style\`/\`className\` (a line, a circle avatar, a
card). This keeps it a single primitive instead of a fixed enum that would
lag behind whatever new layout a screen needs.

**When to use / when not:** use Skeleton when content will appear in place
once loaded, so holding its approximate size prevents layout shift. Use
**Spinner** instead for a small "something is happening" indicator that
isn't standing in for specific eventual content (a submit button's pending
state, a background refresh).

**Do's & Don'ts**
- Do size each Skeleton close to what will actually render there (a title-width line, an avatar-sized circle) — an unrelated shape reads as a glitch when the real content swaps in.
- Do compose several Skeletons to sketch a whole card/row rather than one big undifferentiated block, so the loading state previews the real layout.
- Don't rely on Skeleton alone to announce "loading" to assistive tech — it's intentionally \`aria-hidden\`/\`role="presentation"\` (several on screen at once would otherwise be redundant, noisy announcements). Pair it with a \`Spinner\` (\`role="status"\`) or a live region elsewhere on the loading surface if an announcement is needed.

**Accessibility:** decorative by design — \`role="presentation"\` +
\`aria-hidden="true"\` so screen readers skip it entirely. Honors
\`prefers-reduced-motion: reduce\` by swapping the shimmer sweep for a static
muted fill, both via a CSS media query and a matching JS-computed class (so
environments like tests that can't evaluate media queries against layout
still resolve correctly).

**Tokens:** \`--surface-2\` → \`--surface-3\` for the shimmer gradient (a static
\`--surface-2\` fill when reduced motion applies).
        `,
      },
    },
  },
  args: {
    style: { width: 200, height: 16 },
  },
} satisfies Meta<typeof Skeleton>

export default meta

type Story = StoryObj<typeof meta>

/** Default shape: a single text-line-width block. */
export const TextLine: Story = {
  args: { style: { width: 240, height: 14 } },
}

/** A circular avatar placeholder via inline `borderRadius`. */
export const Circle: Story = {
  args: { style: { width: 48, height: 48, borderRadius: "50%" } },
}

/** A larger rectangular block — a card/image placeholder. */
export const Rectangle: Story = {
  args: { style: { width: 320, height: 160, borderRadius: "var(--rounded-md)" } },
}

/** Several Skeletons composed into a typical card loading state. */
export const ComposedCard: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, width: 280 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Skeleton style={{ width: 40, height: 40, borderRadius: "50%" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
          <Skeleton style={{ width: "60%", height: 12 }} />
          <Skeleton style={{ width: "40%", height: 10 }} />
        </div>
      </div>
      <Skeleton style={{ width: "100%", height: 140, borderRadius: "var(--rounded-md)" }} />
      <Skeleton style={{ width: "90%", height: 12 }} />
      <Skeleton style={{ width: "75%", height: 12 }} />
    </div>
  ),
}
