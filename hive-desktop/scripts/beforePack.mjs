import { ensureAsrBinary } from './lib/asrBinary.mjs'

/** electron-builder `beforePack` hook. See `lib/asrBinary.mjs` for why. */
export default async function beforePack(context) {
  ensureAsrBinary(context)
}
