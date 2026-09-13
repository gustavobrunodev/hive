import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, isAbsolute, join } from 'node:path'
import {
  describeAttachment,
  describeAttachments,
  needsStaging,
  pruneStagedAttachments,
  sniffBytes
} from './attachmentContext'
import { composeTurnPrompt } from './agentAdapter'

/** Real bytes, not fixtures with the right name: the whole module is about bytes vs names. */
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(24)])
const GIF = Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(26)])
const WEBP = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x20, 0, 0, 0]),
  Buffer.from('WEBP'),
  Buffer.alloc(20)
])
const PDF = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(23)])
const TEXT = Buffer.from('# Uma PRD\n\nTexto comum.\n')

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'hive-attach-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function write(name: string, bytes: Buffer): string {
  const path = join(root, name)
  writeFileSync(path, bytes)
  return path
}

describe('sniffBytes', () => {
  it('identifies the image formats a chat actually receives', () => {
    expect(sniffBytes(PNG)?.mime).toBe('image/png')
    expect(sniffBytes(JPEG)?.mime).toBe('image/jpeg')
    expect(sniffBytes(GIF)?.mime).toBe('image/gif')
    expect(sniffBytes(WEBP)?.mime).toBe('image/webp')
  })

  it('does not mistake any RIFF container for a WebP', () => {
    const wav = Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.from([0x20, 0, 0, 0]),
      Buffer.from('WAVE'),
      Buffer.alloc(20)
    ])
    expect(sniffBytes(wav)).toBeNull()
  })

  it('identifies documents and archives', () => {
    expect(sniffBytes(PDF)).toEqual({ mime: 'application/pdf', kind: 'pdf', ext: '.pdf' })
    const docx = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(28)])
    expect(sniffBytes(docx)?.kind).toBe('archive')
  })

  it('says nothing for ordinary text — the normal answer, not a failure', () => {
    expect(sniffBytes(TEXT)).toBeNull()
  })
})

describe('needsStaging', () => {
  it('is the whole defect: a JPEG named .jpe would be opened as text', () => {
    expect(needsStaging('WhatsApp Image 2026-09-11 at 00.16.18.jpe', '.jpg')).toBe(true)
    expect(needsStaging('foto.jfif', '.jpg')).toBe(true)
    expect(needsStaging('captura-sem-extensao', '.png')).toBe(true)
    expect(needsStaging('foto.jpeg.txt', '.jpg')).toBe(true)
  })

  it('leaves a name a reader already recognises alone, case included', () => {
    expect(needsStaging('foto.jpg', '.jpg')).toBe(false)
    expect(needsStaging('FOTO.JPEG', '.jpg')).toBe(false)
    expect(needsStaging('captura.PNG', '.png')).toBe(false)
    // A .png holding JPEG bytes still opens as an image; renaming would only
    // trade one mismatch for another.
    expect(needsStaging('foto.png', '.jpg')).toBe(false)
  })

  it('does not stage formats no rename can rescue', () => {
    expect(needsStaging('scan.tiff', '.tiff')).toBe(false)
    expect(needsStaging('foto.heic', '.heic')).toBe(false)
    expect(needsStaging('relatorio.pdf', '.pdf')).toBe(false)
  })
})

describe('describeAttachment', () => {
  it('types a file by its bytes, so the block can say what it is', () => {
    expect(describeAttachment(write('relatorio.pdf', PDF))).toMatchObject({
      name: 'relatorio.pdf',
      kind: 'pdf',
      mime: 'application/pdf'
    })
  })

  it('falls back to the extension for files no signature covers', () => {
    expect(describeAttachment(write('planilha.xlsx', TEXT)).kind).toBe('document')
    expect(describeAttachment(write('notas.md', TEXT)).kind).toBe('file')
  })

  it('survives a file that vanished between pick and send', () => {
    const entry = describeAttachment(join(root, 'nao-existe.png'))
    expect(entry).toEqual({
      path: join(root, 'nao-existe.png'),
      name: 'nao-existe.png',
      kind: 'file'
    })
  })

  it('describes only — no copy — when given no stage directory', () => {
    const source = write('WhatsApp Image.jpe', JPEG)
    const entry = describeAttachment(source)
    expect(entry.path).toBe(source)
    expect(entry.stagedFrom).toBeUndefined()
  })

  it('stages a readable-named copy for the image whose extension would defeat the reader', () => {
    const source = write('WhatsApp Image 2026-09-11 at 00.16.18.jpe', JPEG)
    const stage = join(root, 'stage')
    const entry = describeAttachment(source, stage)

    expect(entry.path).not.toBe(source)
    expect(entry.path.endsWith('.jpg')).toBe(true)
    // The user's own name, with the extension REPLACED — `foto.jpe.jpg` reads
    // as a mangling of the name the agent is about to quote back.
    expect(basename(entry.path)).toBe('WhatsApp Image 2026-09-11 at 00.16.18.jpg')
    expect(entry.stagedFrom).toBe(source)
    // The name the user knows survives, whatever the copy is called.
    expect(entry.name).toBe('WhatsApp Image 2026-09-11 at 00.16.18.jpe')
    expect(entry.mime).toBe('image/jpeg')
  })

  it('leaves the original where it is — it is the user’s file, not ours', () => {
    const source = write('foto.jpe', JPEG)
    describeAttachment(source, join(root, 'stage'))
    expect(readdirSync(root)).toContain('foto.jpe')
  })

  it('re-uses the copy when the same file is attached twice', () => {
    const source = write('foto.jpe', JPEG)
    const stage = join(root, 'stage')
    expect(describeAttachment(source, stage).path).toBe(describeAttachment(source, stage).path)
    expect(readdirSync(stage)).toHaveLength(1)
  })

  it('stages nothing for a file already named for what it is', () => {
    const source = write('foto.png', PNG)
    const entry = describeAttachment(source, join(root, 'stage'))
    expect(entry.path).toBe(source)
    expect(entry.stagedFrom).toBeUndefined()
  })
})

