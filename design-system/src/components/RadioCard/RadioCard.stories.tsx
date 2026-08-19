import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react"

import { RadioCard } from "./RadioCard"
import { RadioGroup } from "../RadioGroup/RadioGroup"
import { Badge } from "../Badge/Badge"
import { CommandLine } from "../CommandLine/CommandLine"

const meta = {
  title: "Forms/RadioCard",
  component: RadioCard,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
A selectable option rendered as a row: leading visual, name, optional badge,
one line of supporting evidence, and a detail region that opens under the row
once the option is chosen.

**When to use / when not**
- Use when the choice is *consequential* and each option needs more than a
  label to decide — a path, a version, a caveat, a preview. That extra line is
  the whole reason this exists instead of a bare \`RadioGroupItem\`.
- Don't use it for a short list of self-explanatory values ("Pequeno / Médio /
  Grande"). A plain \`RadioGroup\` is lighter and reads faster.
- Don't nest a \`RadioCard\` inside another card. If the detail region is
  growing its own sections, the choice wants a page, not a row.

**Do's & Don'ts**
- Do keep \`meta\` to one fact. It is evidence, not a description.
- Do put the consequence of the choice in \`children\` — it appears only while
  the option is selected, which is exactly when it is worth reading.
- Do set \`metaMono\` for paths, ids and command lines, so they read as machine
  text and wrap instead of truncating (the tail is the half that disambiguates).
- Don't put the primary action of the surface inside the detail region; it
  disappears the moment another option is picked.

**A11y**
- The card must live inside a \`RadioGroup\`: that is what supplies
  \`role="radiogroup"\`, the roving tabindex and arrow-key selection.
- The radio takes its accessible name from \`title\` via \`aria-labelledby\`.
  Radix renders \`role="radio"\` on a \`<button>\`, and the wrapping \`<label>\`
  names nothing on its own — pass \`aria-label\` only when \`title\` is not
  plain readable text.
- \`leading\` is \`aria-hidden\`: it is recognition, never information.
- The focus ring is drawn on the card (\`:focus-within\`), so keyboard users
  track the row they are on rather than a 20px circle inside it.
        `.trim()
      }
    }
  }
} satisfies Meta<typeof RadioCard>

export default meta
type Story = StoryObj<typeof meta>

const SHELLS = [
  { id: "git-bash", name: "Git Bash", path: "C:\\Program Files\\Git\\bin\\bash.exe", sigil: "$" },
  {
    id: "powershell",
    name: "Windows PowerShell",
    path: "C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
    sigil: ">"
  },
  { id: "cmd", name: "Prompt de Comando", path: "C:\\WINDOWS\\system32\\cmd.exe", sigil: "C:\\" }
]

function Sigil({ children }: { children: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 26,
        height: 26,
        borderRadius: "var(--rounded-md)",
        border: "1px solid var(--border)",
        background: "var(--surface-2)",
        color: "var(--muted)",
        font: "600 10px/1 var(--ff-mono)"
      }}
    >
      {children}
    </span>
  )
}

function Picker({ withDetail }: { withDetail?: boolean }) {
  const [value, setValue] = useState("git-bash")
  return (
    <RadioGroup
      aria-label="Terminal do agente"
      value={value}
      onValueChange={setValue}
      style={{ width: 340, gap: "var(--s-2)" }}
    >
      {SHELLS.map((shell) => (
        <RadioCard
          key={shell.id}
          value={shell.id}
          title={shell.name}
          meta={shell.path}
          metaMono
          leading={<Sigil>{shell.sigil}</Sigil>}
          badge={shell.id === "git-bash" ? <Badge>Em uso</Badge> : undefined}
          selected={value === shell.id}
        >
          {withDetail && (
            <CommandLine
              command={`${shell.name} · claude -p …`}
              prompt={shell.sigil}
              overflow="wrap"
            />
          )}
        </RadioCard>
      ))}
    </RadioGroup>
  )
}

/** The everyday shape: a name, the evidence behind it, and a badge on the live one. */
export const Default: Story = {
  args: { value: "git-bash", title: "Git Bash" },
  render: () => <Picker />
}

/** With a detail region — visible only under the selected card. */
export const WithDetail: Story = {
  args: { value: "git-bash", title: "Git Bash" },
  render: () => <Picker withDetail />
}

/** A disabled option stays readable: it is still information about the machine. */
export const Disabled: Story = {
  args: { value: "fish", title: "Fish" },
  render: () => (
    <RadioGroup aria-label="Terminal" value="zsh" style={{ width: 340, gap: "var(--s-2)" }}>
      <RadioCard value="zsh" title="Zsh" meta="/bin/zsh" metaMono selected />
      <RadioCard value="fish" title="Fish" meta="Não encontrado nesta máquina" disabled />
    </RadioGroup>
  )
}
