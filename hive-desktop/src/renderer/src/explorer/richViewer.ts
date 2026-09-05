/**
 * Routing for the rich file viewer (docx / pptx / spreadsheet / pdf / image).
 * Extension-based, kept JSX-free so it stays unit-testable and the viewer
 * components stay fast-refreshable. A path that maps to a kind here is opened
 * in the matching visual viewer instead of the plain text editor — even when
 * the format is technically text (`.svg`), because *seeing* it is the default
 * a user wants.
 */
export type RichViewerKind = 'image' | 'pdf' | 'docx' | 'sheet' | 'pptx'

const KIND_BY_EXT: Record<string, RichViewerKind> = {
  // images (raster + svg — svg renders as an image rather than opening as XML)
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  avif: 'image',
  bmp: 'image',
  ico: 'image',
  svg: 'image',
  // documents
  pdf: 'pdf',
  docx: 'docx',
  // Binary spreadsheets (SheetJS reads them all). `.csv`/`.tsv` are NOT here:
  // they are text this app can edit, and they open in the editor pane's own
  // table mode (`CsvEditor`) instead of a read-only render.
  xlsx: 'sheet',
  xls: 'sheet',
  ods: 'sheet',
  // presentations
  pptx: 'pptx'
}

/** Lower-cased extension of a path/name (no leading dot); `''` when there is none. */
export function extensionOf(path: string): string {
  const slash = path.lastIndexOf('/')
  const name = slash === -1 ? path : path.slice(slash + 1)
  const dot = name.lastIndexOf('.')
  return dot <= 0 ? '' : name.slice(dot + 1).toLowerCase()
}

/** The rich viewer a path should open in, or `null` to fall back to the text editor / code view. */
export function richViewerKind(path: string): RichViewerKind | null {
  return KIND_BY_EXT[extensionOf(path)] ?? null
}

/** Human-readable file size (`"1.4 MB"`, `"820 KB"`, `"12 B"`). Locale-agnostic, viewer chrome. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`
}
