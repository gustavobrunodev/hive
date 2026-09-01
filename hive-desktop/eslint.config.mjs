import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintPluginReact from 'eslint-plugin-react'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'

export default defineConfig(
  {
    ignores: [
      '**/node_modules',
      '**/dist',
      '**/dist-npm', // scratch release-assembly dir (scripts/release.mjs, T16) — generated, not our source
      '**/out',
      '**/coverage',
      '.claude', // vendored agent skills — not our source
      '.scratch', // local scratch experiments — not our source
      'build',
      // design-studio T2.2: the committed Design System bundle. Vendor output
      // flattened by esbuild, in the same category as `out/` — an artifact the
      // app serves, not app source (and 778 KB of minified code that linting
      // has nothing useful to say about).
      'resources/design-system-web-awesome/**',
      // design-studio T3.4: the bundled in-frame Preview receiver. Same
      // category — esbuild output the app serves, not app source.
      'resources/design-studio-preview/**',
      'test-results',
      'playwright-report',
      // Visual-pass harness (docs/visual-validation.md): these are bare
      // function *expressions* handed to the Playwright MCP tool, not modules —
      // the app's TS/ESM rules don't apply to them.
      'tools/visual/**',
      // voice-prompt: the dictation capture worklet. A shipped static asset
      // (copied same-origin by the renderer's publicDir, loaded by URL through
      // `audioWorklet.addModule` — never imported), running on the audio render
      // thread against `AudioWorkletGlobalScope`, not the app's TS/DOM globals.
      // Same category as `out/`: an artifact the app serves, not app source.
      'src/renderer/public/**',
      '**/__fixtures__/**' // test fixtures (e.g. the MCP probe's fake stdio server)
    ]
  },
  tseslint.configs.recommended,
  eslintPluginReact.configs.flat.recommended,
  eslintPluginReact.configs.flat['jsx-runtime'],
  {
    settings: {
      react: {
        version: 'detect'
      }
    }
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': eslintPluginReactHooks,
      'react-refresh': eslintPluginReactRefresh
    },
    rules: {
      ...eslintPluginReactHooks.configs.recommended.rules,
      ...eslintPluginReactRefresh.configs.vite.rules
    }
  },
  {
    // AI-sprawl sensors: catch the failure modes agents are prone to that the
    // recommended presets don't. `any` and tangled logic are hard errors (the
    // codebase is clean on both today); function length is a non-blocking
    // warning (a sprawl beacon — keep functions focused). Tests are exempt.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['**/*.test.*', '**/*.d.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      complexity: ['error', 15],
      'max-lines-per-function': [
        'warn',
        { max: 150, skipBlankLines: true, skipComments: true, IIFEs: true }
      ]
    }
  },
  {
    // scripts/release.mjs (T16) is plain Node tooling, not TypeScript — the
    // top-level `*.mjs` override in eslint-config-ts's eslint-typescript.js
    // only matches root-level files (e.g. electron.vite.config.mjs), not
    // nested ones, so this repeats it for the scripts/ directory.
    //
    // `tools/spikes/**` is the same category: throwaway measurement scripts
    // (the ones the whisper worker's own header cites for its numbers), written
    // in plain JS where a return-type annotation is not even syntax.
    files: ['scripts/**/*.mjs', 'tools/spikes/**/*.mjs'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off'
    }
  },
  eslintConfigPrettier
)
