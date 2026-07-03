import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    css: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/index.ts",
        "src/**/*.stories.tsx",
        "src/**/*.d.ts",
        "src/types/**",
      ],
      thresholds: { lines: 90, branches: 90, functions: 90, statements: 90 },
    },
  },
})
