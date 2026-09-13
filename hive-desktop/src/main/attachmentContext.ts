import { createHash } from 'node:crypto'
import {
  copyFileSync,
  linkSync,
  mkdirSync,
  openSync,
  readSync,
  readdirSync,
  closeSync,
  rmSync,
  statSync
} from 'node:fs'
import { basename, extname, join } from 'node:path'

/**
 * Making an attached file actually *arrive*.
 *
 * ## The defect
 *
 * A user attached a photo — `WhatsApp Image 2026-09-11 at 00.16.18.jpe` — and
 * asked the agent to read the data off it. The agent answered that it had
 * received no image. The attachment had reached the CLI: its absolute path was
 * in the turn's `<attached-files>` block, exactly as designed. What defeated it
 * was the **extension**.
 *
 * Agent file-reading tools decide whether a file is an image by its extension,
 * not by its bytes. `.png`, `.jpg`, `.jpeg`, `.gif` and `.webp` go down the
 * image path; everything else is read as text. `.jpe` is a real, registered
 * JPEG extension — WhatsApp, some Windows exports and a few mail clients all
 * emit it — and it is in nobody's list. So the agent opened a JPEG as UTF-8,
 * got a screenful of mojibake, and honestly reported that no image had come.
 * The same trap catches `.jfif`, a file saved with no extension at all, and
 * anything a browser named `photo.jpeg.txt` on the way to disk.
 *
 * ## The fix
 *
 * Identify the file by its **magic bytes**, and when the bytes say "image" but
 * the extension would send the reader down the text path, hand the agent a
 * staged copy whose name tells the truth. The original is never touched or
 * renamed — it is the user's file, sitting in the user's folder — and the
 * prompt block says the copy is a copy, so a reply that names the file names
 * the one the user recognises.
 *
 * Everything else the sniff learns is spent on the block too: a type beside
 * each path is what lets an agent choose between reading a file and running a
 * converter over it, instead of guessing from a name.
 */

/** What a file turned out to be, coarse enough to act on. */
export type AttachmentKind = 'image' | 'pdf' | 'document' | 'archive' | 'media' | 'file'

/** One attachment, as the prompt composer needs it. */
export interface AttachmentContext {
  /**
   * The path the agent is told to read — the original, or a staged copy when
   * the original's name would defeat the reader.
   */
  path: string
  /** What the user calls it: always the original file name. */
  name: string
  kind: AttachmentKind
  /** IANA media type, when the bytes identified one. */
  mime?: string
  /** The original path, set only when `path` is a staged copy of it. */
  stagedFrom?: string
}

/** Signatures, longest-first where two share a prefix. */
interface Signature {
  /** Bytes that must match at `offset`. */
  magic: readonly number[]
  offset: number
  mime: string
  kind: AttachmentKind
  /** The extension a reader will recognise this format by. */
  ext: string
  /** Extra bytes that must match further in (WebP's `WEBP` after `RIFF`). */
  also?: { magic: readonly number[]; offset: number }
}

const ascii = (text: string): number[] => [...text].map((char) => char.charCodeAt(0))

const SIGNATURES: readonly Signature[] = [
  {
    magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    offset: 0,
    mime: 'image/png',
    kind: 'image',
    ext: '.png'
  },
  { magic: [0xff, 0xd8, 0xff], offset: 0, mime: 'image/jpeg', kind: 'image', ext: '.jpg' },
  { magic: ascii('GIF8'), offset: 0, mime: 'image/gif', kind: 'image', ext: '.gif' },
  {
    magic: ascii('RIFF'),
    offset: 0,
    also: { magic: ascii('WEBP'), offset: 8 },
    mime: 'image/webp',
    kind: 'image',
    ext: '.webp'
  },
  { magic: ascii('BM'), offset: 0, mime: 'image/bmp', kind: 'image', ext: '.bmp' },
  { magic: [0x49, 0x49, 0x2a, 0x00], offset: 0, mime: 'image/tiff', kind: 'image', ext: '.tiff' },
  { magic: [0x4d, 0x4d, 0x00, 0x2a], offset: 0, mime: 'image/tiff', kind: 'image', ext: '.tiff' },
  { magic: ascii('heic'), offset: 8, mime: 'image/heic', kind: 'image', ext: '.heic' },
  { magic: ascii('heix'), offset: 8, mime: 'image/heic', kind: 'image', ext: '.heic' },
  { magic: ascii('mif1'), offset: 8, mime: 'image/heif', kind: 'image', ext: '.heif' },
  { magic: ascii('avif'), offset: 8, mime: 'image/avif', kind: 'image', ext: '.avif' },
  { magic: ascii('%PDF-'), offset: 0, mime: 'application/pdf', kind: 'pdf', ext: '.pdf' },
  {
    magic: [0x50, 0x4b, 0x03, 0x04],
    offset: 0,
    mime: 'application/zip',
    kind: 'archive',
    ext: '.zip'
  },
  { magic: [0x1f, 0x8b], offset: 0, mime: 'application/gzip', kind: 'archive', ext: '.gz' },
  { magic: ascii('ID3'), offset: 0, mime: 'audio/mpeg', kind: 'media', ext: '.mp3' },
  { magic: ascii('OggS'), offset: 0, mime: 'audio/ogg', kind: 'media', ext: '.ogg' },
  { magic: ascii('ftyp'), offset: 4, mime: 'video/mp4', kind: 'media', ext: '.mp4' }
]

