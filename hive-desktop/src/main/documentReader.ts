import { readFileSync } from 'fs'

/**
 * Rich-document readers for the file viewer (docx / pptx / spreadsheet / pdf /
 * image). Every function here takes an *already-resolved, already-validated*
 * absolute path — the workspace-escape guard lives in `fsService.resolveSafe`,
 * and these are only ever reached through the `fsService` wrappers, so they
 * deliberately re-do no security checks. The heavy parsers (`mammoth`,
 * `xlsx`, `jszip`) are `import()`-ed lazily so opening a plain text file never
 * pays to load them, and app startup stays lean.
 */

/** A binary file read for the renderer: base64 payload + a MIME type it can put in a `data:` URL. */
export interface BinaryFile {
  base64: string
  mime: string
  size: number
}

/** A converted `.docx`: sanitised-by-construction HTML from mammoth, plus any conversion warnings. */
export interface DocxDocument {
  html: string
  /** mammoth's non-fatal conversion messages (unsupported styles, dropped elements). */
  warnings: string[]
}

/** One sheet of a workbook — a dense array-of-rows grid, capped to keep the IPC payload bounded. */
export interface SheetData {
  name: string
  /** Row-major cell values (already formatted to strings). */
  rows: string[][]
  /** Total rows/cols on the sheet *before* capping (so the UI can say "showing 2000 of 9000"). */
  rowCount: number
  colCount: number
  /** True when `rows` was capped below `rowCount`/`colCount`. */
  truncated: boolean
}

/** A parsed spreadsheet workbook: one entry per sheet/tab. */
export interface SpreadsheetDocument {
  sheets: SheetData[]
}

/** One paragraph of slide body text, with its outline indent level (0 = top level). */
export interface SlideBullet {
  text: string
  level: number
}

/** A single reader-fidelity slide: title + body paragraphs + embedded images (as `data:` URLs). */
export interface Slide {
  index: number
  title: string | null
  bullets: SlideBullet[]
  images: string[]
}

/** A parsed `.pptx`: an ordered list of slides plus the deck's title (first slide's title). */
export interface SlidesDocument {
  title: string | null
  slides: Slide[]
}

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  svg: 'image/svg+xml',
  pdf: 'application/pdf'
}

function extensionOf(path: string): string {
  const dot = path.lastIndexOf('.')
  return dot === -1 ? '' : path.slice(dot + 1).toLowerCase()
}

/** MIME type for a path's extension, defaulting to the generic binary type. */
export function mimeForPath(path: string): string {
  return MIME_BY_EXT[extensionOf(path)] ?? 'application/octet-stream'
}

/** Reads a binary file (image / pdf) as base64 for a renderer `data:` URL. */
export function readBinaryAt(absPath: string, path: string, size: number): BinaryFile {
  const buffer = readFileSync(absPath)
  return { base64: buffer.toString('base64'), mime: mimeForPath(path), size }
}

/**
 * Converts a `.docx` to HTML via mammoth. Images are inlined as base64
 * `data:` URLs (so they render under the renderer's `img-src 'self' data:`
 * CSP with no extra IPC round-trips); a small style map promotes Word's
 * heading styles to real `<h1>`–`<h3>` so the viewer's document typography
 * can take over.
 */
export async function readDocxAt(absPath: string): Promise<DocxDocument> {
  const mammoth = await import('mammoth')
  const convertImage = mammoth.images.imgElement(async (image) => {
    const base64 = await image.read('base64')
    return { src: `data:${image.contentType};base64,${base64}` }
  })
  const result = await mammoth.convertToHtml(
    { path: absPath },
    {
      convertImage,
      styleMap: [
        "p[style-name='Title'] => h1.doc-title:fresh",
        "p[style-name='Subtitle'] => p.doc-subtitle:fresh",
        "p[style-name='Quote'] => blockquote:fresh"
      ]
    }
  )
  return {
    html: result.value,
    warnings: result.messages.map((message) => message.message)
  }
}

/** Hard caps so one enormous workbook can't flood the structured-clone IPC boundary. */
const MAX_SHEET_ROWS = 2000
const MAX_SHEET_COLS = 100

/**
 * Parses a spreadsheet (`.xlsx`/`.xls`/`.ods`/`.csv`/`.tsv`) via SheetJS into
 * one string grid per sheet. `raw:false` lets SheetJS apply each cell's number
 * format (dates, currency, percentages render the way the author saw them);
 * grids are capped at {@link MAX_SHEET_ROWS}×{@link MAX_SHEET_COLS}.
 */
