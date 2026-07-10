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
      }
    },
    plugins: [react()]
  }
})
