import { describe, expect, it } from 'vitest'
import { extensionOf, formatBytes, richViewerKind } from './richViewer'

describe('richViewer', () => {
  describe('extensionOf', () => {
    it('returns the lower-cased extension of a bare name', () => {
      expect(extensionOf('photo.PNG')).toBe('png')
      expect(extensionOf('report.pdf')).toBe('pdf')
    })

    it('uses only the final path segment', () => {
      expect(extensionOf('docs/2026/plan.docx')).toBe('docx')
      expect(extensionOf('a.b.c/file.tar.gz')).toBe('gz')
    })

    it('returns empty string for no extension or a dotfile', () => {
      expect(extensionOf('README')).toBe('')
      expect(extensionOf('.gitignore')).toBe('')
      expect(extensionOf('dir/.env')).toBe('')
    })
  })

  describe('richViewerKind', () => {
    it('maps raster images and svg to the image viewer', () => {
      for (const ext of ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'ico', 'svg']) {
        expect(richViewerKind(`file.${ext}`)).toBe('image')
      }
    })

    it('maps documents, spreadsheets and presentations to their viewers', () => {
      expect(richViewerKind('a.pdf')).toBe('pdf')
      expect(richViewerKind('a.docx')).toBe('docx')
      for (const ext of ['xlsx', 'xls', 'ods', 'csv', 'tsv']) {
        expect(richViewerKind(`a.${ext}`)).toBe('sheet')
      }
      expect(richViewerKind('a.pptx')).toBe('pptx')
    })

    it('is case-insensitive', () => {
      expect(richViewerKind('IMG.JPG')).toBe('image')
      expect(richViewerKind('Deck.PPTX')).toBe('pptx')
    })

    it('returns null for text and unknown/legacy binary formats', () => {
      expect(richViewerKind('notes.md')).toBeNull()
      expect(richViewerKind('script.ts')).toBeNull()
      expect(richViewerKind('legacy.doc')).toBeNull() // old binary .doc — mammoth can't read it
      expect(richViewerKind('slides.ppt')).toBeNull()
      expect(richViewerKind('archive.zip')).toBeNull()
      expect(richViewerKind('Makefile')).toBeNull()
    })
  })

  describe('formatBytes', () => {
    it('formats bytes under 1 KB as raw bytes', () => {
      expect(formatBytes(0)).toBe('0 B')
      expect(formatBytes(512)).toBe('512 B')
      expect(formatBytes(1023)).toBe('1023 B')
    })

    it('scales into KB / MB / GB with one decimal', () => {
      expect(formatBytes(1024)).toBe('1.0 KB')
      expect(formatBytes(1536)).toBe('1.5 KB')
      expect(formatBytes(1024 * 1024)).toBe('1.0 MB')
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1.0 GB')
    })

    it('drops the decimal once the value reaches 100 in its unit', () => {
      expect(formatBytes(150 * 1024)).toBe('150 KB')
      expect(formatBytes(999 * 1024)).toBe('999 KB')
    })

    it('caps at GB rather than inventing a larger unit', () => {
      expect(formatBytes(5 * 1024 * 1024 * 1024)).toBe('5.0 GB')
    })
  })
})
