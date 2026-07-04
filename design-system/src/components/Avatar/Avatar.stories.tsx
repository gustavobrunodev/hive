import type { Meta, StoryObj } from "@storybook/react"

import { Avatar } from "./Avatar"

/**
 * **Usage**
 *
 * - **When to use**: any user/agent representation — chat message avatars,
 *   mention chips, a profile header. It's a generic DS primitive, not
 *   chat-specific, despite chat being its main current consumer.
 * - **When not**: for a decorative icon with no identity behind it, use a
 *   plain icon instead of `Avatar`'s image/fallback machinery.
 * - **Do**: always pass `fallback` — it's the only required prop, since
 *   `src` can be omitted, fail to load, or still be loading.
 * - **Do**: pick `size` from the named scale (`sm` dense rows, `md`
 *   default, `lg` profile headers) rather than a raw number unless you
 *   have a genuinely one-off pixel size.
 * - **Don't**: pass `status` unless you have a real, live presence signal
 *   — an always-`"online"` dot that never changes is misleading.
 * - **A11y**: the presence dot is `role="img"` with an `aria-label`
 *   matching its state (e.g. "Away") — don't duplicate that text visually
 *   right next to it unless it adds information. Always pass `alt` when
 *   `src` is set; Radix's `Avatar.Image` swaps to `fallback` automatically
 *   on load failure, so `fallback` content (usually initials) should make
 *   sense on its own.
 * - **Tokens**: `--surface`/`--surface-2` (root/fallback bg),
 *   `--surface-colored` (status dot ring), `--success`/`--faint`/
 *   `--warning`/`--danger` (status dot per state), `--rounded-full`,
 *   `--muted`, `--ff-body`.
 */
const meta = {
  title: "Data Display/Avatar",
  component: Avatar,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  args: {
    fallback: "AB",
    size: "md",
  },
  argTypes: {
    size: {
      control: "radio",
      options: ["sm", "md", "lg"],
    },
    status: {
      control: "radio",
      options: [undefined, "online", "offline", "away", "busy"],
    },
    delayMs: { control: "number" },
  },
} satisfies Meta<typeof Avatar>

export default meta

type Story = StoryObj<typeof meta>

export const WithImage: Story = {
  args: {
    src: "https://i.pravatar.cc/128?img=12",
    alt: "Foto de perfil de Ana",
    fallback: "AN",
  },
}

export const FallbackInitials: Story = {
  name: "Fallback (initials)",
  args: {
    fallback: "BR",
    delayMs: 0,
  },
}

export const BrokenImageFallsBack: Story = {
  name: "Broken image → fallback",
  args: {
    src: "https://broken.invalid/does-not-exist.png",
    alt: "Imagem indisponível",
    fallback: "BR",
    delayMs: 0,
  },
}

export const Sizes: Story = {
  render: () => (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <Avatar size="sm" fallback="SM" />
      <Avatar size="md" fallback="MD" />
      <Avatar size="lg" fallback="LG" />
    </div>
  ),
}

export const StatusStates: Story = {
  name: "Status",
  render: () => (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <Avatar fallback="ON" status="online" />
      <Avatar fallback="OF" status="offline" />
      <Avatar fallback="AW" status="away" />
      <Avatar fallback="BS" status="busy" />
    </div>
  ),
}