/**
 * The extensions an agent's file reader recognises as an image. Anything else
 * — `.jpe`, `.jfif`, `.heic`, no extension at all — is opened as text, which
 * is the whole defect this module exists for.
 *
 * Deliberately the *narrow* set rather than every extension any decoder
 * accepts: the cost of staging a copy that did not need one is a few hundred
 * kilobytes in temp, and the cost of missing one is the agent telling the user
 * their photo never arrived.
 */
const READABLE_IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp'])

/** Image formats a staged copy can rescue — the ones a reader will actually open. */
const STAGEABLE_IMAGE_EXTS = new Set(['.png', '.jpg', '.gif', '.webp'])

/** How much of a file has to be read to identify it. */
const SNIFF_BYTES = 32

/** Above this, a staged copy costs more than it can possibly buy. */
const MAX_STAGE_BYTES = 64 * 1024 * 1024

/** Reads the first bytes of a file, or `null` when it can't be opened. */
function headOf(path: string): Buffer | null {
  let fd: number | undefined
  try {
    fd = openSync(path, 'r')
    const buffer = Buffer.alloc(SNIFF_BYTES)
    const read = readSync(fd, buffer, 0, SNIFF_BYTES, 0)
    return buffer.subarray(0, read)
  } catch {
    return null
  } finally {
    if (fd !== undefined) {
      try {
        closeSync(fd)
      } catch {
        // Nothing useful to do about a failed close of a read-only handle.
      }
    }
  }
}

function matches(head: Buffer, magic: readonly number[], offset: number): boolean {
  if (head.length < offset + magic.length) return false
  return magic.every((byte, index) => head[offset + index] === byte)
}

/**
 * What these bytes are, by signature alone. `null` when nothing matched —
 * which for a source file or a Markdown document is the normal answer, not a
 * failure.
 */
export function sniffBytes(
  head: Buffer
): { mime: string; kind: AttachmentKind; ext: string } | null {
  for (const signature of SIGNATURES) {
    if (!matches(head, signature.magic, signature.offset)) continue
    if (signature.also && !matches(head, signature.also.magic, signature.also.offset)) continue
    return { mime: signature.mime, kind: signature.kind, ext: signature.ext }
  }
  return null
}

/** Extension-derived kind, for the files no signature covers (source, Markdown, CSV…). */
function kindByExtension(ext: string): AttachmentKind {
  if (['.doc', '.docx', '.odt', '.rtf', '.xls', '.xlsx', '.ods', '.ppt', '.pptx'].includes(ext)) {
    return 'document'
  }
  if (['.mp3', '.wav', '.m4a', '.ogg', '.mp4', '.mov', '.webm', '.mkv'].includes(ext))
    return 'media'
  if (['.zip', '.tar', '.gz', '.7z', '.rar'].includes(ext)) return 'archive'
  return 'file'
}

/**
 * Whether a file that *is* `mime` would be read as an image under the name it
 * currently has — the single question this module was written to answer.
 */
