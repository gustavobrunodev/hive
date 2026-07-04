import React, { useEffect } from "react"
import type { Decorator, Preview } from "@storybook/react"

import "../src/base.css"

// Loads tokens.css (Layer 1 primitives + Layer 2 semantic roles under
// `:root[data-theme="light"|"dark"]`) + the reset + fonts. See design.md
// "Tech Decisions" — the DS's fonts already ship @font-face rules reachable
// through this import chain, so no separate preview-head.html is needed.

type ThemeGlobal = "light" | "dark"

/**
 * Sets `data-theme` on the iframe's own `<html>` (document.documentElement),
 * never a wrapper `<div>`. Token roles are declared as `:root[data-theme="…"]`,
 * so a wrapper div would never match the selector and components would fall
 * back to unstyled/undefined custom properties. Setting it on the real root
 * also themes Radix portals, which mount to the iframe's `<body>`, not to
 * wherever the story tree is rendered.
 */
const withTheme: Decorator = (Story, context) => {
  const theme = (context.globals.theme as ThemeGlobal | undefined) ?? "dark"

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme)
  }, [theme])

  return React.createElement(Story)
}

const preview: Preview = {
  decorators: [withTheme],
  globalTypes: {
    theme: {
      name: "Theme",
      description: "Hive Design System theme (data-theme)",
      defaultValue: "dark",
      toolbar: {
        icon: "mirror",
        items: [
          { value: "dark", title: "Dark (native)" },
          { value: "light", title: "Light" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: "dark",
  },
  parameters: {
    backgrounds: {
      // Disabled: base.css already sets `body { background: var(--bg) }`,
      // and --bg is a themed role that flips with data-theme via withTheme
      // above. Storybook's own background switcher would just add a second,
      // competing background mechanism on top of the one the DS already has.
      disable: true,
    },
    a11y: {
      test: "todo",
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    options: {
      // Foundations pages first, then the 9 component groups in the fixed
      // order design.md defines (Brand → Forms → Overlays → Feedback →
      // Navigation → Layout → Data Display → AI Chat → Utilities).
      storySort: {
        order: [
          "Introduction",
          "Foundations",
          ["Tokens", "Theming"],
          "Accessibility",
          "Brand",
          "Forms",
          "Overlays",
          "Feedback",
          "Navigation",
          "Layout",
          "Data Display",
          "AI Chat",
          "Utilities",
        ],
      },
    },
  },
}

export default preview
