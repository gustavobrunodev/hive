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
      '**/out',
      '**/coverage',
      '.claude', // vendored agent skills — not our source
      'build',
      'test-results',
      'playwright-report'
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
  eslintConfigPrettier
)
