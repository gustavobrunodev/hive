#!/usr/bin/env node
/**
 * scripts/gen-brand-artwork.mjs — every raster the OS sees, derived from the
 * one authored source (`design-system/assets/logos/current_logo_mark.svg`).
 *
 * Writes:
 *   build/icon.png              1024px app icon (electron-builder's source)
 *   build/icon.ico              multi-resolution Windows icon
 *   build/icon.icns             macOS icon set
 *   build/installerIcon.ico     the setup .exe's own icon
 *   build/uninstallerIcon.ico   the uninstaller's icon
 *   build/installerHeader.bmp   150x57  NSIS interior-page header
 *   build/installerSidebar.bmp  164x314 NSIS welcome/finish sidebar
 *   build/uninstallerSidebar.bmp
 *   resources/icon.png          512px — the Linux window icon (main/index.ts)
 *
 * Run it after touching the logo or the brand palette:
 *
 *   npm run build:brand-artwork
 *
 * Two decisions the output alone wouldn't explain:
 *
 * **The small sizes are not the big one, shrunk.** The Hive mark is a brain
 * drawn in circuit traces — hairlines with gaps. Below ~48px those gaps close
 * and the whole thing fills in as a dark blob; measured, not assumed (render
 * `--contact-sheet` and look). So 16/20/24/32 carry the hexagon cell instead
 * — the app's own small mark, already on screen in the chat hero — and 48 and
 * up carry the full brain.
 *
 * **The tile is coral on bordô, not the logo's oxblood on white.** An app icon
 * has no control over what sits behind it (a light taskbar, a photo desktop),
 * so it brings its own ground. Bordô ground + coral mark is exactly the app's
 * own dark theme: `--bg` with `--accent` on it.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { encodeBmp24, encodeIcns, encodeIco } from './lib/imageContainers.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const LOGO_SVG = path.resolve(ROOT, '../design-system/assets/logos/current_logo_mark.svg')

/** Brand palette, mirroring `design-system/src/tokens.css`. */
const BORDO = '#260a12'
const BORDO_LIFT = '#43141f'
/** The ground gradient's value at the tile's centre — what a punched-through hole must match. */
const BORDO_MID = '#350f18'
const CORAL = '#cc7958'
const CORAL_LIFT = '#e0906f'
const PAPER = '#f6efe9'
/** Paper at ~62% over the bordô panel — the supporting line, still clear of the AA floor. */
const PAPER_MUTED = '#b7a19c'

/**
 * Below this edge length the brain's hairlines close up and the mark renders
 * as a doughnut; the hexagon cell takes over. Measured at 7x on the real
 * rasters (`--zoom`), not guessed: at 48px the brain survives *if* the tile
 * inset is tight, at 40px it does not.
 */
const BRAIN_FLOOR = 48

/** Below this, even an outlined hexagon's stroke lands under a pixel — it goes solid instead. */
const HEX_OUTLINE_FLOOR = 32

/** The hexagon cell, verbatim from the app's own `HexMark` (ui/icons.tsx), on a 16-unit grid. */
const HEX_PATH = 'M8 1.75 13.4 4.9v6.2L8 14.25 2.6 11.1V4.9L8 1.75Z'

/**
 * How much of the tile is margin, per size. Optical sizing, not a constant:
 * a 48px tile spends its whole pixel budget on the artwork, while a 1024px
 * one can afford the air that makes it sit properly among other app icons.
 */
function insetRatio(size) {
  if (size < HEX_OUTLINE_FLOOR) return 0.14
  if (size < BRAIN_FLOOR) return 0.18
  if (size <= 64) return 0.085
  if (size <= 128) return 0.115
  return 0.15
}

/** The brain artwork: the mark file's drawing content and the box it's drawn in. */
function loadBrain() {
  const svg = readFileSync(LOGO_SVG, 'utf8')
  const viewBox = /viewBox="([^"]+)"/.exec(svg)
  const body = /<svg[^>]*>([\s\S]*)<\/svg>/.exec(svg)
  if (!viewBox || !body) throw new Error(`Unrecognized logo SVG at ${LOGO_SVG}`)
  const [, , width, height] = viewBox[1].split(/\s+/).map(Number)
  // The mark ships painted in `currentColor` so the app can theme it. That is
  // useless here: the CSS `color` property takes a colour, never a paint
  // server, so a gradient reached through `currentColor` silently resolves to
  // black. Callers substitute a real paint into `{ink}` instead.
  return { width, height, body: body[1].replaceAll('currentColor', '{ink}') }
}

/** The mark's drawing content, painted with `paint` (a colour or a `url(#…)`). */
function brainPainted(paint) {
  return BRAIN.body.replaceAll('{ink}', paint)
}

const BRAIN = loadBrain()

/**
 * The small-size mark: the hive cell at the centre of the brain, which is
 * what survives when the traces around it don't.
 *
 * Outlined above 24px; below it the outline's stroke lands under a device
 * pixel and greys out, so the cell goes solid with the core punched through
 * to the ground instead — same silhouette, no sub-pixel geometry.
 */
