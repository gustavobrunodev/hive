import { resolve, join } from 'path'
import { copyFileSync, mkdirSync, readdirSync } from 'fs'
import { defineConfig } from 'electron-vite'
import type { PluginOption } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Second Brain / Whisper (D-SB-1): ships ONNX Runtime Web's WASM binaries and
 * their JS glue **same-origin** with the renderer.
 *
 * This is load-bearing and not interchangeable with the `hive-model:` protocol
 * that serves model weights: ORT loads its glue with a dynamic `import()`,
 * which the CSP governs as `script-src` (not `connect-src`), so serving it from
 * a custom scheme fails outright ("Failed to fetch dynamically imported
 * module") — verified in the T2 spike, see STATE.md. Copied into the renderer
 * output as `ort/`, which `whisperEnv.ts` points `env.backends.onnx.wasm
 * .wasmPaths` at; `script-src 'self'` then covers them with no CSP additions.
 */
function copyOrtAssets(): PluginOption {
  return {
    name: 'hive-copy-ort-assets',
    apply: 'build',
    closeBundle() {
      const from = resolve('node_modules/onnxruntime-web/dist')
      const to = resolve('out/renderer/ort')
      mkdirSync(to, { recursive: true })
      for (const file of readdirSync(from)) {
        // Only the threaded-SIMD build ORT actually resolves at runtime, plus
        // its glue — copying the full dist would add >100 MB of variants.
        if (file.startsWith('ort-wasm-simd-threaded')) {
          copyFileSync(join(from, file), join(to, file))
        }
      }
    }
  }
}

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
    // Whisper's dictation worker is loaded via `new Worker(..., { type: 'module' })`.
    // Vite's default worker output format is 'iife', which Rollup rejects once the
    // main build is code-split — must match with 'es'.
    worker: {
      format: 'es'
    },
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
    plugins: [react(), copyOrtAssets()]
  }
})
