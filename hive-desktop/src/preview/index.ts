import { createPreviewReceiver } from './receiver'

/**
 * Design Studio (M18) — the Preview bundle's entry point. Bundled by
 * `scripts/buildPreviewReceiver.mjs` into
 * `resources/design-studio-preview/receiver.js` and loaded by the session
 * shell. Everything worth testing lives in `receiver.ts`.
 */
createPreviewReceiver(window).start()