function hexagonArtwork(size, scale) {
  if (size < HEX_OUTLINE_FLOOR) {
    // The core is punched, not drawn: at these sizes a coral dot inside a
    // coral cell needs a gap to exist at all, and the gap is the drawing.
    const core = size <= 16 ? 1.9 : 2.3
    return `<path d="${HEX_PATH}" fill="url(#mark)"/>
       <circle cx="8" cy="8" r="${core}" fill="${BORDO_MID}"/>`
  }
  // Held at ~1.6 device pixels: thinner reads grey, thicker closes the cell.
  const stroke = Math.max(1.5, 1.6 / scale)
  return `<path d="${HEX_PATH}" fill="none" stroke="url(#mark)" stroke-width="${stroke}"
       stroke-linejoin="round" stroke-linecap="round"/>
     <circle cx="8" cy="8" r="${Math.max(1.6, stroke * 1.05)}" fill="url(#mark)"/>`
}

/**
 * The rounded-tile app icon at one edge length, as SVG.
 *
 * The ground is a diagonal bordô gradient (a flat fill went dead at 256px and
 * the mark stopped sitting on anything); the mark is a coral gradient running
 * the other way, so the two never wash into each other where they cross.
 */
function tileSvg(size) {
  const radius = size * 0.225
  const brain = size >= BRAIN_FLOOR
  const inset = size * insetRatio(size)
  const box = size - inset * 2
  const scale = brain ? box / Math.max(BRAIN.width, BRAIN.height) : box / 16
  const artwork = brain ? brainPainted('url(#mark)') : hexagonArtwork(size, scale)
  const drawn = brain ? BRAIN.width : 16
  const tall = brain ? BRAIN.height : 16
  const x = inset + (box - drawn * scale) / 2
  const y = inset + (box - tall * scale) / 2

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="ground" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${BORDO_LIFT}"/>
      <stop offset="1" stop-color="${BORDO}"/>
    </linearGradient>
    <linearGradient id="mark" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="${CORAL}"/>
      <stop offset="1" stop-color="${CORAL_LIFT}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="url(#ground)"/>
  <g transform="translate(${x} ${y}) scale(${scale})">
    ${artwork}
  </g>
</svg>`
}

/**
 * The horizontal lockup — mark then wordmark — for the installer's header.
 *
 * The same legibility floor that governs the app icon governs this: under
 * 48px the brain closes up, so the lockup carries the hexagon cell instead.
 * The installer header strip is ~26px tall, which is squarely under it.
 */
function lockupSvg(width, height, ink) {
  const markSize = height
  const gap = height * 0.34
  const wordSize = height * 0.66
  const glyph =
    markSize >= BRAIN_FLOOR
      ? `<g transform="scale(${markSize / Math.max(BRAIN.width, BRAIN.height)})">${brainPainted(ink)}</g>`
      : `<g transform="scale(${markSize / 16})">
           <path d="${HEX_PATH}" fill="none" stroke="${ink}" stroke-width="1.5"
                 stroke-linejoin="round" stroke-linecap="round"/>
           <circle cx="8" cy="8" r="1.9" fill="${ink}"/>
         </g>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  ${glyph}
  <text x="${markSize + gap}" y="${height * 0.54}" dominant-baseline="central"
        font-family="Inter Tight, Inter, DejaVu Sans, sans-serif"
        font-size="${wordSize}" font-weight="700" letter-spacing="${wordSize * 0.18}"
        fill="${ink}">HIVE</text>
</svg>`
}

async function rasterize(svg, size) {
  return sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 })
}

const ICO_SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256]
const ICNS_SIZES = [16, 32, 64, 128, 256, 512, 1024]

function out(...parts) {
  const target = path.join(ROOT, ...parts)
  mkdirSync(path.dirname(target), { recursive: true })
  return target
}

async function writeIcons() {
  const ico = []
  for (const size of ICO_SIZES) {
    const { data } = await sharp(Buffer.from(tileSvg(size)))
      .resize(size, size)
      .raw()
      .ensureAlpha()
      .toBuffer({ resolveWithObject: true })
    ico.push({ size, data })
  }
  const icoBuffer = encodeIco(ico)
  for (const name of ['icon.ico', 'installerIcon.ico', 'uninstallerIcon.ico']) {
    writeFileSync(out('build', name), icoBuffer)
  }

  const icns = []
  for (const size of ICNS_SIZES) {
    icns.push({ size, png: await (await rasterize(tileSvg(size), size)).toBuffer() })
  }
  writeFileSync(out('build', 'icon.icns'), encodeIcns(icns))

  await (await rasterize(tileSvg(1024), 1024)).toFile(out('build', 'icon.png'))
  await (await rasterize(tileSvg(512), 512)).toFile(out('resources', 'icon.png'))
}

/**
 * Flattens an RGBA composition onto an opaque ground and writes it as a BMP.
 * NSIS reads no alpha channel, so this is where transparency ends.
 */
async function writeBmp(name, width, height, layers, background) {
  const { data } = await sharp({
    create: { width, height, channels: 4, background }
  })
    .composite(layers)
    .flatten({ background })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  writeFileSync(out('build', name), encodeBmp24(width, height, data))
}

/**
 * The two NSIS images. Their sizes are fixed by MUI, not by us: 150x57 for
 * the interior-page header (right-aligned — electron-builder sets
 * `MUI_HEADERIMAGE_RIGHT`), 164x314 for the welcome/finish sidebar.
 */
async function writeInstallerArtwork() {
  // Header: the lockup on white — the MUI header strip *is* white, and any
  // tinted ground here shows up as a visible rectangle pasted onto the page
  // rather than as branding. electron-builder sets `MUI_HEADERIMAGE_RIGHT`,
  // so the bitmap sits at the right edge with the page title to its left;
  // the lockup is right-aligned inside it with a margin that matches.
  const header = await sharp(Buffer.from(lockupSvg(112, 22, BORDO)))
    .resize(112, 22, { fit: 'inside' })
    .png()
    .toBuffer()
  await writeBmp('installerHeader.bmp', 150, 57, [{ input: header, left: 24, top: 18 }], '#ffffff')

  // Sidebar: a tall bordô panel with the mark high and the wordmark under it —
  // the one drenched surface in the whole flow, so the install reads as Hive
  // before a single page of chrome does.
  const panel = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="164" height="314">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0.6" y2="1">
        <stop offset="0" stop-color="${BORDO_LIFT}"/>
        <stop offset="1" stop-color="${BORDO}"/>
      </linearGradient>
    </defs>
    <rect width="164" height="314" fill="url(#g)"/>
  </svg>`)
  const mark = await sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${BRAIN.width}" height="${BRAIN.height}"
            viewBox="0 0 ${BRAIN.width} ${BRAIN.height}">${brainPainted(CORAL)}</svg>`
    )
  )
    .resize(84, 84, { fit: 'inside' })
    .png()
    .toBuffer()
  // Wordmark plus the one line that says what is being installed. The panel
  // is 314px tall and the lockup alone left two thirds of it empty; a
  // sentence is a better answer to that than a bigger logo or a texture.
  const word = await sharp(
    Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="164" height="76">
      <text x="82" y="17" text-anchor="middle" dominant-baseline="central"
            font-family="Inter Tight, Inter, DejaVu Sans, sans-serif" font-size="26"
            font-weight="700" letter-spacing="4.4" fill="${PAPER}">HIVE</text>
      <text x="82" y="48" text-anchor="middle" dominant-baseline="central"
            font-family="Inter, DejaVu Sans, sans-serif" font-size="9.5"
            letter-spacing="0.3" fill="${PAPER_MUTED}">Os fluxos do BMAD,</text>
      <text x="82" y="62" text-anchor="middle" dominant-baseline="central"
            font-family="Inter, DejaVu Sans, sans-serif" font-size="9.5"
            letter-spacing="0.3" fill="${PAPER_MUTED}">sem terminal.</text>
    </svg>`)
  )
    .png()
    .toBuffer()

  const layers = [
    { input: panel, left: 0, top: 0 },
    { input: mark, left: 40, top: 86 },
    { input: word, left: 0, top: 186 }
  ]
  await writeBmp('installerSidebar.bmp', 164, 314, layers, BORDO)
  await writeBmp('uninstallerSidebar.bmp', 164, 314, layers, BORDO)
}

