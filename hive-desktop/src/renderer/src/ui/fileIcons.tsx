import type { ComponentPropsWithoutRef } from 'react'
import { FileCodeIcon, FileIcon, FileTextIcon } from './icons'
import { fileKind, type FileKind } from './fileKind'

/**
 * Per-file-type icons for the explorer tree, editor tabs and viewer header
 * (VS Code-style recognition-at-a-glance). Same visual family as
 * `ui/icons.tsx` — 16×16, 1.5px stroke, `currentColor` — so every glyph
 * inherits the text-role token it sits in; the *hue* per kind is applied by
 * CSS via the `data-kind` attribute on the `.wb-file-icon` wrapper
 * (workbench.css), keeping color a theme concern, not a component one.
 */
type IconProps = ComponentPropsWithoutRef<'svg'> & { size?: number }

function base(size: number | undefined): ComponentPropsWithoutRef<'svg'> {
  const s = size ?? 16
  return {
    width: s,
    height: s,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true
  }
}

/** Markdown — the "M↓" mark. */
export function MarkdownFileIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M2.4 11V5.4l2.5 2.85 2.5-2.85V11" />
      <path d="M12 5.4v4.3" />
      <path d="m10.3 8.1 1.7 1.8 1.7-1.8" />
    </svg>
  )
}

/** HTML/XML — angle brackets with a slash. */
export function HtmlFileIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M4.9 5.1 2.4 8l2.5 2.9" />
      <path d="M11.1 5.1 13.6 8l-2.5 2.9" />
      <path d="M9.35 3.9 6.65 12.1" />
    </svg>
  )
}

/** CSS — the `#` selector. */
export function CssFileIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M6.4 3.75 5.3 12.25M10.7 3.75 9.6 12.25" />
      <path d="M4 6.4h8.75M3.25 9.6H12" />
    </svg>
  )
}

/** JSON — curly braces. */
export function JsonFileIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M6.1 3.25c-1.15 0-1.75.58-1.75 1.65v1.5c0 .84-.45 1.32-1.55 1.6 1.1.28 1.55.76 1.55 1.6v1.5c0 1.07.6 1.65 1.75 1.65" />
      <path d="M9.9 3.25c1.15 0 1.75.58 1.75 1.65v1.5c0 .84.45 1.32 1.55 1.6-1.1.28-1.55.76-1.55 1.6v1.5c0 1.07-.6 1.65-1.75 1.65" />
    </svg>
  )
}

/** Shell/scripts — the `>_` prompt. */
export function ShellFileIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="m3.25 4.75 3.25 3.25-3.25 3.25" />
      <path d="M8.75 11.25h4" />
    </svg>
  )
}

/** Config (yaml/toml/env/…) — gear. */
export function ConfigFileIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <circle cx="8" cy="8" r="2.15" />
      <path d="M8 1.5l.62 1.72 1.8-.5 1.16 1.4 1.72.62-.5 1.8L14.5 8l-1.3 1.3.5 1.8-1.72.62-1.16 1.4-1.8-.5L8 14.5l-1.3-1.06-1.8.5-1.16-1.4-1.72-.62.5-1.8L1.5 8l1.06-1.3-.5-1.8 1.72-.62L5.9 2.5l1.8.5L8 1.5Z" />
    </svg>
  )
}

/** Image — framed landscape. */
export function ImageFileIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <rect x="2.25" y="3.25" width="11.5" height="9.5" rx="1" />
      <circle cx="5.9" cy="6.35" r="1" />
      <path d="m4 11.2 3-3.3 2.1 2.35 1.5-1.7 2.4 2.65" />
    </svg>
  )
}

/** Audio — eighth note. */
export function AudioFileIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <circle cx="6" cy="11" r="1.9" />
      <path d="M7.9 11V3.5c1.9.35 3.1 1.3 3.3 3.25" />
    </svg>
  )
}

/** Video — player with play triangle. */
export function VideoFileIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <rect x="2.25" y="3.75" width="11.5" height="8.5" rx="1.25" />
      <path d="M6.9 6.2v3.6L10 8 6.9 6.2Z" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Archive — zipped box. */
export function ArchiveFileIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <rect x="2.75" y="2.75" width="10.5" height="10.5" rx="1" />
      <path d="M8 3.4v1.2M8 6.1v1.2M8 8.8v1" />
      <path d="M6.9 11.2h2.2" />
    </svg>
  )
}

/** Word-style document — file with dense text lines. */
export function DocFileIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M3.75 2.75c0-.55.45-1 1-1h4.4l3.1 3.1v8.4c0 .55-.45 1-1 1h-6.5c-.55 0-1-.45-1-1V2.75Z" />
      <path d="M9 1.9v2.35c0 .41.34.75.75.75h2.35" />
      <path d="M6 7.25h4M6 9.25h4M6 11.25h2.5" />
    </svg>
  )
}

/** Slides (pptx/…) — file with a screen block. */
export function SlidesFileIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M3.75 2.75c0-.55.45-1 1-1h4.4l3.1 3.1v8.4c0 .55-.45 1-1 1h-6.5c-.55 0-1-.45-1-1V2.75Z" />
      <path d="M9 1.9v2.35c0 .41.34.75.75.75h2.35" />
      <rect x="5.75" y="7.25" width="4.5" height="3" rx="0.5" />
      <path d="M8 10.25v1.5" />
    </svg>
  )
}

/** Spreadsheet (xlsx/csv/…) — file with a grid. */
export function SheetFileIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M3.75 2.75c0-.55.45-1 1-1h4.4l3.1 3.1v8.4c0 .55-.45 1-1 1h-6.5c-.55 0-1-.45-1-1V2.75Z" />
      <path d="M9 1.9v2.35c0 .41.34.75.75.75h2.35" />
      <path d="M5.75 7.25h4.5v4h-4.5Z" />
      <path d="M8 7.25v4M5.75 9.25h4.5" />
    </svg>
  )
}

/** The glyph component per kind — color-neutral; hue comes from CSS via `data-kind`. */
const GLYPH_BY_KIND: Record<FileKind, (props: IconProps) => React.JSX.Element> = {
  md: MarkdownFileIcon,
  html: HtmlFileIcon,
  css: CssFileIcon,
  json: JsonFileIcon,
  config: ConfigFileIcon,
  shell: ShellFileIcon,
  js: FileCodeIcon,
  ts: FileCodeIcon,
  code: FileCodeIcon,
  doc: DocFileIcon,
  pdf: DocFileIcon,
  slides: SlidesFileIcon,
  sheet: SheetFileIcon,
  image: ImageFileIcon,
  audio: AudioFileIcon,
  video: VideoFileIcon,
  archive: ArchiveFileIcon,
  text: FileTextIcon,
  file: FileIcon
}

/**
 * The one shared way to render a file's icon: a `.wb-file-icon` wrapper
 * carrying `data-kind` (CSS applies the per-type hue) around the kind's
 * glyph. Used by the tree rows, the editor tabs and the viewer header.
 */
export function FileTypeIcon({ path, size }: { path: string; size?: number }): React.JSX.Element {
  const kind = fileKind(path)
  const Glyph = GLYPH_BY_KIND[kind]
  return (
    <span className="wb-file-icon" data-kind={kind} aria-hidden="true">
      <Glyph size={size} />
    </span>
  )
}