export function needsStaging(name: string, sniffedExt: string): boolean {
  if (!STAGEABLE_IMAGE_EXTS.has(sniffedExt)) return false
  const ext = extname(name).toLowerCase()
  if (!READABLE_IMAGE_EXTS.has(ext)) return true
  // A `.png` holding JPEG bytes still opens as an image, and renaming it would
  // only trade one mismatch for another. Only the text path has to be escaped.
  return false
}

/** A short, stable folder name for one file, so re-attaching it re-uses the copy. */
function stageKey(path: string, size: number, mtimeMs: number): string {
  return createHash('sha1').update(`${path}|${size}|${mtimeMs}`).digest('hex').slice(0, 12)
}

/**
 * Puts a readable-named copy of `source` under `stageDir` and returns its
 * path, or `null` if it couldn't be made — in which case the caller keeps the
 * original path, which is no worse than before this function existed.
 *
 * A hard link first: the copy is a second *name* for the same bytes, so a 12MB
 * photo costs an inode instead of 12MB, and the original is untouched. Links
 * fail across filesystems (temp on another volume, a network share), and there
 * the real copy is the fallback.
 */
function stageCopy(source: string, name: string, ext: string, stageDir: string): string | null {
  try {
    const stats = statSync(source)
    if (!stats.isFile() || stats.size > MAX_STAGE_BYTES) return null
    const dir = join(stageDir, stageKey(source, stats.size, stats.mtimeMs))
    mkdirSync(dir, { recursive: true })
    // The user's own name, with the extension replaced rather than appended —
    // the agent quotes this back, and `foto.jpe.jpg` reads as a mangling.
    const base = basename(name, extname(name))
    const target = join(dir, `${base}${ext}`)
    try {
      statSync(target)
      return target
    } catch {
      // Not staged yet.
    }
    try {
      linkSync(source, target)
    } catch {
      copyFileSync(source, target)
    }
    return target
  } catch {
    return null
  }
}

/**
 * Describes one attachment and, when its name would defeat an image reader,
 * stages a correctly-named copy for the agent to open.
 *
 * `stageDir` omitted means "describe only" — the sniffed type still reaches
 * the prompt, nothing is written to disk. That is the mode every test runs in.
 */
export function describeAttachment(path: string, stageDir?: string): AttachmentContext {
  const name = basename(path)
  const head = headOf(path)
  const sniffed = head === null ? null : sniffBytes(head)
  if (sniffed === null) {
    return { path, name, kind: kindByExtension(extname(name).toLowerCase()) }
  }
  const base: AttachmentContext = { path, name, kind: sniffed.kind, mime: sniffed.mime }
  if (stageDir === undefined || !needsStaging(name, sniffed.ext)) return base
  const staged = stageCopy(path, name, sniffed.ext, stageDir)
  return staged === null ? base : { ...base, path: staged, stagedFrom: path }
}

/**
 * Describes a turn's attachments.
 *
 * Workspace-relative paths (`@` references) are passed through untouched: they
 * are resolved against the session's cwd by the agent, not by us, and a stat
 * from here would be a stat of the wrong file.
 */
export function describeAttachments(
  paths: readonly string[],
  opts: { stageDir?: string; isAbsolute: (path: string) => boolean }
): AttachmentContext[] {
  return paths.map((path) =>
    opts.isAbsolute(path)
      ? describeAttachment(path, opts.stageDir)
      : { path, name: basename(path), kind: kindByExtension(extname(path).toLowerCase()) }
  )
}

/** How long a staged copy outlives the turn that made it. */
const STAGE_TTL_MS = 24 * 60 * 60 * 1000

/**
 * Drops staged copies older than a day.
 *
 * Called at startup rather than after each turn: a conversation can be
 * re-read, re-sent or resumed long after the message was composed, and a copy
 * deleted the moment a turn ended would break exactly that. A day of temp
 * files is cheap; the hard-linked ones cost nothing at all.
 */
export function pruneStagedAttachments(stageDir: string, now = Date.now()): void {
  let entries: string[]
  try {
    entries = readdirSync(stageDir)
  } catch {
    return
  }
  for (const entry of entries) {
    const dir = join(stageDir, entry)
    try {
      if (now - statSync(dir).mtimeMs < STAGE_TTL_MS) continue
      rmSync(dir, { recursive: true, force: true })
    } catch {
      // A copy we couldn't stat or remove is a copy that stays one more day.
    }
  }
}
