import type { Meta, StoryObj } from "@storybook/react"

import { CommandLine } from "./CommandLine"

const meta = {
  title: "Data Display/CommandLine",
  component: CommandLine,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
One command line, shown as evidence: the exact string a process is spawned
with, in a sunken monospace strip with an optional copy control.

**When to use / when not**
- Use to back a claim the UI just made — "os comandos rodam no Git Bash",
  "instale com isto". It is a receipt the reader can check.
- Don't use it for illustrative or multi-line sample code; that is
  \`CodeBlock\`, which is the brand register's framed sample. This one is a
  single line sized for a settings panel.
- Don't use it to render a program's *output*. Output is a log, not a command.

**Do's & Don'ts**
- Do pass the command verbatim, quotes and all. A prettified preview that
  drifts from the real argv is worse than showing nothing.
- Do use \`prompt\` for the shell's own sigil (\`$\`, \`%\`, \`PS>\`, \`C:\\>\`) —
  it is unselectable, so a hand-copy never picks it up.
- Do keep \`overflow="wrap"\` in narrow panels; switch to \`"scroll"\` only in a
  wide surface where folding would hurt more than a scroller.
- Don't rely on the component for the clipboard: it calls \`onCopy\` and lets
  the host write. An Electron renderer can have \`navigator.clipboard\` denied,
  and a copy button that silently does nothing is a defect this repo has
  already paid for once.

**A11y**
- The sigil is \`aria-hidden\` — decoration that would otherwise be read aloud
  in front of every command.
- The copy control is a real \`<button>\` with a visible label that changes to
  the confirmation, so the result is announced rather than only animated.
- With \`overflow="scroll"\` the strip owns its horizontal scroll, so the page
  around it never scrolls sideways.
        `.trim()
      }
    }
  }
} satisfies Meta<typeof CommandLine>

export default meta
type Story = StoryObj<typeof meta>

const LONG = `C:\\Program Files\\Git\\bin\\bash.exe -c 'exec /c/Users/ana/AppData/Roaming/npm/claude -p …'`

export const Default: Story = {
  args: {
    command: "claude -p …",
    prompt: "$",
    style: { width: 340 }
  }
}

/** With a copy control. The host writes to the clipboard; the component only asks. */
export const Copyable: Story = {
  args: {
    command: LONG,
    prompt: "$",
    onCopy: () => {},
    style: { width: 340 }
  }
}

/** In a wide surface, one line inside its own scroller instead of folding. */
export const Scrolling: Story = {
  args: {
    command: LONG,
    prompt: "PS>",
    overflow: "scroll",
    style: { width: 420 }
  }
}
