import type { Meta, StoryObj } from "@storybook/react"

import { LevelMeter } from "./LevelMeter"

const meta = {
  title: "Feedback/LevelMeter",
  component: LevelMeter,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: `
A bar meter for a live signal — a microphone level, most obviously.

**Numbers in, bars out.** It takes an array of normalized 0–1 levels and knows
nothing about \`MediaStream\`, \`AnalyserNode\` or audio at all. The app owns the
signal; this owns the picture of it.

**When to use / when not:** use it wherever a user needs to know that a live
input is actually being heard — a recorder, a dictation transport, a call
preview. Do **not** use it for progress toward a known total: that is
**Progress**, and a bar meter there would imply a signal that varies when in
fact it only climbs.

**The flat state is the feature.** Pass levels that are all ~0 and the bars
collapse into one quiet rule, with \`data-signal="none"\` on the root. This is
not a fallback for missing data — it is the answer to the only question a meter
exists to answer. A timer counting up looks identical whether a microphone is
capturing a voice or is muted, so a meter that idles with decorative movement is
worse than no meter at all.

**Do's & Don'ts**

- **Do** give it a \`label\`. It renders \`role="meter"\`, and an unnamed meter is
  noise to a screen reader.
- **Do** feed it real samples, at whatever rate you have them; the bars move
  because the data moves, so there is no animation to tune.
- **Don't** synthesize levels to make it look busy while you wait for a device.
  That is exactly the lie the flat state exists to prevent.
        `.trim(),
      },
    },
  },
} satisfies Meta<typeof LevelMeter>

export default meta
type Story = StoryObj<typeof meta>

/** A voice mid-sentence: uneven, mostly filling the track. */
export const Live: Story = {
  args: {
    label: "Nível do microfone",
    levels: [0.2, 0.5, 0.8, 0.6, 0.9, 0.7, 0.4, 0.65, 0.85, 0.55, 0.3, 0.7],
  },
}

/** Nothing is being heard. The bars flatten and the root says `data-signal="none"`. */
export const NoSignal: Story = {
  args: {
    label: "Nível do microfone",
    levels: new Array<number>(12).fill(0),
  },
}

/** Just opened: history fills in from the right rather than from the left. */
export const JustStarted: Story = {
  args: {
    label: "Nível do microfone",
    levels: [0.4, 0.75],
  },
}

/** A narrower track, for a toolbar row. */
export const FewBars: Story = {
  args: {
    label: "Nível do microfone",
    bars: 8,
    levels: [0.3, 0.9, 0.5, 0.7, 0.2, 0.6, 0.8, 0.45],
  },
}