/**
 * `--contact-sheet <file.png>`: every .ico size laid out at its true pixel
 * size on light and dark strips. The only honest way to judge whether 16px
 * still reads — a 16px icon inspected at 400% is not a 16px icon.
 */
async function writeContactSheet(target) {
  const pad = 14
  const row = 268
  const width = ICO_SIZES.reduce((sum, size) => sum + size + pad, pad)
  const height = row * 2
  const layers = []
  // Two strips, light and dark, because a taskbar is one or the other and a
  // tile that only survives on grey isn't finished.
  for (const [index, ground] of ['#eceff3', '#1b1d21'].entries()) {
    layers.push({
      input: {
        create: { width, height: row, channels: 4, background: ground }
      },
      left: 0,
      top: index * row
    })
  }
  let left = pad
  for (const size of ICO_SIZES) {
    const png = await (await rasterize(tileSvg(size), size)).toBuffer()
    // Bottom-aligned within each strip so the sizes read as a ramp.
    layers.push({ input: png, left, top: row - pad - size })
    layers.push({ input: png, left, top: row * 2 - pad - size })
    left += size + pad
  }
  await sharp({ create: { width, height, channels: 4, background: '#ffffff' } })
    .composite(layers)
    .png()
    .toFile(target)
}

export { tileSvg }

const sheetFlag = process.argv.indexOf('--contact-sheet')
// Importable without running: the contact sheet experiments import `tileSvg`.
if (process.argv[1] !== fileURLToPath(import.meta.url)) {
  // no-op — imported as a module
} else if (sheetFlag !== -1) {
  await writeContactSheet(process.argv[sheetFlag + 1] ?? path.join(ROOT, 'contact-sheet.png'))
} else {
  await writeIcons()
  await writeInstallerArtwork()
  console.log('brand artwork written to build/ and resources/')
}
