import type { Meta, StoryObj } from "@storybook/react"
import { useState } from "react"

import { RampSelect } from "./RampSelect"

/**
 * **Usage**
 *
 * - **When to use**: a setting whose options form a **ladder** — reasoning
 *   effort, output quality, compression, retry aggressiveness. The cumulative
 *   fill is the whole point: it says where the scale goes, where you are on
 *   it, and how much of it you are asking for, without the user having to
 *   already know the vocabulary.
 * - **When not**: for options that are peers rather than rungs (a log-level
 *   *filter*, a chart range, a view switch) — that's `SegmentedControl`,
 *   which draws them equal because they are. For a continuous range, `Slider`.
 *   For a read-only signal, `LevelMeter`.
 * - **Do**: order `steps` from least to most; the array order *is* the scale.
 *   Keep each `label` to one word — a rung is ~48px wide — and put the cost or
 *   consequence in `description`, which the control renders under the ramp.
 * - **Don't**: fold "automatic" into `steps`. Pass it as `autoStep`: giving a
 *   delegated scale the shortest bar claims it is the *lowest* setting, which
 *   is a different and wrong statement. Choosing it empties the ramp instead.
 * - **A11y**: a `radiogroup` of `radio`s with the same contract as
 *   `SegmentedControl` — one tab stop, arrows move the selection, Home/End
 *   jump to the ends, disabled rungs are skipped. The description line is
 *   wired as the group's `aria-describedby`, so the consequence is announced
 *   with the choice.
 * - **Motion**: bars cross-fade their fill over 200ms (`--ease-quart`), and
 *   hold still under `prefers-reduced-motion`.
 * - **Tokens**: `--bg-2`/`--border` (track), `--surface`/`--shadow-1` (chosen
 *   rung), `--accent` (fill), `--ink`/`--muted` (labels and description),
 *   `--focus`.
 */
const meta = {
  title: "Components/RampSelect",
  component: RampSelect,
  parameters: { layout: "centered" },
} satisfies Meta<typeof RampSelect>

export default meta
type Story = StoryObj<typeof meta>

const EFFORT = [
  { id: "low", label: "Baixo", description: "Responde rápido, raciocina pouco" },
  { id: "medium", label: "Médio", description: "Equilíbrio entre rapidez e profundidade" },
  { id: "high", label: "Alto", description: "Raciocina mais antes de responder" },
  { id: "xhigh", label: "Extra", description: "Raciocínio extenso — turnos mais lentos" },
  { id: "max", label: "Máx", description: "O máximo de raciocínio; mais lento e mais caro" },
]

export const Default: Story = {
  args: { steps: EFFORT, value: "high", onChange: () => {}, ariaLabel: "Nível de esforço" },
  render: function Render(args) {
    const [value, setValue] = useState(args.value)
    return <div style={{ width: 380 }}><RampSelect {...args} value={value} onChange={setValue} /></div>
  },
}

/** The delegated scale: "let the tool decide" sits beside the ramp, not on it. */
export const WithAuto: Story = {
  args: {
    steps: EFFORT,
    value: "",
    onChange: () => {},
    ariaLabel: "Nível de esforço",
    autoStep: { id: "", label: "Auto", description: "Deixa a CLI decidir o esforço" },
  },
  render: function Render(args) {
    const [value, setValue] = useState(args.value)
    return <div style={{ width: 380 }}><RampSelect {...args} value={value} onChange={setValue} /></div>
  },
}

/** `md` for a settings page, where the control isn't sharing a popover. */
export const Medium: Story = {
  args: {
    steps: EFFORT,
    value: "medium",
    onChange: () => {},
    ariaLabel: "Nível de esforço",
    size: "md",
  },
  render: function Render(args) {
    const [value, setValue] = useState(args.value)
    return <div style={{ width: 460 }}><RampSelect {...args} value={value} onChange={setValue} /></div>
  },
}

/** A three-rung scale still climbs — the heights are derived from the count. */
export const ShortScale: Story = {
  args: {
    steps: [
      { id: "draft", label: "Rascunho", description: "Rápido e barato" },
      { id: "normal", label: "Normal", description: "O padrão" },
      { id: "fine", label: "Refinado", description: "Mais lento, melhor acabamento" },
    ],
    value: "normal",
    onChange: () => {},
    ariaLabel: "Qualidade",
  },
  render: function Render(args) {
    const [value, setValue] = useState(args.value)
    return <div style={{ width: 300 }}><RampSelect {...args} value={value} onChange={setValue} /></div>
  },
}
