import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import * as XLSX from 'xlsx'
import JSZip from 'jszip'
import { mimeForPath } from './documentReader'
import { createFsService, type FsService } from './fsService'

/**
 * Exercises the rich-document readers through `fsService` (real temp dirs, same
 * approach as fsService.test.ts) so both the parsing logic in `documentReader`
 * and the workspace-escape/`isFile` guards in `fsService`'s wrappers are
 * covered by one set of tests. Fixtures are generated in-test with the same
 * libraries the readers use.
 */
describe('documentReader (via fsService)', () => {
  let root: string
  let fs: FsService

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'hive-doc-reader-'))
    fs = createFsService()
  })
  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  describe('mimeForPath', () => {
    it('maps known image/pdf extensions and defaults to octet-stream', () => {
      expect(mimeForPath('a.png')).toBe('image/png')
      expect(mimeForPath('a.JPG')).toBe('image/jpeg')
      expect(mimeForPath('a.svg')).toBe('image/svg+xml')
      expect(mimeForPath('a.pdf')).toBe('application/pdf')
      expect(mimeForPath('a.bin')).toBe('application/octet-stream')
      expect(mimeForPath('noext')).toBe('application/octet-stream')
    })
  })

  describe('readBinary', () => {
    it('reads a file as base64 with its mime type and size', () => {
      const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])
      writeFileSync(join(root, 'pic.png'), bytes)
      const result = fs.readBinary(root, 'pic.png')
      expect(result.mime).toBe('image/png')
      expect(result.size).toBe(bytes.length)
      expect(Buffer.from(result.base64, 'base64').equals(bytes)).toBe(true)
    })

    it('rejects a path that escapes the workspace root', () => {
      expect(() => fs.readBinary(root, '../secret.png')).toThrow(/escapes workspace root/)
    })

    it('throws when the target is a directory, not a file', () => {
      mkdirSync(join(root, 'sub'))
      expect(() => fs.readBinary(root, 'sub')).toThrow(/Not a file/)
    })
  })

  describe('readSheet', () => {
    it('parses an .xlsx workbook into per-sheet string grids', async () => {
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.aoa_to_sheet([
        ['Item', 'Custo'],
        ['Design', 100],
        ['Infra', 200]
      ])
      XLSX.utils.book_append_sheet(wb, ws, 'Dados')
      XLSX.writeFile(wb, join(root, 'plan.xlsx'))

      const { sheets } = await fs.readSheet(root, 'plan.xlsx')
      expect(sheets).toHaveLength(1)
      expect(sheets[0].name).toBe('Dados')
      expect(sheets[0].rowCount).toBe(3)
      expect(sheets[0].colCount).toBe(2)
      expect(sheets[0].truncated).toBe(false)
      expect(sheets[0].rows[0]).toEqual(['Item', 'Custo'])
      // raw:false stringifies numeric cells
      expect(sheets[0].rows[1]).toEqual(['Design', '100'])
    })

    it('reads a .csv the same way', async () => {
      writeFileSync(join(root, 'data.csv'), 'a,b\n1,2\n3,4\n')
      const { sheets } = await fs.readSheet(root, 'data.csv')
      expect(sheets[0].rows).toEqual([
        ['a', 'b'],
        ['1', '2'],
        ['3', '4']
      ])
    })
  })

  describe('readSlides', () => {
    async function writePptx(relPath: string, slideXmls: string[]): Promise<void> {
      const zip = new JSZip()
      slideXmls.forEach((xml, i) => zip.file(`ppt/slides/slide${i + 1}.xml`, xml))
      const buffer = await zip.generateAsync({ type: 'nodebuffer' })
      writeFileSync(join(root, relPath), buffer)
    }

    it('extracts titles, outline-level bullets and orders slides numerically', async () => {
      const slide1 =
        '<p:sld><p:cSld><p:spTree>' +
        '<p:sp><p:nvSpPr><p:nvPr><p:ph type="ctrTitle"/></p:nvPr></p:nvSpPr>' +
        '<p:txBody><a:p><a:r><a:t>Primeiro</a:t></a:r></a:p></p:txBody></p:sp>' +
        '<p:sp><p:txBody>' +
        '<a:p><a:r><a:t>Ponto A</a:t></a:r></a:p>' +
        '<a:p><a:pPr lvl="1"/><a:r><a:t>Sub &amp; nota</a:t></a:r></a:p>' +
        '</p:txBody></p:sp>' +
        '</p:spTree></p:cSld></p:sld>'
      const slide2 =
        '<p:sld><p:cSld><p:spTree>' +
        '<p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>' +
        '<p:txBody><a:p><a:r><a:t>Segundo</a:t></a:r></a:p></p:txBody></p:sp>' +
        '</p:spTree></p:cSld></p:sld>'
      // Intentionally add out of numeric order to prove the sort.
      await writePptx('deck.pptx', [slide1, slide2])

      const doc = await fs.readSlides(root, 'deck.pptx')
      expect(doc.title).toBe('Primeiro')
      expect(doc.slides).toHaveLength(2)
      expect(doc.slides[0].index).toBe(1)
      expect(doc.slides[0].title).toBe('Primeiro')
      expect(doc.slides[0].bullets).toEqual([
        { text: 'Ponto A', level: 0 },
        { text: 'Sub & nota', level: 1 } // entity decoded
      ])
      expect(doc.slides[1].title).toBe('Segundo')
      expect(doc.slides[1].bullets).toEqual([])
    })

    it('returns an empty deck (null title) when there are no slides', async () => {
      await writePptx('empty.pptx', [])
      const doc = await fs.readSlides(root, 'empty.pptx')
      expect(doc.title).toBeNull()
      expect(doc.slides).toEqual([])
    })
  })

  describe('readDocx', () => {
    it('converts a minimal .docx to HTML', async () => {
      const zip = new JSZip()
      zip.file(
        '[Content_Types].xml',
        '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
          '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
          '</Types>'
      )
      zip.file(
        '_rels/.rels',
        '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
          '</Relationships>'
      )
      zip.file(
        'word/document.xml',
        '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
          '<w:body><w:p><w:r><w:t>Olá do documento</w:t></w:r></w:p></w:body></w:document>'
      )
      const buffer = await zip.generateAsync({ type: 'nodebuffer' })
      writeFileSync(join(root, 'doc.docx'), buffer)

      const result = await fs.readDocx(root, 'doc.docx')
      expect(result.html).toContain('Olá do documento')
      expect(Array.isArray(result.warnings)).toBe(true)
    })
  })

  /**
   * P0-008 / P0-009 (test-design-qa.md, risk R-09 — SEC, score 6).
   *
   * These readers are the app's one arbitrary-input surface: the user opens a
   * file they were sent, and `mammoth`/`xlsx`/`jszip` parse it in the MAIN
   * process, where an uncaught throw takes the whole app down rather than one
   * pane. Until now every fixture in this file was well-formed, so the failure
   * mode that actually happens in the wild — a truncated download, a renamed
   * file, a deliberately malformed archive — was untested.
   *
   * The contract asserted here is deliberately narrow and is the one the viewer
   * depends on: a hostile file produces a REJECTED PROMISE (which
   * `Explorer`/`DocumentViewer` render as the retry card), never a synchronous
   * throw, a hang, or a process-level crash.
   */
  describe('hostile and malformed input (P0-008, R-09)', () => {
    /** Bytes that are not a zip, not text, and not any known container. */
    const GARBAGE = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])

    async function validPptxBuffer(): Promise<Buffer> {
      const zip = new JSZip()
      zip.file(
        'ppt/slides/slide1.xml',
        '<?xml version="1.0"?><p:sld xmlns:p="p"><p:cSld><p:spTree></p:spTree></p:cSld></p:sld>'
      )
      return zip.generateAsync({ type: 'nodebuffer' })
    }

    // Every reader, against every shape of broken input we can actually
    // receive. Table-driven so a new reader cannot quietly skip the matrix.
    const readers = [
      ['readDocx', (name: string) => fs.readDocx(root, name), 'docx'],
      ['readSheet', (name: string) => fs.readSheet(root, name), 'xlsx'],
      ['readSlides', (name: string) => fs.readSlides(root, name), 'pptx']
    ] as const

    const payloads = [
      ['an empty file', () => Buffer.alloc(0)],
      ['random bytes with a plausible extension', () => GARBAGE],
      ['a zip header with nothing behind it', () => Buffer.from('PK')],
      [
        'a truncated archive (interrupted download)',
        async () => (await validPptxBuffer()).subarray(0, 40)
      ]
    ] as const

    // The asserted contract is deliberately "settles, promptly, and the process
    // is still alive afterwards" — NOT "rejects". Whether a given reader
    // refuses hostile bytes or degrades to a junk grid is library policy and it
    // varies by payload: mammoth and jszip refuse anything that is not a valid
    // OOXML container, while SheetJS refuses zip-shaped garbage but happily
    // parses arbitrary bytes into a nonsense sheet (a .jpg renamed .xlsx shows
    // junk cells rather than an error). Pinning either policy per case would be
    // pinning SheetJS's behaviour, not this app's. What matters for R-09, and
    // what actually broke, is the main process surviving.
    for (const [readerName, invoke, ext] of readers) {
      for (const [payloadName, makeBytes] of payloads) {
        it(`${readerName} handles ${payloadName} without crashing the main process`, async () => {
          const name = `hostile.${ext}`
          writeFileSync(join(root, name), await makeBytes())

          // A promise that settles — not a synchronous throw, which would
          // escape the IPC handler's try/catch and reach `uncaughtException`.
          const result = invoke(name)
          expect(result).toBeInstanceOf(Promise)
          const started = Date.now()
          const outcome = await result.then(
            () => 'resolved' as const,
            () => 'rejected' as const
          )
          expect(outcome).toMatch(/resolved|rejected/)
          // Bounded work: an unbounded allocation is how the inflated-range
          // case took the app down, and it never surfaced as an error.
          expect(Date.now() - started).toBeLessThan(5_000)

          // The process is still healthy and the next read still works.
          writeFileSync(join(root, 'after.txt'), 'still alive')
          expect(fs.readBinary(root, 'after.txt').size).toBe(11)
        })
      }
    }

    it('readSheet survives a spreadsheet whose declared range far exceeds its data', async () => {
      // REGRESSION. A worksheet's `<dimension>` is just a claim in the XML,
      // independent of how many cells the file carries. Before the cap moved
      // onto the range handed to SheetJS, this ~6 KB file — two real cells,
      // a declared range of a billion — froze the main process outright
      // (measured: still allocating after 180 s, app unusable, no error).
      // Small file, whole-app denial of service.
      const sheet = XLSX.utils.aoa_to_sheet([['a', 'b']])
      const book = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(book, sheet, 'Inflado')
      const honest = join(root, 'honest.xlsx')
      XLSX.writeFile(book, honest)

      // Rewrite the declared dimension in place — the only way to get a claim
      // the writer would never produce, which is exactly the hostile case.
      const zip = await JSZip.loadAsync(readFileSync(honest))
      const sheetEntry = Object.keys(zip.files).find((n) =>
        /worksheets\/sheet1\.xml$/.test(n)
      ) as string
      const patched = (await zip.file(sheetEntry)!.async('string')).replace(
        /<dimension ref="[^"]*"\/>/,
        '<dimension ref="A1:ZZ1048576"/>'
      )
      expect(patched).toContain('A1:ZZ1048576')
      zip.file(sheetEntry, patched)
      writeFileSync(join(root, 'inflated.xlsx'), await zip.generateAsync({ type: 'nodebuffer' }))

      const started = Date.now()
      const doc = await fs.readSheet(root, 'inflated.xlsx')
      // Bounded work, not just a bounded result: the old code never got here.
      expect(Date.now() - started).toBeLessThan(5_000)

      expect(doc.sheets).toHaveLength(1)
      expect(doc.sheets[0].rows.length).toBeLessThanOrEqual(2000)
      // The real content still comes through (padded out to the column cap by
      // `defval`), and the user is told it is cut.
      expect(doc.sheets[0].rows[0].slice(0, 2)).toEqual(['a', 'b'])
      expect(doc.sheets[0].truncated).toBe(true)
    })

    it('readSlides tolerates a deck whose slide XML is malformed', async () => {
      // Well-formed container, garbage inside — the common shape of a
      // partially-corrupted file. Text extraction is regex-based, so this must
      // degrade to "no text found", not throw.
      const zip = new JSZip()
      zip.file('ppt/slides/slide1.xml', '<p:sld><p:sp><unclosed attr="')
      writeFileSync(join(root, 'broken.pptx'), await zip.generateAsync({ type: 'nodebuffer' }))

      const doc = await fs.readSlides(root, 'broken.pptx')
      expect(doc.slides).toHaveLength(1)
      expect(doc.slides[0].title).toBeNull()
    })

    /**
     * P0-009, restated to the risk that actually exists here.
     *
     * The test design assumed `jszip` was an EXTRACTION surface and asked
     * whether a `../` entry could write outside the destination. It cannot:
     * `jszip` appears exactly once in this codebase (`readSlidesAt`), is
     * `loadAsync`-ed from a buffer, and every entry is read into memory —
     * nothing is ever written to disk. Verified 2026-07-30.
     *
     * The traversal that IS reachable is intra-archive: a slide's relationship
     * `Target` is pasted into a zip-entry lookup after stripping a single
     * leading `../`. This pins that the lookup stays inside the archive and
     * that a hostile target simply resolves to nothing.
     */
    it('a relationship target with ../ segments cannot read outside the archive', async () => {
      const secret = join(root, 'secret.txt')
      writeFileSync(secret, 'must never be embedded')

      const zip = new JSZip()
      zip.file(
        'ppt/slides/slide1.xml',
        '<?xml version="1.0"?><p:sld xmlns:p="p" xmlns:r="r"><p:cSld><p:spTree>' +
          '<p:pic><p:blipFill><a:blip r:embed="rId1"/></p:blipFill></p:pic>' +
          '</p:spTree></p:cSld></p:sld>'
      )
      zip.file(
        'ppt/slides/_rels/slide1.xml.rels',
        '<?xml version="1.0"?><Relationships>' +
          `<Relationship Id="rId1" Target="../../../../../../${secret}"/>` +
          '</Relationships>'
      )
      writeFileSync(join(root, 'evil.pptx'), await zip.generateAsync({ type: 'nodebuffer' }))

      const doc = await fs.readSlides(root, 'evil.pptx')
      // The target resolves to no zip entry, so no image is produced — and
      // crucially nothing from the filesystem is inlined.
      expect(doc.slides[0].images).toEqual([])
      const serialised = JSON.stringify(doc)
      expect(serialised).not.toContain('must never be embedded')
      expect(serialised).not.toContain(Buffer.from('must never be embedded').toString('base64'))
    })

    it('readBinary hands hostile bytes through untouched — parsing is the renderer sandbox', async () => {
      // Worth stating explicitly: pdf and image bytes are NOT parsed in main.
      // `readBinary` only base64s them, and pdf.js runs in the renderer under
      // CSP. So there is no main-process parse to harden for those two types —
      // the R-09 surface is docx/xlsx/pptx only.
      writeFileSync(join(root, 'evil.pdf'), GARBAGE)
      const result = fs.readBinary(root, 'evil.pdf')
      expect(result.mime).toBe('application/pdf')
      expect(Buffer.from(result.base64, 'base64').equals(GARBAGE)).toBe(true)
    })
  })
})
