import type { StorybookConfig } from "@storybook/react-vite"

// Scoped to real CSF3 stories + MDX docs only. `.design-sync/**` uses a
// different custom preview format (`window.__dsPreview`, plain PascalCase
// exports, no `.stories.` in the filename) and is never matched by this
// glob. Any file renamed to `*.preview.tsx` (see HarnessMark) is likewise
// excluded automatically since it doesn't match `*.stories.@(ts|tsx)`.
const config: StorybookConfig = {
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-a11y", "@storybook/addon-docs"],
}

export default config
