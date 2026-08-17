#!/usr/bin/env node
/**
 * tools/visual/nsis-screenshot.mjs — look at the real Windows installer,
 * from WSL, without Windows.
 *
 * `Xvfb :99 -fbdir <dir>` keeps a live XWD dump of the root window on disk;
 * `wine <installer>.exe` under that DISPLAY renders the real NSIS pages into
 * it. This turns that dump into a PNG. It is the only way this repo can see
 * the installer at all, and it has already paid for itself: the first capture
 * caught copy pointing at a button label ("Avançar") that the pt-BR NSIS
 * language file spells `Próximo`.
 *
 *   mkdir -p /tmp/fb
 *   Xvfb :99 -screen 0 1100x800x24 -fbdir /tmp/fb &
 *   DISPLAY=:99 WINEPREFIX=/tmp/wine wine dist/Hive-<version>-setup.exe &
 *   node tools/visual/nsis-screenshot.mjs /tmp/fb/Xvfb_screen0 out.png
 *
 * No `xdotool` on this machine, so the first page is what this proves; the
 * pages behind it rest on the NSIS compile and on stock MUI macros.
 */
import { readFileSync } from 'node:fs'
import sharp from 'sharp'

const [, , source, target = 'nsis-screen.png'] = process.argv
if (!source) {
  console.error('usage: nsis-screenshot.mjs <Xvfb_screen0> [out.png]')
  process.exit(1)
}

const buf = readFileSync(source)
// XWDFileHeader, 32-bit big-endian throughout. The two offsets worth naming:
// bits-per-pixel is at 44 and bytes-per-line at 48 — read them at 48/52 (the
// natural-looking guess) and you get `bpp: 4400`, which is the tell.
const headerSize = buf.readUInt32BE(0)
const width = buf.readUInt32BE(16)
const height = buf.readUInt32BE(20)
const bpp = buf.readUInt32BE(44)
const bytesPerLine = buf.readUInt32BE(48)
if (bpp !== 32) throw new Error(`expected a 32bpp framebuffer, got ${bpp}`)

const rgb = Buffer.alloc(width * height * 3)
for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const at = headerSize + y * bytesPerLine + x * 4 // BGRX
    const to = (y * width + x) * 3
    rgb[to] = buf[at + 2]
    rgb[to + 1] = buf[at + 1]
    rgb[to + 2] = buf[at]
  }
}
await sharp(rgb, { raw: { width, height, channels: 3 } }).png().toFile(target)
console.log(`${width}x${height} -> ${target}`)
