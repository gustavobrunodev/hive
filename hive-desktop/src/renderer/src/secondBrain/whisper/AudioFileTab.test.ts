// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AudioFileTab } from './AudioFileTab'

function renderTab(busy = false): {
  onFiles: ReturnType<typeof vi.fn>
  input: HTMLInputElement
  zone: HTMLButtonElement
} {
  const onFiles = vi.fn()
  render(createElement(AudioFileTab, { onFiles, busy }))
  return {
    onFiles,
    input: screen.getByLabelText('Escolher arquivo de áudio') as HTMLInputElement,
    zone: screen.getByText('Arraste seus áudios aqui').closest('button') as HTMLButtonElement
  }
}

function pick(input: HTMLInputElement, files: File[]): void {
  Object.defineProperty(input, 'files', { value: files, configurable: true })
  fireEvent.change(input)
}

const wav = (name = 'reuniao.wav'): File => new File(['x'], name, { type: 'audio/wav' })

describe('AudioFileTab (T15)', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('hands the chosen file to the shared audio→transcript path', () => {
    const { onFiles, input } = renderTab()
    const file = wav()
    pick(input, [file])
    expect(onFiles).toHaveBeenCalledWith([file])
  })

  it('accepts several files at once — a folder of voice memos is the normal case', () => {
    const { onFiles, input } = renderTab()
    const files = [wav('a.wav'), wav('b.mp3')]
    pick(input, files)
    expect(onFiles).toHaveBeenCalledWith(files)
  })

  it('ignores a cancelled picker (no file chosen)', () => {
    const { onFiles, input } = renderTab()
    pick(input, [])
    expect(onFiles).not.toHaveBeenCalled()
  })

  it('clicking the drop zone opens the hidden file input', () => {
    const { input, zone } = renderTab()
    const click = vi.spyOn(input, 'click')
    fireEvent.click(zone)
    expect(click).toHaveBeenCalled()
  })

  it('disables the drop zone while the engine is busy', () => {
    expect(renderTab(true).zone.disabled).toBe(true)
    cleanup()
    expect(renderTab(false).zone.disabled).toBe(false)
  })

  it('accepts the audio formats WebAudio can decode', () => {
    const { input } = renderTab()
    expect(input.getAttribute('accept')).toContain('audio/*')
    expect(input.getAttribute('accept')).toContain('.wav')
  })

  describe('drag and drop', () => {
    function drop(zone: HTMLElement, files: File[]): void {
      fireEvent.drop(zone, { dataTransfer: { files } })
    }

    it('takes dropped audio without going through the picker', () => {
      const { onFiles, zone } = renderTab()
      const file = wav()
      drop(zone, [file])
      expect(onFiles).toHaveBeenCalledWith([file])
    })

    it('keeps the audio and reports what it dropped — a mixed drop is not a failure', () => {
      const { onFiles, zone } = renderTab()
      const audio = wav('nota.wav')
      drop(zone, [audio, new File(['x'], 'planilha.xlsx')])
      expect(onFiles).toHaveBeenCalledWith([audio])
      expect(screen.getByText('1 arquivo ignorado: não é áudio.')).toBeTruthy()
    })

    it('recognises audio by extension when the OS reports no MIME type', () => {
      const { onFiles, zone } = renderTab()
      const file = new File(['x'], 'memo.m4a', { type: '' })
      drop(zone, [file])
      expect(onFiles).toHaveBeenCalledWith([file])
    })

    it('highlights only while a drag is actually over the zone', () => {
      const { zone } = renderTab()
      expect(zone.hasAttribute('data-over')).toBe(false)
      fireEvent.dragEnter(zone)
      expect(zone.hasAttribute('data-over')).toBe(true)
      fireEvent.dragLeave(zone)
      expect(zone.hasAttribute('data-over')).toBe(false)
    })
  })
})
