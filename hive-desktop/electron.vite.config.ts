import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        /**
         * Two entries, because M29's transcription engine is a **second
         * process**, not a module.
         *
         * `sherpa-onnx-node`'s API is synchronous — `recognizer.decode(stream)`
         * blocks its thread for the length of the phrase — so it cannot run in
         * main without freezing the window. `asrWorker.ts` is the entry that
         * `utilityProcess.fork` starts, and it has to exist as its own file in
         * `out/main/` for main to point at.
         */
        input: {
          index: resolve('src/main/index.ts'),
          asrWorker: resolve('src/main/asr/asrWorker.ts')
        },
        /**
         * The native addon must stay a runtime `require`. Bundling it would
         * inline the JS wrapper and leave the `.node` binary behind, and the
         * wrapper resolves that binary by walking relative paths from its own
         * `__dirname` — see `asrAddon.ts` for what that costs inside an asar.
         */
        external: ['sherpa-onnx-node']
      }
    }
  },
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
