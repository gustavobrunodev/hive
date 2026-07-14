import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {},
  preload: {
    // `sandbox: true` (src/main/index.ts) runs the preload script in a
    // restricted context that can't resolve third-party node_modules at
    // runtime — only `electron`/Node builtins (kept external by electron-
    // vite's own preload preset) work unbundled. Without this, `@electron-
    // toolkit/preload` is left as a runtime `require()` (electron-vite's
    // default `build.externalizeDeps: true`) that fails to resolve, so
    // `window.hive` never gets exposed and every renderer screen crashes.
    build: {
      externalizeDeps: false
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      },
      // `@hive/design-system` is a `file:../design-system` link that ships its
      // own `node_modules/react`(-dom). Its bundle keeps react/react-dom
      // external, so Vite resolves those imports relative to the linked
      // package — a *different physical copy* than the app's own react. Two
      // React instances in one renderer = "invalid hook call" (a DS
      // component's `useState` runs against a React that never rendered the
      // tree), crashing before the work UI ever mounts. `dedupe` forces every
      // react/react-dom import to resolve to the app's single copy.
      dedupe: ['react', 'react-dom']
    },
    plugins: [react()]
  }
})