describe('describeAttachments', () => {
  it('passes workspace-relative references through without touching the disk', () => {
    const [reference] = describeAttachments(['docs/prd.md'], { isAbsolute })
    expect(reference).toEqual({ path: 'docs/prd.md', name: 'prd.md', kind: 'file' })
  })

  it('describes absolute attachments and relative references in one turn', () => {
    const photo = write('foto.jpe', JPEG)
    const entries = describeAttachments([photo, 'docs/prd.md'], {
      stageDir: join(root, 'stage'),
      isAbsolute
    })
    expect(entries[0]?.stagedFrom).toBe(photo)
    expect(entries[1]?.path).toBe('docs/prd.md')
  })
})

describe('pruneStagedAttachments', () => {
  it('drops yesterday’s copies and keeps today’s', () => {
    const stage = join(root, 'stage')
    mkdirSync(join(stage, 'old'), { recursive: true })
    mkdirSync(join(stage, 'fresh'), { recursive: true })
    const twoDaysAgo = (Date.now() - 2 * 24 * 60 * 60 * 1000) / 1000
    utimesSync(join(stage, 'old'), twoDaysAgo, twoDaysAgo)

    pruneStagedAttachments(stage)

    expect(readdirSync(stage)).toEqual(['fresh'])
  })

  it('is a no-op when nothing has ever been staged', () => {
    expect(() => pruneStagedAttachments(join(root, 'never'))).not.toThrow()
  })
})

/**
 * The other half of the fix: the block the agent reads. Staging puts a
 * readable file on disk; this is what tells the agent it is an image and must
 * be opened rather than declared missing.
 */
describe('composeTurnPrompt with described attachments', () => {
  it('names the type of each file', () => {
    const prompt = composeTurnPrompt('extraia os dados', [
      { path: '/abs/foto.jpg', name: 'foto.jpg', kind: 'image', mime: 'image/jpeg' }
    ])
    expect(prompt).toContain('- /abs/foto.jpg — image/jpeg')
  })

  it('instructs the agent to OPEN images, which is the sentence the bug was missing', () => {
    const prompt = composeTurnPrompt('', [
      { path: '/abs/foto.jpg', name: 'foto.jpg', kind: 'image', mime: 'image/jpeg' }
    ])
    expect(prompt).toMatch(/never answer that no image was provided/i)
  })

  it('says a staged copy is a copy, and of which file', () => {
    const prompt = composeTurnPrompt('extraia os dados', [
      {
        path: '/tmp/stage/ab12/foto.jpg',
        name: 'foto.jpe',
        kind: 'image',
        mime: 'image/jpeg',
        stagedFrom: '/home/eu/foto.jpe'
      }
    ])
    // Both names are present: the agent reads one and quotes the other.
    expect(prompt).toContain('/tmp/stage/ab12/foto.jpg')
    expect(prompt).toContain('"foto.jpe"')
    expect(prompt).toContain('/home/eu/foto.jpe')
  })

  it('still takes bare paths, so a caller that has not described them is not broken', () => {
    const prompt = composeTurnPrompt('oi', ['docs/prd.md'])
    expect(prompt).toContain('\n- docs/prd.md\n')
  })

  it('leaves a turn with no attachments exactly as it was', () => {
    expect(composeTurnPrompt('oi', [])).toBe('oi')
    expect(composeTurnPrompt('oi')).toBe('oi')
  })
})
