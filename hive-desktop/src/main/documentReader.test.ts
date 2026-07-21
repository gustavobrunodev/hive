import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
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
})
