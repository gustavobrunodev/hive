import { verifyAsrBinary } from './lib/asrBinary.mjs'

/** electron-builder `afterPack` hook. See `lib/asrBinary.mjs` for why. */
export default async function afterPack(context) {
  verifyAsrBinary(context)
}
