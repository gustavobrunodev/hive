import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { OptionPicker, type PickerGroup, type PickerOption } from "./OptionPicker"
import { Button } from "../Button/Button"
import { SegmentedControl } from "../SegmentedControl/SegmentedControl"

const meta: Meta<typeof OptionPicker> = {
  title: "Overlays/OptionPicker",
  component: OptionPicker,
  parameters: { layout: "centered" },
}

export default meta
type Story = StoryObj<typeof OptionPicker>

const MODELS: PickerOption[] = [
  {
    id: "",
    label: "Automático",
    description: "Usa o modelo configurado na CLI",
    hint: "opus",
    group: "default",
  },
  {
    id: "opus",
    label: "Opus",
    description: "O mais capaz para tarefas complexas do dia a dia",
    meta: "200k",
    tags: [{ label: "topo", tone: "accent" }],
    group: "recommended",
  },
  {
    id: "sonnet",
    label: "Sonnet",
    description: "Eficiente para tarefas de rotina — o padrão sensato",
    meta: "200k",
    group: "recommended",
  },
  {
    id: "haiku",
    label: "Haiku",
    description: "O mais rápido, para respostas curtas",
    meta: "200k",
    group: "recommended",
  },
  {
    id: "sonnet[1m]",
    label: "Sonnet 1M",
    description: "Janela de 1M para sessões longas em bases grandes",
    meta: "1M",
    tags: [{ label: "1M", tone: "success" }],
    group: "more",
  },
  {
    id: "opus41",
    label: "Opus 4.1",
    description: "Versão anterior, mantida para conversas fixadas nela",
    meta: "200k",
    group: "legacy",
  },
]

const GROUPS: PickerGroup[] = [
  { id: "default" },
  { id: "recommended", label: "Recomendados" },
  { id: "more", label: "Mais opções" },
  { id: "legacy", label: "Versões anteriores" },
]

const EFFORTS = [
  { id: "low", label: "Baixo" },
  { id: "medium", label: "Médio" },
  { id: "high", label: "Alto" },
  { id: "max", label: "Máx" },
]

export const Default: Story = {
  render: function Render() {
    const [model, setModel] = useState("sonnet")
    const label = MODELS.find((option) => option.id === model)?.label ?? "Modelo"
    return (
      <OptionPicker
        options={MODELS}
        groups={GROUPS}
        value={model}
        onChange={setModel}
        ariaLabel="Escolher modelo"
        searchPlaceholder="Buscar modelo…"
      >
        <Button variant="ghost">{label}</Button>
      </OptionPicker>
    )
  },
}

/** The composed case this component was built for: model above, effort below. */
export const WithFooterControl: Story = {
  render: function Render() {
    const [model, setModel] = useState("opus")
    const [effort, setEffort] = useState("high")
    const label = MODELS.find((option) => option.id === model)?.label ?? "Modelo"
    return (
      <OptionPicker
        options={MODELS}
        groups={GROUPS}
        value={model}
        onChange={setModel}
        ariaLabel="Escolher modelo"
        footer={
          <SegmentedControl
            options={EFFORTS}
            value={effort}
            onChange={setEffort}
            ariaLabel="Nível de esforço"
          />
        }
      >
        <Button variant="ghost">
          {label} · {EFFORTS.find((option) => option.id === effort)?.label}
        </Button>
      </OptionPicker>
    )
  },
}

/** Long lists get the filter field automatically. */
export const Searchable: Story = {
  render: function Render() {
    const [model, setModel] = useState("gpt-5")
    const many: PickerOption[] = [
      ...MODELS,
      { id: "gpt-5", label: "GPT-5", description: "OpenAI", group: "recommended" },
      { id: "gpt-5-mini", label: "GPT-5 mini", description: "OpenAI", group: "more" },
      { id: "gemini-3-pro", label: "Gemini 3 Pro", description: "Google", group: "more" },
    ]
    return (
      <OptionPicker
        options={many}
        groups={GROUPS}
        value={model}
        onChange={setModel}
        ariaLabel="Escolher modelo"
        searchPlaceholder="Buscar modelo…"
      >
        <Button variant="ghost">{many.find((o) => o.id === model)?.label}</Button>
      </OptionPicker>
    )
  },
}

/**
 * A picker with a **default**: the pinned row is the one a fresh visit lands
 * on, so it is hoisted into its own section and keeps its mark on screen.
 * Hover any row for its pin, or press Alt+P on the row under the cursor.
 */
export const Pinnable: Story = {
  render: function Render() {
    const [model, setModel] = useState("sonnet")
    const [pinned, setPinned] = useState<string | null>("opus")
    return (
      <OptionPicker
        options={MODELS}
        groups={GROUPS}
        value={model}
        onChange={setModel}
        pinnedId={pinned}
        onPinChange={setPinned}
        pinGroupLabel="Fixado"
        ariaLabel="Escolher modelo"
      >
        <Button variant="ghost">{MODELS.find((o) => o.id === model)?.label}</Button>
      </OptionPicker>
    )
  },
}
