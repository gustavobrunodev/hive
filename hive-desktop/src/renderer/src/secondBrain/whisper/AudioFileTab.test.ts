// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AudioFileTab } from './AudioFileTab'

function renderTab(busy = false): {
  onFile: ReturnType<typeof vi.fn>
  input: HTMLInputElement
} {
  const onFile = vi.fn()
  render(createElement(AudioFileTab, { onFile, busy }))
  return {
    onFile,
    input: screen.getByLabelText('Escolher arquivo de áudio') as HTMLInputElement
  }
}

function pick(input: HTMLInputElement, files: File[]): void {
  Object.defineProperty(input, 'files', { value: files, configurable: true })
  fireEvent.change(input)
}

describe('AudioFileTab (T15)', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('hands the chosen file to the shared audio→transcript path', () => {
    const { onFile, input } = renderTab()
    const file = new File(['x'], 'reuniao.wav')
    pick(input, [file])
    expect(onFile).toHaveBeenCalledWith(file)
  })

  it('ignores a cancelled picker (no file chosen)', () => {
    const { onFile, input } = renderTab()
    pick(input, [])
    expect(onFile).not.toHaveBeenCalled()
  })

  it('clicking the styled button opens the hidden file input', () => {
    const { input } = renderTab()
    const click = vi.spyOn(input, 'click')
    fireEvent.click(screen.getByText('Escolher arquivo de áudio'))
    expect(click).toHaveBeenCalled()
  })

  it('disables the picker while the engine is busy', () => {
    renderTab(true)
    expect((screen.getByText('Escolher arquivo de áudio') as HTMLButtonElement).disabled).toBe(true)
    cleanup()
    renderTab(false)
    expect((screen.getByText('Escolher arquivo de áudio') as HTMLButtonElement).disabled).toBe(
      false
    )
  })

  it('accepts the audio formats WebAudio can decode', () => {
    const { input } = renderTab()
    expect(input.getAttribute('accept')).toContain('audio/*')
    expect(input.getAttribute('accept')).toContain('.wav')
  })
})