export async function readSheetAt(absPath: string): Promise<SpreadsheetDocument> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.readFile(absPath, { cellDates: true, cellStyles: false })
  const sheets: SheetData[] = workbook.SheetNames.map((name) => {
    const worksheet = workbook.Sheets[name]
    const ref = worksheet['!ref']
    const range = ref ? XLSX.utils.decode_range(ref) : null
    const rowCount = range ? range.e.r - range.s.r + 1 : 0
    const colCount = range ? range.e.c - range.s.c + 1 : 0
    const grid = XLSX.utils.sheet_to_json<string[]>(worksheet, {
      header: 1,
      raw: false,
      defval: '',
      blankrows: false
    })
    const truncated = grid.length > MAX_SHEET_ROWS || colCount > MAX_SHEET_COLS
    const rows = grid.slice(0, MAX_SHEET_ROWS).map((row) => {
      const cells = Array.isArray(row) ? row : []
      const capped = cells.slice(0, MAX_SHEET_COLS)
      return capped.map((cell) => (cell == null ? '' : String(cell)))
    })
    return { name, rows, rowCount, colCount, truncated }
  })
  return { sheets }
}

/** Decodes the handful of XML entities that appear in DrawingML text runs. */
function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, '&')
}

/** Concatenates the `<a:t>` runs inside one DrawingML block into a single line. */
function textOfBlock(xmlBlock: string): string {
  const runs = xmlBlock.match(/<a:t>([\s\S]*?)<\/a:t>/g) ?? []
  return decodeXmlEntities(runs.map((run) => run.replace(/<\/?a:t>/g, '')).join('')).trim()
}

/** Extracts the paragraphs of a shape as `{ text, level }`, dropping empties. */
function bulletsOfShape(shapeXml: string): SlideBullet[] {
  const paragraphs = shapeXml.match(/<a:p>[\s\S]*?<\/a:p>/g) ?? []
  const bullets: SlideBullet[] = []
  for (const paragraph of paragraphs) {
    const text = textOfBlock(paragraph)
    if (!text) continue
    const levelMatch = paragraph.match(/<a:pPr[^>]*\blvl="(\d+)"/)
    bullets.push({ text, level: levelMatch ? Number(levelMatch[1]) : 0 })
  }
  return bullets
}

interface JsZipFile {
  async(type: 'string' | 'base64'): Promise<string>
}
interface JsZipInstance {
  file(path: string): JsZipFile | null
  files: Record<string, unknown>
}

/** Numeric-suffix sort so `slide2.xml` sorts before `slide10.xml`. */
function slideOrder(a: string, b: string): number {
  const na = Number(a.match(/slide(\d+)\.xml$/)?.[1] ?? 0)
  const nb = Number(b.match(/slide(\d+)\.xml$/)?.[1] ?? 0)
  return na - nb
}

async function imagesOfSlide(
  zip: JsZipInstance,
  slidePath: string,
  slideXml: string
): Promise<string[]> {
  const embedIds = [...slideXml.matchAll(/r:embed="(rId\d+)"/g)].map((match) => match[1])
  if (embedIds.length === 0) return []
  const slideName = slidePath.replace(/^.*\//, '')
  const relsFile = zip.file(`ppt/slides/_rels/${slideName}.rels`)
  if (!relsFile) return []
  const relsXml = await relsFile.async('string')
  const images: string[] = []
  for (const id of embedIds) {
    const target = relsXml.match(new RegExp(`Id="${id}"[^>]*Target="([^"]+)"`))?.[1]
    if (!target) continue
    const mediaPath = `ppt/${target.replace(/^\.\.\//, '')}`
    const mediaFile = zip.file(mediaPath)
    if (!mediaFile) continue
    const base64 = await mediaFile.async('base64')
    images.push(`data:${mimeForPath(mediaPath)};base64,${base64}`)
  }
  return images
}

/**
 * Reader-fidelity `.pptx` parse: unzips the deck with JSZip and pulls each
 * slide's title, body paragraphs (with outline level) and embedded images out
 * of its DrawingML. This is deliberately a *reading* view — text and pictures
 * in order — not a pixel-perfect render of the original layout, which the
 * viewer labels as such.
 */
export async function readSlidesAt(absPath: string): Promise<SlidesDocument> {
  const JSZip = (await import('jszip')).default
  const buffer = readFileSync(absPath)
  const zip = (await JSZip.loadAsync(buffer)) as unknown as JsZipInstance
  const slidePaths = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort(slideOrder)

  const slides: Slide[] = []
  for (let i = 0; i < slidePaths.length; i++) {
    const slidePath = slidePaths[i]
    const file = zip.file(slidePath)
    if (!file) continue
    const xml = await file.async('string')
    const shapes = xml.match(/<p:sp>[\s\S]*?<\/p:sp>/g) ?? []
    let title: string | null = null
    const bullets: SlideBullet[] = []
    for (const shape of shapes) {
      const isTitle = /<p:ph[^>]*\btype="(title|ctrTitle)"/.test(shape)
      if (isTitle && title === null) {
        title = textOfBlock(shape) || null
      } else {
        bullets.push(...bulletsOfShape(shape))
      }
    }
    const images = await imagesOfSlide(zip, slidePath, xml)
    slides.push({ index: i + 1, title, bullets, images })
  }

  return { title: slides[0]?.title ?? null, slides }
}
