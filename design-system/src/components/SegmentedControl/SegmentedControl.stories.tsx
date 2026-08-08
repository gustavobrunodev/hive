import type { Meta, StoryObj } from "@storybook/react"
import { useState } from "react"

import { SegmentedControl } from "./SegmentedControl"

/**
 * **Usage**
 *
 * - **When to use**: a small, mutually-exclusive set of *views over content
 *   already on screen* — a log level filter, a chart range, a list density.
 *   The optional `count` per option turns it into a tally bar, which is the
 *   reason to reach for this over a row of `Button`s.
 * - **When not**: to swap panels of different content — that's `Tabs`, which
 *   carries the tablist/tabpanel relationship this control deliberately
 *   doesn't. For more than ~5 options, or options whose labels grow, use a
 *   `Select`; the track scrolls badly once segments overflow.
 * - **Do**: keep labels to one or two words and pass `ariaLabel` describing
 *   what is being filtered ("Filtrar eventos por tipo"), since the group has
 *   no visible label of its own.
 * - **Don't**: use it for a binary on/off — that's `Switch`. And don't pass
 *   `count: 0` expecting the badge to disappear; `0` is a meaningful tally
 *   and renders. Omit `count` entirely for no badge.
 * - **A11y**: a `radiogroup` of `radio`s. One tab stop for the whole group
 *   (the selected segment), arrows move the selection, Home/End jump to the
 *   ends, and disabled segments are skipped by the keyboard.
 * - **Motion**: the indicator slides on `transform`/`width` over 220ms
 *   (`--ease-quart`) and holds still under `prefers-reduced-motion`.
 * - **Tokens**: `--bg-2`/`--border` (track), `--surface`/`--border-strong`/
 *   `--shadow-1` (indicator), `--ink`/`--muted` (labels), `--selected-bg`,
 *   `--success-bg`, `--warning-bg`, `--danger-bg` (count tones), `--focus`.
 */
const meta = {
  title: "Components/SegmentedControl",
  component: SegmentedControl,
  parameters: { layout: "centered" },
} satisfies Meta<typeof SegmentedControl>

export default meta
type Story = StoryObj<typeof meta>

/** The MCP console's own filter bar: a total plus three toned tallies. */
export const WithCounts: Story = {
  args: {
    ariaLabel: "Filtrar eventos por tipo",
    value: "all",
    options: [
      { id: "all", label: "Tudo", count: 128 },
      { id: "tools", label: "Ferramentas", count: 84, tone: "accent" },
      { id: "conn", label: "Conexão", count: 41, tone: "success" },
      { id: "errors", label: "Erros", count: 3, tone: "danger" },
    ],
    onChange: () => {},
  },
  render: function Render(args) {
    const [value, setValue] = useState(args.value)
    return <SegmentedControl {...args} value={value} onChange={setValue} />
  },
}

/** No badges, `md` size — the standalone view-switch shape. */
export const Plain: Story = {
  args: {
    ariaLabel: "Densidade da lista",
    value: "cozy",
    size: "md",
    options: [
      { id: "compact", label: "Compacta" },
      { id: "cozy", label: "Confortável" },
      { id: "spacious", label: "Espaçosa" },
    ],
    onChange: () => {},
  },
  render: function Render(args) {
    const [value, setValue] = useState(args.value)
    return <SegmentedControl {...args} value={value} onChange={setValue} />
  },
}

/** A disabled segment stays visible but is skipped by both pointer and keyboard. */
export const WithDisabled: Story = {
  args: {
    ariaLabel: "Escopo",
    value: "workspace",
    options: [
      { id: "workspace", label: "Este workspace" },
      { id: "all", label: "Todos", disabled: true },
    ],
    onChange: () => {},
  },
  render: function Render(args) {
    const [value, setValue] = useState(args.value)
    return <SegmentedControl {...args} value={value} onChange={setValue} />
  },
}
