// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SecondBrainGate } from './SecondBrainGate'
import type { SkillEvent } from '../../../main/secondBrainTypes'

/**
 * Task T5 — the second step of the "Preparando o workspace" gate (SB-R1.3/1.4,
 * D-SB-7). Same mocking approach as UpdateGate.test.ts: DS gets trivial DOM
 * stand-ins, `window.hive.secondBrain` is mocked per test.
 */
vi.mock('@hive/design-system', () => ({
  Button: ({ children, ...rest }: { children?: ReactNode }) =>
    createElement('button', rest, children),
  Alert: ({ title, children, ...rest }: { title?: ReactNode; children?: ReactNode }) =>
    createElement(
      'div',
      { role: 'alert', ...rest },
      createElement('strong', null, title),
      children
    ),
  Progress: () => createElement('div', { role: 'progressbar' })
}))

describe('SecondBrainGate (T5)', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  function mockSecondBrain(provisioned: boolean): {
    emitInstall: (event: SkillEvent) => void
    emitUpdate: (event: SkillEvent) => void
    installUnsub: ReturnType<typeof vi.fn>
    updateUnsub: ReturnType<typeof vi.fn>
    install: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  } {
    let installOnEvent: ((e: SkillEvent) => void) | undefined
    let updateOnEvent: ((e: SkillEvent) => void) | undefined
    const installUnsub = vi.fn()
    const updateUnsub = vi.fn()
    const install = vi.fn((_ws: string, onEvent: (e: SkillEvent) => void) => {
      installOnEvent = onEvent
      return installUnsub
    })
    const update = vi.fn((_ws: string, onEvent: (e: SkillEvent) => void) => {
      updateOnEvent = onEvent
      return updateUnsub
    })
    window.hive = {
      ...window.hive,
      secondBrain: {
        ...window.hive?.secondBrain,
        isProvisioned: vi.fn().mockResolvedValue(provisioned),
        install,
        update
      }
    } as typeof window.hive
    return {
      emitInstall: (e) => installOnEvent?.(e),
      emitUpdate: (e) => updateOnEvent?.(e),
      installUnsub,
      updateUnsub,
      install,
      update
    }
  }

  it('installs when the skill is absent, streaming step captions', async () => {
    const m = mockSecondBrain(false)
    render(createElement(SecondBrainGate, { workspace: '/ws', onComplete: () => {} }))

    await waitFor(() => expect(m.install).toHaveBeenCalledWith('/ws', expect.any(Function)))
    expect(m.update).not.toHaveBeenCalled()
    expect(screen.getByText('Preparando a base de conhecimento')).toBeTruthy()

    m.emitInstall({ type: 'step', id: 'found', label: 'Found 4 skills' })
    await waitFor(() => expect(screen.getByText('Found 4 skills')).toBeTruthy())
  })

  it('updates when the skill is already present', async () => {
    const m = mockSecondBrain(true)
    render(createElement(SecondBrainGate, { workspace: '/ws', onComplete: () => {} }))

    await waitFor(() => expect(m.update).toHaveBeenCalledWith('/ws', expect.any(Function)))
    expect(m.install).not.toHaveBeenCalled()
  })

  it('shows progress-message captions and the fallback error text when the message is empty', async () => {
    const m = mockSecondBrain(false)
    render(createElement(SecondBrainGate, { workspace: '/ws', onComplete: () => {} }))
    await waitFor(() => expect(m.install).toHaveBeenCalled())

    m.emitInstall({ type: 'progress', message: 'Cloning repository…' })
    await waitFor(() => expect(screen.getByText('Cloning repository…')).toBeTruthy())

    m.emitInstall({ type: 'error', message: '' })
    await waitFor(() =>
      expect(
        screen.getByText('Algo deu errado ao provisionar as skills do Second Brain.')
      ).toBeTruthy()
    )
  })

  it('offers an escape WHILE provisioning is still running, not only after an error (SB-R1.3)', async () => {
    const m = mockSecondBrain(false)
    const onComplete = vi.fn()
    render(createElement(SecondBrainGate, { workspace: '/ws', onComplete }))

    await waitFor(() => expect(m.install).toHaveBeenCalled())
    // Mid-run: no error yet, but the user must never be trapped on a spinner
    // waiting for a network-backed CLI — this gate also re-runs on every
    // workspace switch.
    m.emitInstall({ type: 'progress', message: 'Cloning repository…' })
    await waitFor(() => expect(screen.getByText('Cloning repository…')).toBeTruthy())
    expect(screen.queryByRole('alert')).toBeNull()

    fireEvent.click(screen.getByText('Continuar mesmo assim'))
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('calls onComplete once the stream reports done', async () => {
    const m = mockSecondBrain(false)
    const onComplete = vi.fn()
    render(createElement(SecondBrainGate, { workspace: '/ws', onComplete }))

    await waitFor(() => expect(m.install).toHaveBeenCalled())
    m.emitInstall({ type: 'done', ok: true })
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
  })

  it('shows retry + continue-anyway on error, and continue-anyway reaches the work UI (SB-R1.3)', async () => {
    const m = mockSecondBrain(false)
    const onComplete = vi.fn()
    render(createElement(SecondBrainGate, { workspace: '/ws', onComplete }))

    await waitFor(() => expect(m.install).toHaveBeenCalled())
    m.emitInstall({ type: 'error', message: 'skills CLI offline' })

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy()
      expect(screen.getByText('skills CLI offline')).toBeTruthy()
    })
    fireEvent.click(screen.getByText('Continuar mesmo assim'))
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('retry re-runs provisioning and clears the error', async () => {
    const m = mockSecondBrain(false)
    render(createElement(SecondBrainGate, { workspace: '/ws', onComplete: () => {} }))

    await waitFor(() => expect(m.install).toHaveBeenCalledTimes(1))
    m.emitInstall({ type: 'error', message: 'boom' })
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())

    fireEvent.click(screen.getByText('Tentar novamente'))
    await waitFor(() => expect(m.install).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('unsubscribes from the stream on unmount', async () => {
    const m = mockSecondBrain(false)
    const { unmount } = render(
      createElement(SecondBrainGate, { workspace: '/ws', onComplete: () => {} })
    )
    await waitFor(() => expect(m.install).toHaveBeenCalled())
    unmount()
    expect(m.installUnsub).toHaveBeenCalled()
  })

  // P1-004: the stream's optional fields and the late-event guard. A `step`
  // without a label must clear the caption rather than print "undefined", and
  // an event after unmount must not touch state on a dead tree.
  it('tolerates label-less events and drops late ones', async () => {
    const m = mockSecondBrain(false)
    const onComplete = vi.fn()
    const { unmount } = render(createElement(SecondBrainGate, { workspace: '/ws', onComplete }))
    await waitFor(() => expect(m.install).toHaveBeenCalled())

    m.emitInstall({ type: 'step', id: 'x', label: 'com rótulo' })
    await waitFor(() => expect(screen.getByText('com rótulo')).toBeTruthy())
    // `SkillEvent` says label/message are always present, but these events
    // cross IPC at runtime: the component's `?? null` is what stands between a
    // malformed stream and a caption reading "undefined". Casting is the only
    // way to reach that defence from the typed emitter.
    m.emitInstall({ type: 'step', id: 'y' } as unknown as SkillEvent)
    await waitFor(() => expect(screen.queryByText('com rótulo')).toBeNull())
    m.emitInstall({ type: 'progress' } as unknown as SkillEvent)
    await waitFor(() => expect(screen.getByText('Preparando a base de conhecimento')).toBeTruthy())

    unmount()
    m.emitInstall({ type: 'done', ok: true })
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('an error without a message still leaves the way out', async () => {
    const m = mockSecondBrain(false)
    render(createElement(SecondBrainGate, { workspace: '/ws', onComplete: vi.fn() }))
    await waitFor(() => expect(m.install).toHaveBeenCalled())

    m.emitInstall({ type: 'error' } as unknown as SkillEvent)

    // R4.2's rule applies here too: a failed gate never traps the user.
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(screen.getByText('Continuar mesmo assim')).toBeTruthy()
  })
})
