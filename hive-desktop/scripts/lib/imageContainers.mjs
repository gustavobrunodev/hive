/**
 * scripts/lib/imageContainers.mjs — the three binary containers Windows and
 * macOS want for application/installer artwork, written by hand because no
 * dependency in this project produces them and adding one for ~150 lines of
 * well-specified header layout is a worse trade.
 *
 * Build tooling, not shipped application code: plain Node, no bundler.
 *
 * - `encodeIco`   — a multi-resolution Windows icon (.ico).
 * - `encodeIcns`  — a macOS icon set (.icns).
 * - `encodeBmp24` — a 24-bit bottom-up BMP, the only format the NSIS MUI
 *                   header/sidebar images accept.
 *
 * Every entry is authored at its own size by the caller. That is the whole
 * point: an .ico that holds one 1024px render downscaled by the shell is
 * exactly how a detailed mark turns to mud in a 16px taskbar slot.
 */

/**
 * A Windows .ico from per-size RGBA rasters.
 *
 * Entries are stored as uncompressed BMP DIBs rather than embedded PNGs.
 * PNG-in-ICO is legal since Vista and half the size, but NSIS rewrites the
 * installer's icon resource at compile time and is fussier than the shell
 * about what it accepts; a DIB is understood by everything that has ever read
 * an .ico. The extra ~300 KB lives in the installer, never in the app.
 *
 * @param {{ size: number, data: Buffer }[]} images RGBA pixels, row-major, top-down.
 * @returns {Buffer}
 */
export function encodeIco(images) {
  const entries = images.map(({ size, data }) => ({ size, body: dibOf(size, data) }))
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(entries.length, 4)

  const directory = Buffer.alloc(16 * entries.length)
  let offset = header.length + directory.length
  entries.forEach((entry, index) => {
    const at = index * 16
    // 256 is stored as 0 — the field is one byte and 256 doesn't fit.
    directory.writeUInt8(entry.size >= 256 ? 0 : entry.size, at)
    directory.writeUInt8(entry.size >= 256 ? 0 : entry.size, at + 1)
    directory.writeUInt8(0, at + 2) // palette size: 0 for true colour
    directory.writeUInt8(0, at + 3) // reserved
    directory.writeUInt16LE(1, at + 4) // colour planes
    directory.writeUInt16LE(32, at + 6) // bits per pixel
    directory.writeUInt32LE(entry.body.length, at + 8)
    directory.writeUInt32LE(offset, at + 12)
    offset += entry.body.length
  })

  return Buffer.concat([header, directory, ...entries.map((entry) => entry.body)])
}

/**
 * One .ico entry: a BITMAPINFOHEADER whose declared height is doubled (the
 * format's way of saying "colour rows then mask rows"), BGRA pixels written
 * bottom-up, then a 1-bit AND mask. The mask is all-zero — the alpha channel
 * is what modern Windows reads — but it must be present and its rows padded
 * to 4 bytes, or the shell reads the next icon's header as pixel data.
 */
function dibOf(size, rgba) {
  const header = Buffer.alloc(40)
  header.writeUInt32LE(40, 0)
  header.writeInt32LE(size, 4)
  header.writeInt32LE(size * 2, 8)
  header.writeUInt16LE(1, 12)
  header.writeUInt16LE(32, 14)
  header.writeUInt32LE(0, 16) // BI_RGB

  const pixels = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y += 1) {
    const source = (size - 1 - y) * size * 4
    const target = y * size * 4
    for (let x = 0; x < size; x += 1) {
      pixels[target + x * 4] = rgba[source + x * 4 + 2] // B
      pixels[target + x * 4 + 1] = rgba[source + x * 4 + 1] // G
      pixels[target + x * 4 + 2] = rgba[source + x * 4] // R
      pixels[target + x * 4 + 3] = rgba[source + x * 4 + 3] // A
    }
  }

  const maskStride = Math.ceil(size / 32) * 4
  const mask = Buffer.alloc(maskStride * size)
  header.writeUInt32LE(pixels.length + mask.length, 20)
  return Buffer.concat([header, pixels, mask])
}

/** The `.icns` chunk type for each edge length we ship. */
const ICNS_TYPES = {
  16: 'icp4',
  32: 'icp5',
  64: 'icp6',
  128: 'ic07',
  256: 'ic08',
  512: 'ic09',
  1024: 'ic10'
}

/**
 * A macOS .icns from per-size PNGs: the `icns` magic, the total byte length,
 * then one length-prefixed chunk per size. Sizes without a chunk type are
 * skipped rather than guessed at.
 *
 * @param {{ size: number, png: Buffer }[]} images
 * @returns {Buffer}
 */
export function encodeIcns(images) {
  const chunks = []
  for (const { size, png } of images) {
    const type = ICNS_TYPES[size]
    if (type === undefined) continue
    const chunk = Buffer.alloc(8 + png.length)
    chunk.write(type, 0, 4, 'ascii')
    chunk.writeUInt32BE(png.length + 8, 4)
    png.copy(chunk, 8)
    chunks.push(chunk)
  }
  const body = Buffer.concat(chunks)
  const header = Buffer.alloc(8)
  header.write('icns', 0, 4, 'ascii')
  header.writeUInt32BE(body.length + 8, 4)
  return Buffer.concat([header, body])
}

/**
 * A 24-bit bottom-up BMP — what the NSIS MUI header and sidebar images must
 * be. There is no alpha channel in this format, so the caller flattens onto
 * the ground it wants before calling.
 *
 * @param {number} width
 * @param {number} height
 * @param {Buffer} rgb Row-major, top-down, 3 bytes per pixel.
 * @returns {Buffer}
 */
export function encodeBmp24(width, height, rgb) {
  const stride = Math.ceil((width * 3) / 4) * 4
  const pixels = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y += 1) {
    const source = (height - 1 - y) * width * 3
    const target = y * stride
    for (let x = 0; x < width; x += 1) {
      pixels[target + x * 3] = rgb[source + x * 3 + 2] // B
      pixels[target + x * 3 + 1] = rgb[source + x * 3 + 1] // G
      pixels[target + x * 3 + 2] = rgb[source + x * 3] // R
    }
  }

  const fileHeader = Buffer.alloc(14)
  fileHeader.write('BM', 0, 2, 'ascii')
  fileHeader.writeUInt32LE(14 + 40 + pixels.length, 2)
  fileHeader.writeUInt32LE(14 + 40, 10)

  const infoHeader = Buffer.alloc(40)
  infoHeader.writeUInt32LE(40, 0)
  infoHeader.writeInt32LE(width, 4)
  infoHeader.writeInt32LE(height, 8)
  infoHeader.writeUInt16LE(1, 12)
  infoHeader.writeUInt16LE(24, 14)
  infoHeader.writeUInt32LE(pixels.length, 20)

  return Buffer.concat([fileHeader, infoHeader, pixels])
}
