/**
 * File-type recognition for the explorer/tabs/viewer icons (ui/fileIcons.tsx).
 * Extension-based, dotfile-aware; anything unmapped falls back to `file`.
 * Kept in its own module (no JSX) so component files stay fast-refreshable.
 */
export type FileKind =
  | 'md'
  | 'html'
  | 'css'
  | 'js'
  | 'ts'
  | 'json'
  | 'config'
  | 'shell'
  | 'code'
  | 'doc'
  | 'slides'
  | 'sheet'
  | 'pdf'
  | 'image'
  | 'audio'
  | 'video'
  | 'archive'
  | 'text'
  | 'file'

const KIND_BY_EXT: Record<string, FileKind> = {
  md: 'md',
  mdx: 'md',
  markdown: 'md',
  html: 'html',
  htm: 'html',
  xml: 'html',
  svelte: 'html',
  vue: 'html',
  css: 'css',
  scss: 'css',
  sass: 'css',
  less: 'css',
  js: 'js',
  jsx: 'js',
  mjs: 'js',
  cjs: 'js',
  ts: 'ts',
  tsx: 'ts',
  mts: 'ts',
  cts: 'ts',
  json: 'json',
  jsonc: 'json',
  yml: 'config',
  yaml: 'config',
  toml: 'config',
  ini: 'config',
  conf: 'config',
  env: 'config',
  gitignore: 'config',
  npmrc: 'config',
  nvmrc: 'config',
  editorconfig: 'config',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  fish: 'shell',
  ps1: 'shell',
  bat: 'shell',
  cmd: 'shell',
  py: 'code',
  rb: 'code',
  go: 'code',
  rs: 'code',
  java: 'code',
  kt: 'code',
  c: 'code',
  h: 'code',
  cpp: 'code',
  hpp: 'code',
  cs: 'code',
  php: 'code',
  swift: 'code',
  sql: 'code',
  doc: 'doc',
  docx: 'doc',
  odt: 'doc',
  rtf: 'doc',
  ppt: 'slides',
  pptx: 'slides',
  odp: 'slides',
  xls: 'sheet',
  xlsx: 'sheet',
  ods: 'sheet',
  csv: 'sheet',
  tsv: 'sheet',
  pdf: 'pdf',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  svg: 'image',
  webp: 'image',
  avif: 'image',
  ico: 'image',
  bmp: 'image',
  mp3: 'audio',
  wav: 'audio',
  ogg: 'audio',
  flac: 'audio',
  m4a: 'audio',
  mp4: 'video',
  mov: 'video',
  avi: 'video',
  webm: 'video',
  mkv: 'video',
  zip: 'archive',
  tar: 'archive',
  gz: 'archive',
  tgz: 'archive',
  rar: 'archive',
  '7z': 'archive',
  txt: 'text',
  log: 'text'
}

/** Resolves a path (or bare file name) to its icon kind — extension-based, dotfile-aware (`.gitignore` → `gitignore`). */
export function fileKind(path: string): FileKind {
  const slash = path.lastIndexOf('/')
  const name = (slash === -1 ? path : path.slice(slash + 1)).toLowerCase()
  const dot = name.lastIndexOf('.')
  const ext = dot <= 0 ? (name.startsWith('.') ? name.slice(1) : '') : name.slice(dot + 1)
  return KIND_BY_EXT[ext] ?? 'file'
}
